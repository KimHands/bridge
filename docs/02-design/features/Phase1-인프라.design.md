# [Design] Phase 1 — 인프라 환경 구성

> 작성일: 2026-04-13
> Phase: 1 / 8
> 상태: Design
> 참조: `docs/01-plan/features/Phase1-인프라.plan.md`

---

## 1. 디렉토리 구조 (최종)

```
bridge/
└── backend/
    ├── app/
    │   ├── main.py
    │   ├── core/
    │   │   ├── config.py
    │   │   └── database.py
    │   ├── models/
    │   │   ├── __init__.py
    │   │   ├── base.py
    │   │   ├── user.py
    │   │   ├── assessment.py
    │   │   ├── diary.py
    │   │   ├── keyword.py
    │   │   ├── routine.py
    │   │   └── mission.py
    │   └── seeds/
    │       ├── __init__.py
    │       └── emotion_keywords.py
    ├── alembic/
    │   ├── env.py
    │   ├── script.py.mako
    │   └── versions/
    ├── alembic.ini
    ├── requirements.txt
    ├── Dockerfile
    ├── .env.example
    └── .gitignore
docker-compose.yml
```

---

## 2. docker-compose.yml

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-bridge}
      POSTGRES_USER: ${POSTGRES_USER:-bridge}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-bridge_secret}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-bridge}"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 10

  api:
    build:
      context: ./backend
      dockerfile: Dockerfile
    env_file:
      - ./backend/.env
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

volumes:
  pgdata:
```

---

## 3. backend/Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## 4. backend/requirements.txt

```
fastapi==0.111.0
uvicorn[standard]==0.30.1
sqlalchemy[asyncio]==2.0.30
alembic==1.13.1
asyncpg==0.29.0
redis[hiredis]==5.0.4
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
cryptography==42.0.7
pydantic-settings==2.3.1
python-dotenv==1.0.1
apscheduler==3.10.4
```

---

## 5. 환경 변수 설계

### backend/.env.example

```
# Database
DATABASE_URL=postgresql+asyncpg://bridge:bridge_secret@db:5432/bridge
POSTGRES_DB=bridge
POSTGRES_USER=bridge
POSTGRES_PASSWORD=bridge_secret

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY=change_this_to_a_strong_random_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=14

# Encryption (AES-256-GCM) — 32 bytes base64
ENCRYPTION_KEY=base64_encoded_32_bytes_key_here

# App
APP_ENV=development
APP_DEBUG=true
```

### app/core/config.py

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    database_url: str
    redis_url: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 14

    encryption_key: str

    app_env: str = "development"
    app_debug: bool = True

settings = Settings()
```

---

## 6. app/core/database.py

```python
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=settings.app_debug,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
```

---

## 7. ORM 모델 상세 설계

### 7.1 app/models/base.py

```python
from datetime import datetime, UTC
from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )
```

### 7.2 app/models/user.py — `users` 테이블

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK, default uuid4 | 사용자 ID |
| `email_hash` | VARCHAR(64) | UNIQUE, NOT NULL | SHA-256 해시 |
| `password_hash` | VARCHAR(60) | NOT NULL | bcrypt(cost=12) |
| `nickname` | VARCHAR(20) | NOT NULL | 표시 이름 |
| `is_active` | BOOLEAN | NOT NULL, default True | 활성 상태 |
| `created_at` | TIMESTAMPTZ | NOT NULL | 생성일시 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 수정일시 |

```python
import uuid
from sqlalchemy import String, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(60), nullable=False)
    nickname: Mapped[str] = mapped_column(String(20), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
```

### 7.3 app/models/assessment.py — `assessments` 테이블

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 평가 ID |
| `user_id` | UUID | FK(users.id), NOT NULL | 사용자 |
| `encrypted_result` | TEXT | NOT NULL | AES-256-GCM 암호화된 PHQ-9 결과 JSON |
| `phq_tier` | SMALLINT | NOT NULL | 구간 1~4 (내부용, 클라이언트 비노출) |
| `created_at` | TIMESTAMPTZ | NOT NULL | |

```python
import uuid
from sqlalchemy import SmallInteger, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class Assessment(Base, TimestampMixin):
    __tablename__ = "assessments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    encrypted_result: Mapped[str] = mapped_column(Text, nullable=False)
    phq_tier: Mapped[int] = mapped_column(SmallInteger, nullable=False)
```

### 7.4 app/models/diary.py — `diary_entries` 테이블

