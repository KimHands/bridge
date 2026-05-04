# [Design] Phase 6 — 루틴 관리 API

> 작성일: 2026-04-13
> Phase: 6 / 8
> 상태: Design
> 참조: `docs/01-plan/features/Phase6-루틴관리.plan.md`

---

## 1. 디렉토리 구조 (추가분)

```
backend/app/
├── schemas/routine.py          # 신규: 요청/응답 스키마
└── api/v1/routines.py          # 신규: 4개 엔드포인트

# 수정
app/main.py                     # routines 라우터 등록 + 에러 핸들러
```

---

## 2. `schemas/routine.py` 전체 설계

```python
from datetime import datetime
from pydantic import BaseModel


class RoutineItem(BaseModel):
    user_routine_id: str
    routine_id: int
    title: str
    description: str
    source: str                  # initial / trigger / manual
    is_completed_today: bool
    assigned_at: str             # ISO8601


class RoutineListResponse(BaseModel):
    routines: list[RoutineItem]


class RoutineAddRequest(BaseModel):
    routine_id: int


class RoutineAddResponse(BaseModel):
    user_routine_id: str
    routine_id: int
    title: str
    source: str
    assigned_at: str


class RoutineCompleteRequest(BaseModel):
    completed: bool


class RoutineCompleteResponse(BaseModel):
    user_routine_id: str
    completed: bool
    logged_at: str               # ISO8601
```

---

## 3. `api/v1/routines.py` 전체 설계

### 3.1 Import 및 라우터

```python
import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.routine import Routine, RoutineLog, UserRoutine
from app.models.user import User
from app.schemas.auth import SuccessResponse
from app.schemas.routine import (
    RoutineAddRequest,
    RoutineAddResponse,
    RoutineCompleteRequest,
    RoutineCompleteResponse,
    RoutineItem,
    RoutineListResponse,
)

router = APIRouter(prefix="/routines", tags=["routines"])
```

### 3.2 `GET /routines/me` — 내 루틴 목록

```python
@router.get("/me", response_model=SuccessResponse[RoutineListResponse])
async def list_my_routines(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 활성 UserRoutine 목록 조회
    ur_result = await db.execute(
        select(UserRoutine, Routine)
        .join(Routine, Routine.id == UserRoutine.routine_id)
        .where(UserRoutine.user_id == current_user.id, UserRoutine.is_active == True)
        .order_by(UserRoutine.assigned_at.asc())
    )
    rows = ur_result.all()

    today = date.today()
    routines = []
    for ur, routine in rows:
        # 오늘 완료 여부 확인
        log_result = await db.execute(
            select(RoutineLog).where(
                RoutineLog.user_routine_id == ur.id,
                RoutineLog.completed_date == today,
            )
        )
        is_completed_today = log_result.scalar_one_or_none() is not None

        routines.append(RoutineItem(
            user_routine_id=str(ur.id),
            routine_id=routine.id,
            title=routine.title,
            description=routine.description,
            source=ur.source,
            is_completed_today=is_completed_today,
            assigned_at=ur.assigned_at.isoformat(),
        ))

    return {
        "success": True,
        "data": RoutineListResponse(routines=routines),
        "message": "ok",
    }
```

### 3.3 `POST /routines/me` — 루틴 수동 추가

```python
@router.post("/me", status_code=201, response_model=SuccessResponse[RoutineAddResponse])
async def add_routine(
    body: RoutineAddRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 루틴 존재 확인
    routine_result = await db.execute(
        select(Routine).where(Routine.id == body.routine_id)
    )
    routine = routine_result.scalar_one_or_none()
    if not routine:
        raise HTTPException(
            status_code=404,
            detail={"code": "ROUTINE_NOT_FOUND", "message": "존재하지 않는 루틴입니다"},
        )

    # 이미 활성화된 동일 루틴 확인
    existing_result = await db.execute(
        select(UserRoutine).where(
            UserRoutine.user_id == current_user.id,
            UserRoutine.routine_id == body.routine_id,
            UserRoutine.is_active == True,
        )
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail={"code": "ROUTINE_ALREADY_ASSIGNED", "message": "이미 추가된 루틴입니다"},
        )

    now = datetime.now(timezone.utc)
    ur = UserRoutine(
        user_id=current_user.id,
        routine_id=routine.id,
        source="manual",
        is_active=True,
        assigned_at=now,
    )
    db.add(ur)
    await db.commit()
    await db.refresh(ur)

    return {
        "success": True,
        "data": RoutineAddResponse(
            user_routine_id=str(ur.id),
            routine_id=routine.id,
            title=routine.title,
            source=ur.source,
            assigned_at=ur.assigned_at.isoformat(),
        ),
        "message": "ok",
    }
```

### 3.4 `PATCH /routines/{user_routine_id}/complete` — 완료 처리

