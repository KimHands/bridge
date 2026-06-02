import uuid
from datetime import date, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.routine_trigger import run_trigger
from app.core.encryption import decrypt_json, encrypt_json
from app.dependencies.auth import get_current_user
from app.models.diary import DiaryEntry
from app.models.keyword import DiaryEmotionKeyword, EmotionKeyword, SituationKeyword
from app.models.user import User
from app.schemas.auth import SuccessResponse
from app.schemas.diary import (
    DiaryCreateRequest,
    DiaryCreateResponse,
    DiaryDetailResponse,
    DiaryListItem,
    DiaryListResponse,
    DiaryUpdateRequest,
    DiaryUpdateResponse,
    SituationKeywordOutput,
    TodayStatusResponse,
)

router = APIRouter(prefix="/diaries", tags=["diaries"])


@router.post("", status_code=201, response_model=SuccessResponse[DiaryCreateResponse])
async def create_diary(
    body: DiaryCreateRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()

    result = await db.execute(
        select(DiaryEntry).where(
            DiaryEntry.user_id == current_user.id,
            DiaryEntry.recorded_date == today,
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={"code": "DIARY_ALREADY_EXISTS_TODAY", "message": "오늘 일기는 이미 작성되었습니다"},
        )

    encrypted_memo = encrypt_json({"memo": body.memo}) if body.memo else None

    diary = DiaryEntry(
        user_id=current_user.id,
        mood_score=body.mood_score,
        encrypted_memo=encrypted_memo,
        recorded_date=today,
    )
    db.add(diary)
    await db.flush()

    keyword_map: dict[str, int] = {}
    if body.emotion_keywords:
        kw_result = await db.execute(
            select(EmotionKeyword).where(EmotionKeyword.name.in_(body.emotion_keywords))
        )
        for kw in kw_result.scalars().all():
            keyword_map[kw.name] = kw.id
            db.add(DiaryEmotionKeyword(diary_id=diary.id, keyword_id=kw.id))

    for sk in body.situation_keywords:
        kw_id = keyword_map.get(sk.emotion_keyword)
        if kw_id:
            db.add(SituationKeyword(
                diary_id=diary.id,
                keyword_id=kw_id,
                answer_text=sk.answer,
            ))

    await db.commit()
    await db.refresh(diary)

    background_tasks.add_task(run_trigger, current_user.id)

    return {
        "success": True,
        "data": DiaryCreateResponse(
            diary_id=str(diary.id),
            mood_score=diary.mood_score,
            emotion_keywords=body.emotion_keywords,
            situation_keywords=[
                SituationKeywordOutput(emotion_keyword=sk.emotion_keyword, answer=sk.answer)
                for sk in body.situation_keywords
            ],
            created_at=diary.created_at.isoformat(),
            trigger_executed=True,
        ),
        "message": "ok",
    }


# today/status는 /{diary_id} 보다 반드시 먼저 정의
@router.get("/today/status", response_model=SuccessResponse[TodayStatusResponse])
async def get_today_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    today = date.today()
    result = await db.execute(
        select(DiaryEntry).where(
            DiaryEntry.user_id == current_user.id,
            DiaryEntry.recorded_date == today,
        )
    )
    diary = result.scalar_one_or_none()

    return {
        "success": True,
        "data": TodayStatusResponse(
            has_diary_today=diary is not None,
            diary_id=str(diary.id) if diary else None,
            mood_score=diary.mood_score if diary else None,
        ),
        "message": "ok",
    }


@router.get("", response_model=SuccessResponse[DiaryListResponse])
async def list_diaries(
    cursor: str | None = None,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    limit = min(limit, 50)

    stmt = (
        select(DiaryEntry)
        .where(DiaryEntry.user_id == current_user.id)
        .order_by(DiaryEntry.created_at.desc())
        .limit(limit + 1)
    )
    if cursor:
        cursor_dt = datetime.fromisoformat(cursor)
        stmt = stmt.where(DiaryEntry.created_at < cursor_dt)

    result = await db.execute(stmt)
    entries = list(result.scalars().all())

    has_next = len(entries) > limit
    entries = entries[:limit]

    # N+1 제거: 목록 일기들의 감정 키워드를 한 번에 조회 후 diary_id로 그룹핑.
    diary_ids = [e.id for e in entries]
    kw_by_diary: dict = {}
    if diary_ids:
        kw_rows = await db.execute(
            select(DiaryEmotionKeyword.diary_id, EmotionKeyword.name)
            .join(EmotionKeyword, EmotionKeyword.id == DiaryEmotionKeyword.keyword_id)
            .where(DiaryEmotionKeyword.diary_id.in_(diary_ids))
        )
        for diary_id, name in kw_rows.all():
            kw_by_diary.setdefault(diary_id, []).append(name)

    items = []
    for e in entries:
        kw_names = kw_by_diary.get(e.id, [])

        memo_preview = None
        if e.encrypted_memo:
            try:
                memo = decrypt_json(e.encrypted_memo).get("memo", "")
                memo_preview = memo[:20] if memo else None
            except Exception:
                memo_preview = None

        items.append(DiaryListItem(
            diary_id=str(e.id),
            mood_score=e.mood_score,
            emotion_keywords=kw_names,
            memo_preview=memo_preview,
            created_at=e.created_at.isoformat(),
        ))

    next_cursor = entries[-1].created_at.isoformat() if has_next and entries else None

    return {
        "success": True,
        "data": DiaryListResponse(items=items, cursor=next_cursor, has_next=has_next),
        "message": "ok",
    }


@router.get("/{diary_id}", response_model=SuccessResponse[DiaryDetailResponse])
async def get_diary(
    diary_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == uuid.UUID(diary_id))
    )
    diary = result.scalar_one_or_none()
    if not diary:
        raise HTTPException(
            status_code=404,
            detail={"code": "DIARY_NOT_FOUND", "message": "존재하지 않는 일기입니다"},
        )
    if diary.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": "UNAUTHORIZED", "message": "본인의 일기만 조회할 수 있습니다"},
        )

    kw_result = await db.execute(
        select(EmotionKeyword)
        .join(DiaryEmotionKeyword, DiaryEmotionKeyword.keyword_id == EmotionKeyword.id)
        .where(DiaryEmotionKeyword.diary_id == diary.id)
    )
    kw_names = [kw.name for kw in kw_result.scalars().all()]

    sk_result = await db.execute(
        select(SituationKeyword, EmotionKeyword)
        .join(EmotionKeyword, EmotionKeyword.id == SituationKeyword.keyword_id)
        .where(SituationKeyword.diary_id == diary.id)
    )
    situation_keywords = [
        SituationKeywordOutput(emotion_keyword=ek.name, answer=sk.answer_text)
        for sk, ek in sk_result.all()
    ]

    memo = None
    if diary.encrypted_memo:
        memo = decrypt_json(diary.encrypted_memo).get("memo")

    return {
        "success": True,
        "data": DiaryDetailResponse(
            diary_id=str(diary.id),
            mood_score=diary.mood_score,
            emotion_keywords=kw_names,
            situation_keywords=situation_keywords,
            memo=memo,
            created_at=diary.created_at.isoformat(),
        ),
        "message": "ok",
    }


@router.patch("/{diary_id}", response_model=SuccessResponse[DiaryUpdateResponse])
async def update_diary(
    diary_id: str,
    body: DiaryUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DiaryEntry).where(DiaryEntry.id == uuid.UUID(diary_id))
    )
    diary = result.scalar_one_or_none()
    if not diary:
        raise HTTPException(
            status_code=404,
            detail={"code": "DIARY_NOT_FOUND", "message": "존재하지 않는 일기입니다"},
        )
    if diary.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": "UNAUTHORIZED", "message": "본인의 일기만 수정할 수 있습니다"},
        )
    if diary.recorded_date != date.today():
        raise HTTPException(
            status_code=403,
            detail={"code": "DIARY_NOT_EDITABLE", "message": "당일 작성 일기만 수정할 수 있습니다"},
        )

    if body.mood_score is not None:
        diary.mood_score = body.mood_score
    if body.memo is not None:
        diary.encrypted_memo = encrypt_json({"memo": body.memo})

    if body.emotion_keywords is not None:
        await db.execute(delete(DiaryEmotionKeyword).where(DiaryEmotionKeyword.diary_id == diary.id))
        await db.execute(delete(SituationKeyword).where(SituationKeyword.diary_id == diary.id))

        kw_result = await db.execute(
            select(EmotionKeyword).where(EmotionKeyword.name.in_(body.emotion_keywords))
        )
        keyword_map: dict[str, int] = {kw.name: kw.id for kw in kw_result.scalars().all()}

        for name in body.emotion_keywords:
            if name in keyword_map:
                db.add(DiaryEmotionKeyword(diary_id=diary.id, keyword_id=keyword_map[name]))

        if body.situation_keywords:
            for sk in body.situation_keywords:
                kw_id = keyword_map.get(sk.emotion_keyword)
                if kw_id:
                    db.add(SituationKeyword(
                        diary_id=diary.id,
                        keyword_id=kw_id,
                        answer_text=sk.answer,
                    ))

    await db.commit()
    await db.refresh(diary)

    return {
        "success": True,
        "data": DiaryUpdateResponse(
            diary_id=str(diary.id),
            updated_at=diary.updated_at.isoformat(),
        ),
        "message": "ok",
    }
