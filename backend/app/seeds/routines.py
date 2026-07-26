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
    # ── 긍정 강화(트리거 전용, tier 1-3) ──────────────────
    {
        "title": "오늘 뿌듯했던 순간 떠올려 메모하기",
        "description": "오늘 뿌듯했던 순간을 떠올려 짧게 메모해보세요",
        "target_keywords": ["뿌듯한"],
        "phq_tier_min": 1, "phq_tier_max": 3,
    },
    {
        "title": "좋아하는 음악 한 곡 듣기",
        "description": "마음이 편안해지는 음악을 한 곡 들어보세요",
        "target_keywords": ["평온한"],
        "phq_tier_min": 1, "phq_tier_max": 3,
    },
]


# effort_level=1(최소 부담) 루틴 title — 저에너지(무기력·우울) 트랙 전용 (B4).
# 활성화 에너지가 거의 없는 1~2분 과제(물·호흡·한 줄 기록·음악)로 한정한다.
MINIMAL_EFFORT_TITLES = frozenset(
    {
        "오늘 잘한 일 1가지 적기",
        "물 2L 마시기",
        "취침 전 4-7-8 호흡 5분",
        "오늘 할 일 1가지만 적기",
        "5분 마음 챙김 호흡",
        "오늘 할 수 있는 일 1가지 적기",
        "5분 호흡 명상",
        "물 충분히 마시기",
        "2분 복식호흡",
        "감정 일기 한 줄 작성",
        "물 한 잔 마시기",
        "좋아하는 음악 한 곡 듣기",
    }
)


def _effort_for(title: str) -> int:
    return 1 if title in MINIMAL_EFFORT_TITLES else 2


async def seed_routines(db: AsyncSession) -> None:
    """
    멱등 시드: title + phq_tier_min + phq_tier_max 조합으로 식별.
    재실행 시 description, target_keywords, effort_level 을 시드 파일 기준으로 갱신.
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
        effort = _effort_for(data["title"])

        if existing:
            if (
                existing.target_keywords != data["target_keywords"]
                or existing.description != data["description"]
                or existing.effort_level != effort
            ):
                existing.target_keywords = data["target_keywords"]
                existing.description = data["description"]
                existing.effort_level = effort
                changed = True
        else:
            db.add(Routine(**data, effort_level=effort))
            changed = True

    if changed:
        await db.commit()