| 컬럼 | 타입 | 제약 | 설명 |
|------|------|------|------|
| `id` | UUID | PK | 일기 ID |
| `user_id` | UUID | FK(users.id) | 사용자 |
| `mood_score` | SMALLINT | NOT NULL, 1~5 | 이모지 점수 |
| `encrypted_memo` | TEXT | NULLABLE | AES-256-GCM 암호화 메모 |
| `recorded_date` | DATE | NOT NULL | 기록 날짜 (중복 방지용) |
| `created_at` | TIMESTAMPTZ | NOT NULL | |
| `updated_at` | TIMESTAMPTZ | NOT NULL | |

```python
import uuid
from datetime import date
from sqlalchemy import SmallInteger, Text, Date, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class DiaryEntry(Base, TimestampMixin):
    __tablename__ = "diary_entries"
    __table_args__ = (UniqueConstraint("user_id", "recorded_date", name="uq_diary_user_date"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    mood_score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    encrypted_memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    recorded_date: Mapped[date] = mapped_column(Date, nullable=False)
```

### 7.5 app/models/keyword.py — 키워드 3개 테이블

#### `emotion_keywords`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | SERIAL | PK |
| `name` | VARCHAR(20) | UNIQUE, 키워드 이름 |
| `description` | VARCHAR(100) | 근거 설명 |

#### `diary_emotion_keywords` (다대다 연결)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `diary_id` | UUID | FK(diary_entries.id) |
| `keyword_id` | INTEGER | FK(emotion_keywords.id) |
| PK | (diary_id, keyword_id) | 복합 PK |

#### `situation_keywords`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `diary_id` | UUID | FK(diary_entries.id) |
| `keyword_id` | INTEGER | FK(emotion_keywords.id) |
| `answer_text` | VARCHAR(100) | 선택한 상황 답변 |

```python
import uuid
from sqlalchemy import Integer, String, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class EmotionKeyword(Base):
    __tablename__ = "emotion_keywords"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    description: Mapped[str] = mapped_column(String(100), nullable=False)

class DiaryEmotionKeyword(Base):
    __tablename__ = "diary_emotion_keywords"

    diary_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("diary_entries.id", ondelete="CASCADE"), primary_key=True)
    keyword_id: Mapped[int] = mapped_column(Integer, ForeignKey("emotion_keywords.id", ondelete="CASCADE"), primary_key=True)

class SituationKeyword(Base, TimestampMixin):
    __tablename__ = "situation_keywords"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    diary_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("diary_entries.id", ondelete="CASCADE"), nullable=False)
    keyword_id: Mapped[int] = mapped_column(Integer, ForeignKey("emotion_keywords.id"), nullable=False)
    answer_text: Mapped[str] = mapped_column(String(100), nullable=False)
```

### 7.6 app/models/routine.py — 루틴 3개 테이블

#### `routines` (라이브러리)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | INTEGER | PK, autoincrement |
| `title` | VARCHAR(50) | 루틴 이름 |
| `description` | TEXT | 설명 |
| `target_keywords` | ARRAY(VARCHAR) | 해당 감정 키워드 목록 |
| `phq_tier_min` | SMALLINT | 적용 최소 구간 |
| `phq_tier_max` | SMALLINT | 적용 최대 구간 |

#### `user_routines`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `user_id` | UUID | FK(users.id) |
| `routine_id` | INTEGER | FK(routines.id) |
| `source` | VARCHAR(10) | initial / trigger / manual |
| `is_active` | BOOLEAN | 활성 여부 |
| `assigned_at` | TIMESTAMPTZ | 배정 일시 |

#### `routine_logs`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `user_routine_id` | UUID | FK(user_routines.id) |
| `completed_date` | DATE | 완료 날짜 |
| `created_at` | TIMESTAMPTZ | |

```python
import uuid
from datetime import date, datetime
from sqlalchemy import Integer, SmallInteger, String, Text, Boolean, Date, DateTime, ForeignKey, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class Routine(Base):
    __tablename__ = "routines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    target_keywords: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    phq_tier_min: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=1)
    phq_tier_max: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=4)

class UserRoutine(Base, TimestampMixin):
    __tablename__ = "user_routines"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    routine_id: Mapped[int] = mapped_column(Integer, ForeignKey("routines.id"), nullable=False)
    source: Mapped[str] = mapped_column(String(10), nullable=False)  # initial / trigger / manual
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

class RoutineLog(Base):
    __tablename__ = "routine_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_routine_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("user_routines.id", ondelete="CASCADE"), nullable=False)
    completed_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

### 7.7 app/models/mission.py — 미션·트리거 2개 테이블

#### `mission_points`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `user_id` | UUID | FK(users.id) |
| `week_start` | DATE | 주간 시작일 (월요일) |
| `routine_score` | SMALLINT | 루틴 달성 점수 (0~70) |
| `diary_score` | SMALLINT | 일기 작성 점수 (0~30) |
| `total_score` | SMALLINT | 합계 (0~100) |

#### `trigger_logs`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID | PK |
| `user_id` | UUID | FK(users.id) |
| `triggered_keyword` | VARCHAR(20) | 발동된 감정 키워드 |
| `routine_id` | INTEGER | FK(routines.id) — 배정된 루틴 |
| `cooldown_until` | TIMESTAMPTZ | 쿨다운 만료 시각 (3일) |
| `created_at` | TIMESTAMPTZ | |

```python
import uuid
from datetime import date, datetime
from sqlalchemy import Integer, SmallInteger, String, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin

