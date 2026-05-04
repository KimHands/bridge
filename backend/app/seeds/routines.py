from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.routine import Routine

ROUTINE_SEEDS = [
    # ── 1구간 전용 ──────────────────────────────────────────
    {
        "title": "취침 전 스트레칭 10분",
        "description": "잠들기 전 10분 가벼운 스트레칭",
        "target_keywords": ["sleep", "우울한", "무기력한"],
        "phq_tier_min": 1, "phq_tier_max": 1,
    },
    {
        "title": "하루 10분 산책",
        "description": "가벼운 야외 산책 10분",
        "target_keywords": ["academic", "financial", "relationship", "unknown", "짜증나는", "외로운"],
        "phq_tier_min": 1, "phq_tier_max": 1,
    },
    {
        "title": "오늘 잘한 일 1가지 적기",
        "description": "오늘 한 것 중 잘한 일 하나를 적어보세요",
        "target_keywords": ["future", "뿌듯한"],
        "phq_tier_min": 1, "phq_tier_max": 1,
    },
    {
        "title": "10분 독서",
        "description": "관심 있는 책 10분 읽기",
        "target_keywords": ["future", "평온한"],
        "phq_tier_min": 1, "phq_tier_max": 1,
    },
    {
        "title": "가벼운 스트레칭 10분",
        "description": "몸을 부드럽게 풀어주는 스트레칭",
        "target_keywords": ["physical", "무기력한"],
        "phq_tier_min": 1, "phq_tier_max": 1,
    },
    {
        "title": "물 2L 마시기",
        "description": "하루 종일 물 2L 채우기",
        "target_keywords": ["physical"],
        "phq_tier_min": 1, "phq_tier_max": 1,
    },
    # ── 1·2구간 공통 ──────────────────────────────────────
    {
        "title": "감정 일기 작성",
        "description": "오늘 느낀 감정을 짧게 일기로 기록하기",
        "target_keywords": ["sleep", "academic", "financial", "relationship", "unknown", "우울한", "무기력한", "초조한"],
        "phq_tier_min": 1, "phq_tier_max": 2,
    },
    {
        "title": "10분 혼자 산책",
        "description": "혼자 조용히 10분 걷기",
        "target_keywords": ["relationship", "외로운", "짜증나는"],
        "phq_tier_min": 1, "phq_tier_max": 2,
    },
    # ── 2구간 전용 ──────────────────────────────────────────
    {
        "title": "취침 전 4-7-8 호흡 5분",
        "description": "4초 들이쉬고 7초 참고 8초 내쉬기, 5분 반복",
        "target_keywords": ["sleep", "불안한", "초조한"],
        "phq_tier_min": 2, "phq_tier_max": 2,
    },
    {
        "title": "오늘 할 일 1가지만 적기",
        "description": "내일 꼭 해야 할 일 딱 하나만 적기",
        "target_keywords": ["academic", "초조한"],
        "phq_tier_min": 2, "phq_tier_max": 3,
    },
    {
        "title": "5분 마음 챙김 호흡",
        "description": "숨에 집중하며 5분 마음 챙김 호흡",
        "target_keywords": ["academic", "불안한", "초조한"],
        "phq_tier_min": 2, "phq_tier_max": 2,
    },
    {
        "title": "오늘 할 수 있는 일 1가지 적기",
        "description": "오늘 실제로 할 수 있는 작은 일 하나 적기",
        "target_keywords": ["future", "우울한", "무기력한"],
        "phq_tier_min": 2, "phq_tier_max": 2,
    },
    {
        "title": "5분 호흡 명상",
        "description": "편안한 자세로 5분 호흡에 집중하기",
        "target_keywords": ["future", "financial", "불안한"],
        "phq_tier_min": 2, "phq_tier_max": 2,
    },
    {
        "title": "가벼운 스트레칭 5분",
        "description": "5분 부드러운 전신 스트레칭",
        "target_keywords": ["physical", "무기력한"],
        "phq_tier_min": 2, "phq_tier_max": 2,
    },
    {
        "title": "물 충분히 마시기",
        "description": "하루에 충분한 물 마시기",
        "target_keywords": ["physical"],
        "phq_tier_min": 2, "phq_tier_max": 2,
    },
    # ── 3구간 전용 ──────────────────────────────────────────
    {
        "title": "2분 복식호흡",
        "description": "배를 이용한 깊은 복식호흡 2분",
        "target_keywords": ["sleep", "future", "financial", "unknown", "우울한", "불안한", "초조한"],
        "phq_tier_min": 3, "phq_tier_max": 3,
    },
    {
        "title": "감정 일기 한 줄 작성",
        "description": "오늘 감정 딱 한 줄만 적기",
        "target_keywords": ["relationship", "외로운", "짜증나는"],
        "phq_tier_min": 3, "phq_tier_max": 3,
    },
    {
        "title": "물 한 잔 마시기",
        "description": "지금 바로 물 한 잔 마시기",
        "target_keywords": ["physical", "무기력한"],
        "phq_tier_min": 3, "phq_tier_max": 3,
    },
    # ── 4구간 전용 (원인 무관 고정) ───────────────────────
    {
        "title": "물 한 잔 마시기",
        "description": "지금 바로 물 한 잔 마시기",
        "target_keywords": [],
        "phq_tier_min": 4, "phq_tier_max": 4,
    },
]


async def seed_routines(db: AsyncSession) -> None:
    """
    멱등 시드: title + phq_tier_min + phq_tier_max 조합으로 식별.
    재실행 시 description, target_keywords 를 시드 파일 기준으로 갱신.
    (ID 18, 19처럼 동일 title이 phq_tier로 구분되는 경우도 안전하게 처리)
    """
    changed = False
    for data in ROUTINE_SEEDS:
        result = await db.execute(
            select(Routine).where(
                Routine.title == data["title"],
                Routine.phq_tier_min == data["phq_tier_min"],
                Routine.phq_tier_max == data["phq_tier_max"],
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            if (
                existing.target_keywords != data["target_keywords"]
                or existing.description != data["description"]
            ):
                existing.target_keywords = data["target_keywords"]
                existing.description = data["description"]
                changed = True
        else:
            db.add(Routine(**data))
            changed = True

    if changed:
        await db.commit()
