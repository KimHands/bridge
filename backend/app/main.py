from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings

from app.api.v1 import assessments as assessments_router
from app.api.v1 import auth as auth_router
from app.api.v1 import chat as chat_router
from app.api.v1 import diaries as diaries_router
from app.api.v1 import keywords as keywords_router
from app.api.v1 import missions as missions_router
from app.api.v1 import notifications as notifications_router
from app.api.v1 import reports as reports_router
from app.api.v1 import routines as routines_router
from app.api.v1 import users as users_router
from app.core.database import AsyncSessionLocal
from app.scheduler import scheduler
from app.seeds.emotion_keywords import seed_emotion_keywords
from app.seeds.routines import seed_routines


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with AsyncSessionLocal() as db:
        await seed_emotion_keywords(db)
        await seed_routines(db)
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(
    title="Bridge API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — 모바일/웹 클라이언트 프리플라이트 허용.
# 인증은 Authorization 헤더 기반이라 credentials(쿠키) 불필요 → allow_credentials=False.
_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    first = errors[0] if errors else {}
    error_type = first.get("type", "")
    loc = first.get("loc", [])
    field = loc[-1] if loc else "unknown"

    raw_msg = first.get("msg", "입력값이 올바르지 않습니다").replace("Value error, ", "")

    if error_type == "missing":
        code = "MISSING_REQUIRED_FIELD"
        message = f"필수 입력값이 누락되었습니다: {field}"
    elif field in ("phq9_answers",):
        code = "INVALID_PHQ9_ANSWERS"
        message = raw_msg
    elif field in ("primary_cause", "secondary_cause"):
        code = "INVALID_CAUSE_CODE"
        message = raw_msg
    elif field == "password":
        code = "INVALID_PASSWORD_FORMAT"
        message = raw_msg
    elif field == "mood_score":
        code = "INVALID_MOOD_SCORE"
        message = raw_msg
    elif field == "emotion_keywords":
        code = "TOO_MANY_EMOTION_KEYWORDS"
        message = raw_msg
    elif field == "memo":
        code = "MEMO_TOO_LONG"
        message = raw_msg
    else:
        code = "INVALID_FIELD"
        message = raw_msg

    return JSONResponse(
        status_code=422,
        content={"success": False, "error": {"code": code, "message": message}},
    )


app.include_router(auth_router.router, prefix="/v1")
app.include_router(assessments_router.router, prefix="/v1")
app.include_router(chat_router.router, prefix="/v1")
app.include_router(diaries_router.router, prefix="/v1")
app.include_router(keywords_router.router, prefix="/v1")
app.include_router(routines_router.router, prefix="/v1")
app.include_router(missions_router.router, prefix="/v1")
app.include_router(notifications_router.router, prefix="/v1")
app.include_router(reports_router.router, prefix="/v1")
app.include_router(users_router.router, prefix="/v1")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