```python
@router.patch("/{user_routine_id}/complete", response_model=SuccessResponse[RoutineCompleteResponse])
async def complete_routine(
    user_routine_id: str,
    body: RoutineCompleteRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # UserRoutine 조회
    ur_result = await db.execute(
        select(UserRoutine).where(UserRoutine.id == uuid.UUID(user_routine_id))
    )
    ur = ur_result.scalar_one_or_none()
    if not ur:
        raise HTTPException(
            status_code=404,
            detail={"code": "USER_ROUTINE_NOT_FOUND", "message": "존재하지 않는 루틴입니다"},
        )
    if ur.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": "UNAUTHORIZED", "message": "본인의 루틴만 수정할 수 있습니다"},
        )

    today = date.today()
    now = datetime.now(timezone.utc)

    # 오늘 이미 완료 처리된 경우 409
    log_result = await db.execute(
        select(RoutineLog).where(
            RoutineLog.user_routine_id == ur.id,
            RoutineLog.completed_date == today,
        )
    )
    existing_log = log_result.scalar_one_or_none()
    if existing_log:
        raise HTTPException(
            status_code=409,
            detail={"code": "ROUTINE_ALREADY_COMPLETED_TODAY", "message": "오늘 이미 완료 처리된 루틴입니다"},
        )

    # RoutineLog 삽입
    log = RoutineLog(
        user_routine_id=ur.id,
        completed_date=today,
        created_at=now,
    )
    db.add(log)
    await db.commit()

    return {
        "success": True,
        "data": RoutineCompleteResponse(
            user_routine_id=str(ur.id),
            completed=body.completed,
            logged_at=now.isoformat(),
        ),
        "message": "ok",
    }
```

### 3.5 `DELETE /routines/{user_routine_id}` — 루틴 삭제

```python
@router.delete("/{user_routine_id}", response_model=SuccessResponse[None])
async def delete_routine(
    user_routine_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ur_result = await db.execute(
        select(UserRoutine).where(UserRoutine.id == uuid.UUID(user_routine_id))
    )
    ur = ur_result.scalar_one_or_none()
    if not ur:
        raise HTTPException(
            status_code=404,
            detail={"code": "USER_ROUTINE_NOT_FOUND", "message": "존재하지 않는 루틴입니다"},
        )
    if ur.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail={"code": "UNAUTHORIZED", "message": "본인의 루틴만 삭제할 수 있습니다"},
        )

    ur.is_active = False
    await db.commit()

    return {
        "success": True,
        "data": None,
        "message": "루틴이 삭제되었습니다.",
    }
```

---

## 4. `main.py` 수정

```python
# 추가 import
from app.api.v1 import routines as routines_router

# 라우터 등록 (기존 라우터들 다음에)
app.include_router(routines_router.router, prefix="/v1")
```

에러 핸들러 추가 불필요 — Phase 6 에러는 모두 HTTPException으로 직접 처리.

---

## 5. 라우터 정의 순서

```
# routines.py 내 정의 순서 (충돌 방지)
GET  /me                          ← 먼저 정의
POST /me                          ← 먼저 정의
PATCH /{user_routine_id}/complete ← 뒤에 정의
DELETE /{user_routine_id}         ← 뒤에 정의
```

`/me`가 UUID 패턴 `/{user_routine_id}`보다 먼저 정의되어야 "me"가 UUID로 파싱되는 충돌 방지.

---

## 6. 검증 시나리오

| # | 시나리오 | 기대 결과 |
|---|---------|---------|
| 1 | GET /routines/me — 초기 루틴 있는 사용자 | routines 배열 반환, is_completed_today=false |
| 2 | POST /routines/me — 유효한 routine_id | 201, source="manual" |
| 3 | POST /routines/me — 이미 활성화된 루틴 | 409 ROUTINE_ALREADY_ASSIGNED |
| 4 | POST /routines/me — 존재하지 않는 routine_id | 404 ROUTINE_NOT_FOUND |
| 5 | PATCH /{id}/complete — 정상 완료 | 200, routine_logs 삽입 |
| 6 | PATCH /{id}/complete — 오늘 이미 완료 | 409 ROUTINE_ALREADY_COMPLETED_TODAY |
| 7 | PATCH /{id}/complete — 타인 루틴 | 403 UNAUTHORIZED |
| 8 | GET /routines/me — 완료 후 재조회 | is_completed_today=true |
| 9 | DELETE /{id} — 정상 삭제 | 200, is_active=False |
| 10 | DELETE /{id} — 삭제 후 GET /me | 해당 루틴 미반환 |
| 11 | 인증 없이 접근 | 401 |

---

## 7. 구현 순서 (체크리스트)

```
[ ] 1. app/schemas/routine.py  (스키마 6종)
[ ] 2. app/api/v1/routines.py  (엔드포인트 4개, 순서 주의)
[ ] 3. app/main.py 수정        (라우터 등록)
[ ] 4. 검증 시나리오 실행
```