class MissionPoint(Base, TimestampMixin):
    __tablename__ = "mission_points"
    __table_args__ = (UniqueConstraint("user_id", "week_start"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    routine_score: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    diary_score: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    total_score: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)

class TriggerLog(Base, TimestampMixin):
    __tablename__ = "trigger_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    triggered_keyword: Mapped[str] = mapped_column(String(20), nullable=False)
    routine_id: Mapped[int] = mapped_column(Integer, ForeignKey("routines.id"), nullable=False)
    cooldown_until: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
```

---

## 8. app/models/__init__.py

모든 모델을 임포트하여 Alembic이 자동 감지하도록 한다.

```python
from app.models.base import Base
from app.models.user import User
from app.models.assessment import Assessment
from app.models.diary import DiaryEntry
from app.models.keyword import EmotionKeyword, DiaryEmotionKeyword, SituationKeyword
from app.models.routine import Routine, UserRoutine, RoutineLog
from app.models.mission import MissionPoint, TriggerLog

__all__ = [
    "Base",
    "User", "Assessment", "DiaryEntry",
    "EmotionKeyword", "DiaryEmotionKeyword", "SituationKeyword",
    "Routine", "UserRoutine", "RoutineLog",
    "MissionPoint", "TriggerLog",
]
```

---

## 9. Alembic 설정

### alembic.ini 핵심 설정

```ini
[alembic]
script_location = alembic
sqlalchemy.url = driver://user:pass@localhost/dbname  # env.py에서 override
```

### alembic/env.py 핵심 부분

```python
import asyncio
from logging.config import fileConfig
from sqlalchemy.ext.asyncio import create_async_engine
from alembic import context
from app.core.config import settings
from app.models import Base  # 모든 모델 임포트

config = context.config
fileConfig(config.config_file_name)
target_metadata = Base.metadata

def run_migrations_online():
    connectable = create_async_engine(settings.database_url)

    async def do_run():
        async with connectable.connect() as connection:
            await connection.run_sync(
                context.configure,
                target_metadata=target_metadata,
                compare_type=True,
            )
            async with connection.begin():
                await connection.run_sync(context.run_migrations)

    asyncio.run(do_run())

run_migrations_online()
```

---

## 10. 시드 스크립트

### app/seeds/emotion_keywords.py

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.keyword import EmotionKeyword

EMOTION_KEYWORDS = [
    {"name": "우울한",   "description": "PHQ-9 핵심 증상"},
    {"name": "무기력한", "description": "PHQ-9 에너지 저하"},
    {"name": "불안한",   "description": "GAD-7 핵심 증상"},
    {"name": "초조한",   "description": "PHQ-9·GAD-7 중개 증상"},
    {"name": "짜증나는", "description": "GAD-7 과민성"},
    {"name": "외로운",   "description": "청년 고립감 연구"},
    {"name": "뿌듯한",   "description": "긍정 정서"},
    {"name": "평온한",   "description": "긍정 정서"},
]

async def seed_emotion_keywords(db: AsyncSession) -> None:
    result = await db.execute(select(EmotionKeyword))
    if result.scalars().first():
        return  # 이미 존재하면 skip

    for data in EMOTION_KEYWORDS:
        db.add(EmotionKeyword(**data))
    await db.commit()
```

---

## 11. app/main.py

```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.core.database import AsyncSessionLocal
from app.seeds.emotion_keywords import seed_emotion_keywords

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as db:
        await seed_emotion_keywords(db)
    yield

app = FastAPI(
    title="Bridge API",
    version="1.0.0",
    lifespan=lifespan,
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}
```

---

## 12. .gitignore 핵심 항목

```
.env
__pycache__/
*.pyc
.pytest_cache/
```

---

## 13. 검증 포인트

| # | 검증 방법 | 기대 결과 |
|---|-----------|-----------|
| 1 | `docker compose up` | 3개 컨테이너 모두 healthy |
| 2 | `GET http://localhost:8000/health` | `{"status": "ok"}` |
| 3 | `GET http://localhost:8000/docs` | Swagger UI 표시 |
| 4 | `docker exec -it bridge-db-1 psql -U bridge -c "\dt"` | 11개 테이블 목록 |
| 5 | `SELECT * FROM emotion_keywords;` | 8개 레코드 |
