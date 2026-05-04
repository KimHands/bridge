# [Plan] Phase 1 — 인프라 환경 구성

> 작성일: 2026-04-13
> Phase: 1 / 8
> 상태: Plan
> 담당: Bridge 개발팀

---

## 1. 목표 (Goal)

Bridge 백엔드 서비스의 로컬 개발 환경을 완성한다.  
이 Phase가 완료되면 FastAPI 서버, PostgreSQL DB, Redis 캐시가 Docker Compose로 한 번에 기동되고,  
전체 스키마 테이블과 감정 키워드 시드 데이터가 DB에 적재된 상태가 된다.

---

## 2. 범위 (Scope)

### 포함 (In Scope)

| # | 항목 | 설명 |
|---|------|------|
| 1 | Docker Compose 구성 | api / db (PostgreSQL 16) / redis (Redis 7) 3-서비스 구성 |
| 2 | FastAPI 앱 골격 | 프로젝트 디렉토리 구조, main.py, 의존성 설치 (requirements.txt) |
| 3 | SQLAlchemy 2.0 Async 모델 | CLAUDE.md의 10개 핵심 테이블 ORM 모델 정의 |
| 4 | Alembic 마이그레이션 | 초기 마이그레이션 생성 및 DB 적용 |
| 5 | 감정 키워드 시드 데이터 | 8개 emotion_keywords 레코드 삽입 |
| 6 | 환경 변수 관리 | .env 파일 + pydantic-settings 기반 config |

### 제외 (Out of Scope)

- 인증 API 구현 (Phase 2)
- 비즈니스 로직 (Phase 3~8)
- 클라우드 배포 (Phase 9)

---

## 3. 핵심 요구사항 (Requirements)

### 3.1 Docker Compose

- 서비스: `api`, `db`, `redis`
- `api`는 `db`와 `redis`가 healthy 상태가 된 후 시작 (`depends_on` + healthcheck)
- 볼륨: PostgreSQL 데이터 영속화 (`pgdata`)
- 포트 매핑: api=8000, db=5432, redis=6379

### 3.2 프로젝트 구조

```
backend/
├── app/
│   ├── main.py               # FastAPI 앱 엔트리포인트
│   ├── core/
│   │   ├── config.py         # pydantic-settings 환경 변수
│   │   └── database.py       # SQLAlchemy async engine + session
│   ├── models/               # ORM 모델 (테이블별 파일)
│   │   ├── base.py           # Base, TimestampMixin
│   │   ├── user.py
│   │   ├── assessment.py
│   │   ├── diary.py
│   │   ├── keyword.py        # emotion_keywords, diary_emotion_keywords, situation_keywords
│   │   ├── routine.py        # routines, user_routines, routine_logs
│   │   └── mission.py        # mission_points, trigger_logs
│   └── seeds/
│       └── emotion_keywords.py  # 시드 데이터 스크립트
├── alembic/
│   ├── alembic.ini
│   └── versions/
├── requirements.txt
├── Dockerfile
└── .env.example
```

### 3.3 DB 스키마 (10개 테이블)

CLAUDE.md 기준 테이블 전체 구현:

| 테이블 | 비고 |
|--------|------|
| `users` | email_hash (SHA-256), nickname, password_hash (bcrypt) |
| `assessments` | PHQ-9 결과 암호화 저장 (AES-256-GCM) |
| `diary_entries` | mood_score(1~5), memo 암호화, created_at |
| `emotion_keywords` | 8개 마스터 레코드 (name, description) |
| `diary_emotion_keywords` | diary_entries ↔ emotion_keywords 다대다 |
| `situation_keywords` | 감정별 세부 질문 답변 저장 |
| `routines` | 루틴 라이브러리 |
| `user_routines` | source: initial/trigger/manual |
| `routine_logs` | 루틴 완료 기록 |
| `trigger_logs` | cooldown_until 포함 |
| `mission_points` | 주간 점수 |

### 3.4 감정 키워드 시드

```python
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
```

---

## 4. 보안 요구사항

- `.env` 파일은 `.gitignore`에 반드시 포함
- DB 비밀번호, JWT 시크릿 등 민감 정보는 환경 변수로만 관리
- `email_hash`는 모델 레벨에서 SHA-256 적용 명시

---

## 5. 완료 기준 (Definition of Done)

| # | 체크 항목 |
|---|-----------|
| ☐ | `docker compose up` 한 번에 모든 서비스 기동 |
| ☐ | `http://localhost:8000/docs` FastAPI Swagger UI 접근 가능 |
| ☐ | `alembic upgrade head` 실행 후 10개 테이블 모두 생성됨 |
| ☐ | `emotion_keywords` 테이블에 8개 레코드 존재 |
| ☐ | `docker compose down -v` 후 재기동해도 정상 작동 |

---

## 6. 구현 순서 (Implementation Order)

```
1. backend/ 디렉토리 구조 및 requirements.txt 작성
2. Dockerfile 작성
3. docker-compose.yml 작성 (api + db + redis)
4. app/core/config.py — pydantic-settings 환경 변수
5. app/core/database.py — SQLAlchemy async engine
6. app/models/ — 모든 ORM 모델 정의
7. alembic 초기화 + env.py 설정
8. alembic revision --autogenerate + upgrade head
9. app/seeds/emotion_keywords.py — 시드 스크립트 작성
10. FastAPI main.py — lifespan 이벤트로 시드 실행
11. 완료 기준 검증
```

---

## 7. 의존성

### Python 패키지 (requirements.txt 예시)

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

## 8. 리스크

| 리스크 | 대응 |
|--------|------|
| asyncpg 버전 호환성 | SQLAlchemy 2.0 + asyncpg 조합 공식 문서 기준 버전 고정 |
| Docker healthcheck 타이밍 | PostgreSQL ready 확인 후 api 기동 (`pg_isready` 사용) |
| Alembic async 설정 복잡성 | `run_migrations_online` 함수에서 async engine 처리 |

---

## 참고 문서

- `docs/Bridge_시스템아키텍처.md` — 전체 구조
- `CLAUDE.md` — DB 테이블, 기술 스택, 보안 필수 규칙
