from fastapi import APIRouter

from app.schemas.auth import SuccessResponse

router = APIRouter(prefix="/keywords", tags=["keywords"])

KEYWORD_META = {
    "우울한": {
        "category": "negative",
        "question": "지금 가장 힘든 게 뭔가요?",
        "answers": [
            "아무것도 하기 싫고 의욕이 없어요",
            "나 자신이 쓸모없다는 느낌이 들어요",
            "미래가 막막하고 희망이 없어요",
            "이유를 모르겠어요",
        ],
    },
    "무기력한": {
        "category": "negative",
        "question": "무기력함이 느껴질 때 어떤 상황인가요?",
        "answers": [
            "몸이 너무 피곤해요",
            "아무것도 하기 싫어요",
            "의욕이 전혀 없어요",
            "그냥 다 귀찮아요",
        ],
    },
    "불안한": {
        "category": "negative",
        "question": "무엇 때문에 불안한가요?",
        "answers": [
            "미래나 진로가 불확실해요",
            "인간관계가 걱정돼요",
            "경제적으로 걱정이 많아요",
            "뭔가 나쁜 일이 일어날 것 같아요",
        ],
    },
    "초조한": {
        "category": "negative",
        "question": "무엇이 초조하게 만드나요?",
        "answers": [
            "해야 할 일이 너무 많아요",
            "시간이 부족해요",
            "결과가 나쁠까봐 걱정돼요",
            "주변 기대가 부담돼요",
        ],
    },
    "짜증나는": {
        "category": "negative",
        "question": "어떤 상황이 짜증나게 했나요?",
        "answers": [
            "사람들과 갈등이 있었어요",
            "일이 뜻대로 안 됐어요",
            "피곤한데 쉬지 못했어요",
            "별거 아닌 것에 예민해졌어요",
        ],
    },
    "외로운": {
        "category": "negative",
        "question": "외로움이 느껴진 이유가 있나요?",
        "answers": [
            "혼자 있는 시간이 너무 길었어요",
            "주변에 이해받지 못하는 것 같아요",
            "친한 사람과 연락이 뜸해졌어요",
            "그냥 혼자인 게 싫어요",
        ],
    },
    "뿌듯한": {
        "category": "positive",
        "question": "오늘 어떤 일이 뿌듯했나요?",
        "answers": [
            "목표한 걸 해냈어요",
            "다른 사람을 도왔어요",
            "오래 미뤘던 걸 했어요",
            "그냥 하루를 잘 보낸 것 같아요",
        ],
    },
    "평온한": {
        "category": "positive",
        "question": "오늘 무엇이 마음을 편안하게 했나요?",
        "answers": [
            "좋아하는 걸 하며 보냈어요",
            "조용히 혼자 있었어요",
            "자연이나 산책을 즐겼어요",
            "아무 걱정 없이 쉬었어요",
        ],
    },
}

HIGHLIGHTS_BY_MOOD = {
    "1": ["우울한", "무기력한"],
    "2": ["불안한", "외로운"],
    "3": ["초조한", "짜증나는"],
    "4": ["평온한", "뿌듯한"],
    "5": ["뿌듯한", "평온한"],
}


@router.get("/emotions", response_model=SuccessResponse[dict])
async def get_emotion_keywords():
    keywords = [
        {
            "name": name,
            "category": meta["category"],
            "question": meta["question"],
            "answers": meta["answers"],
        }
        for name, meta in KEYWORD_META.items()
    ]
    return {
        "success": True,
        "data": {
            "keywords": keywords,
            "highlights_by_mood": HIGHLIGHTS_BY_MOOD,
        },
        "message": "ok",
    }
