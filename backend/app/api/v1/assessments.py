from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import any_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.encryption import decrypt_json, encrypt_json
from app.dependencies.auth import get_current_user
from app.models.assessment import Assessment
from app.models.routine import Routine, UserRoutine
from app.models.user import User
from app.schemas.assessment import (
    AssessmentRequest,
    AssessmentResponse,
    AssessmentHistoryItem,
    AssignedRoutineItem,
)
from app.schemas.auth import SuccessResponse
from app.services.safety_metrics import assessment_crisis_events, record_safety_event

router = APIRouter(prefix="/assessments", tags=["assessments"])


def _calculate_phq_tier(score: int) -> int:
    if score <= 4:
        return 1
    if score <= 9:
        return 2
    if score <= 19:
        return 3
    return 4


@router.post("", status_code=201, response_model=SuccessResponse[AssessmentResponse])
async def create_assessment(
    body: AssessmentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    phq9_score = sum(body.phq9_answers)
    phq_tier = _calculate_phq_tier(phq9_score)
    needs_professional_flag = body.phq9_answers[8] >= 1

    encrypted = encrypt_json({
        "answers": body.phq9_answers,
        "score": phq9_score,
        "flag": needs_professional_flag,
        "primary_cause": body.primary_cause,
    }, aad=str(current_user.id))

    assessment = Assessment(
        user_id=current_user.id,
        encrypted_result=encrypted,
        phq_tier=phq_tier,
    )
    db.add(assessment)
    await db.flush()  # assessment.id 확보

    # 루틴 배정 쿼리
    if phq_tier == 4:
        stmt = (
            select(Routine)
            .where(Routine.phq_tier_min == 4, Routine.phq_tier_max == 4)
            .limit(1)
        )
    else:
        stmt = (
            select(Routine)
            .where(
                Routine.phq_tier_min <= phq_tier,
                Routine.phq_tier_max >= phq_tier,
                body.primary_cause == any_(Routine.target_keywords),
            )
            .limit(2)
        )

    result = await db.execute(stmt)
    routines = result.scalars().all()

    now = datetime.now(timezone.utc)
    for routine in routines:
        db.add(UserRoutine(
            user_id=current_user.id,
            routine_id=routine.id,
            source="initial",
            is_active=True,
            assigned_at=now,
        ))

    await db.commit()
    await db.refresh(assessment)

    for event_type in assessment_crisis_events(
        needs_professional_flag=needs_professional_flag, phq_tier=phq_tier
    ):
        await record_safety_event(event_type)

    assigned = [
        AssignedRoutineItem(
            routine_id=r.id,
            title=r.title,
            category=r.target_keywords[0] if r.target_keywords else "general",
        )
        for r in routines
    ]

    return {
        "success": True,
        "data": AssessmentResponse(
            assessment_id=str(assessment.id),
            phq9_level=phq_tier,
            primary_cause=body.primary_cause,
            needs_professional_flag=needs_professional_flag,
            assigned_routines=assigned,
        ),
        "message": "ok",
    }


@router.get("", response_model=SuccessResponse[dict])
async def get_assessments(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Assessment)
        .where(Assessment.user_id == current_user.id)
        .order_by(Assessment.created_at.desc())
    )
    assessments = result.scalars().all()

    items = []
    for a in assessments:
        data = decrypt_json(a.encrypted_result, aad=str(a.user_id))
        items.append(AssessmentHistoryItem(
            assessment_id=str(a.id),
            phq9_level=a.phq_tier,
            primary_cause=data["primary_cause"],
            needs_professional_flag=data.get("flag", False),
            taken_at=a.created_at.isoformat(),
        ))

    return {
        "success": True,
        "data": {"items": [i.model_dump() for i in items]},
        "message": "ok",
    }
