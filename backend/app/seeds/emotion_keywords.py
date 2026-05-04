from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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
