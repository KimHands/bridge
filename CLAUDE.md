# Bridge — CLAUDE.md

## 프로젝트 개요

Bridge는 청년(19~34세) 디지털 정서 웰니스 플랫폼이다.
방치된 청년과 병원 사이의 다리 역할을 하며, 감정 기록·루틴 형성·자기 이해를 통해 정서적 안녕을 돕는다.

> **규제 포지셔닝**: 진단·치료 서비스가 아니다. "정보 제공 및 습관 형성 도구"로 포지셔닝한다. 의료기기 해당 없음.

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 모바일 클라이언트 | React Native (Expo SDK 51), TypeScript |
| 상태 관리 | Zustand |
| API 통신 | TanStack React Query v5 + Axios |
| 차트 | Victory Native |
| 백엔드 | FastAPI (Python 3.11) |
| ORM | SQLAlchemy 2.0 (async) + Alembic |
| 인증 라이브러리 | python-jose (JWT), passlib[bcrypt] |
| 암호화 라이브러리 | cryptography (AES-256-GCM) |
| 배치 스케줄러 | APScheduler |
| 트리거 워커 | Python (routine_trigger.py) |
| 메인 DB | PostgreSQL 16 |
| 캐시 / 세션 | Redis 7 |
| 인증 방식 | JWT (Access Token 1h, Refresh Token 14d) |
| 푸시 알림 | FCM (Android), APNs (iOS) |
| 컨테이너 | Docker Compose (api / db / redis) |
| 클라우드 | AWS EC2 t2.micro + RDS PostgreSQL + S3 |

---

## 폴더 구조

```
bridge/
├── backend/                  # FastAPI 백엔드 (Python 3.11)
│   ├── app/                  # 애플리케이션 코드 (api, core, models, schemas, ...)
│   ├── alembic/              # DB 마이그레이션
│   ├── entrypoint.sh         # 로컬 entrypoint
│   ├── entrypoint.prod.sh    # 운영 entrypoint (--workers 2)
│   ├── Dockerfile
│   └── requirements.txt
├── mobile/                   # React Native + Expo (TypeScript) 모바일 앱
│   ├── src/                  # 화면·컴포넌트·스토어·훅 (alias `@` → `./src`)
│   ├── assets/               # 폰트, 아이콘
│   ├── App.tsx               # 앱 부트스트랩
│   ├── babel.config.js
│   ├── tsconfig.json
│   ├── package.json
│   └── README.md             # 모바일 앱 개발 가이드 (구 HANDOFF.md)
├── docs/
│   ├── 01-plan/              # PDCA Plan 문서
│   ├── 02-design/            # PDCA Design 문서
│   ├── 03-analysis/          # PDCA Analysis 문서
│   ├── 04-report/            # PDCA Report 문서
│   ├── design/               # Figma 디자인 자산 (구 Figma/)
│   ├── prototype/            # HTML 프로토타입 (참고용, 구 prototype/)
│   ├── diagram/              # 다이어그램
│   └── Bridge_*.md           # 기획 문서 (PRD, API 명세, 시퀀스 등)
├── docker-compose.yml        # 로컬 개발 환경 (api + db + redis)
├── docker-compose.prod.yml   # 운영 환경 (api + redis, db는 RDS 사용)
└── CLAUDE.md
```

**모듈 경계 원칙**
- `backend/` 와 `mobile/` 는 완전히 독립된 프로젝트 (HTTP로만 통신)
- `mobile/` 는 자체 `node_modules` 와 `package.json` 를 가지며 폴더 위치와 무관하게 동작 (alias `@` → `./src`)
- PDCA 문서(`docs/01~04`)와 기획 문서(`docs/Bridge_*.md`)는 분리 — 기획 문서는 정적, PDCA 문서는 Phase별 누적

---

## 핵심 데이터 흐름

```
자가평가(PHQ-9) → 초기 루틴 프로파일 생성
     ↓
일기 작성 (이모지 → 감정 키워드 → 세부 질문 → 메모)
     ↓
mood_score + 감정 키워드 → routine_trigger.py (비동기)
     ↓
트리거 조건 충족 시 → user_routines 갱신
     ↓
주간/월간 리포트 + 미션 점수 적립
```

---

## DB 주요 테이블

```
users               -- 사용자 기본 정보 (email_hash, nickname)
assessments         -- PHQ-9 자가평가 결과
diary_entries       -- 일기 기록 (mood_score, 암호화 메모)
emotion_keywords    -- 감정 키워드 마스터
diary_emotion_keywords -- 일기-감정키워드 다대다
situation_keywords  -- 감정별 세부 질문 답변
routines            -- 루틴 라이브러리
user_routines       -- 사용자별 루틴 할당 (source: initial/trigger/manual)
routine_logs        -- 루틴 완료 기록
trigger_logs        -- 트리거 발동 이력 (cooldown_until 포함)
mission_points      -- 주간 미션 점수
```

---

## API 구조

Base URL: `https://api.bridge.app/v1`

| 모듈 | 주요 엔드포인트 |
|------|--------------|
| 인증 | POST /auth/register, /auth/login, /auth/refresh, /auth/logout |
| 자가평가 | POST /assessments, GET /assessments |
| 일기 | POST /diaries, GET /diaries, PATCH /diaries/:id |
| 키워드 | GET /keywords/emotions |
| 루틴 | GET /routines/me, POST /routines/me, PATCH /routines/:id/complete, DELETE /routines/:id |
| 리포트 | GET /reports/weekly, GET /reports/monthly |
| 미션 | GET /missions/weekly, GET /missions/total |
| 사용자 | GET /users/me, PATCH /users/me, DELETE /users/me |

---

## 보안 필수 규칙

- 모든 API 통신: HTTPS (TLS 1.3)
- 비밀번호: bcrypt (cost factor 12) 단방향 해시
- 이메일: SHA-256 해시 저장 (email_hash), 원문 별도 분리
- 일기 메모·자가평가 결과: AES-256-GCM 암호화 저장
- JWT 블랙리스트: Redis 관리
- 민감정보(정신건강 데이터): 일반 데이터와 물리적 분리

---

## 트리거 알고리즘 핵심 로직

```python
# 파일: routine_trigger.py
# 발동 조건: 최근 7일 중 동일 감정 키워드 3회 이상
# 가중치: mood_score 30% + 키워드 빈도 70%
# 쿨다운: 3일
# 충돌 처리: 복합 루틴 추천 (상위 2개 키워드 커버)

def calculate_trigger_score(diary_logs, days=7):
    recent_logs = diary_logs[-days:]
    keyword_freq = {}
    mood_avg = sum(l["mood_score"] for l in recent_logs) / len(recent_logs)

    for log in recent_logs:
        for keyword in log["emotion_keywords"]:
            keyword_freq[keyword] = keyword_freq.get(keyword, 0) + 1

    total_freq = sum(keyword_freq.values())
    trigger_scores = {}
    for keyword, freq in keyword_freq.items():
        mood_component = (5 - mood_avg) / 5 * 0.3
        keyword_component = (freq / total_freq) * 0.7
        trigger_scores[keyword] = mood_component + keyword_component

    return trigger_scores
```

---

## 감정 키워드 목록 (8개, 논문 근거)

| 키워드 | 근거 |
|--------|------|
| 우울한 | PHQ-9 핵심 증상 |
| 무기력한 | PHQ-9 에너지 저하 |
| 불안한 | GAD-7 핵심 증상 |
| 초조한 | PHQ-9·GAD-7 중개 증상 |
| 짜증나는 | GAD-7 과민성 |
| 외로운 | 청년 고립감 연구 |
| 뿌듯한 | 긍정 정서 |
| 평온한 | 긍정 정서 |

---

## PHQ-9 구간별 초기 루틴 배정 원칙

| 구간 | 점수 | 루틴 수 | 특이사항 |
|------|------|---------|---------|
| 1구간 | 0~4점 | 2개 | 산책 + 감정 일기 |
| 2구간 | 5~9점 | 2개 | 호흡 명상 + 감정 일기 |
| 3구간 | 10~19점 | 1개 | 최소 과제 (복식호흡 등) |
| 4구간 | 20~27점 | 1개 | 물 한 잔 마시기 (원인 무관 고정) |

---

## 미션 시스템 점수 규칙

```
주간 점수 = 루틴 달성 70% + 일기 작성 30% (각 구성요소 독립 적립)
구성요소별 최소 기준: 루틴 7일 중 3일+ → 루틴 점수, 일기 7일 중 3일+ → 일기 점수 적립
양쪽 미달 시: 0점 (차감 없음)
```

---

## 개발 진행 순서 (Phase)

| Phase | 기능 | 참조 문서 |
|-------|------|---------|
| 1 | Docker Compose 환경 + DB 스키마 + 키워드 시드 데이터 | ERD, 시스템 아키텍처 |
| 2 | Auth Service (회원가입·로그인·JWT·로그아웃) | API 명세서, 시퀀스 다이어그램 |
| 3 | 자가평가 API + 초기 루틴 배정 | PRD 섹션 3, API 명세서 |
| 4 | 일기 CRUD + AES-256-GCM 암호화 + 키워드 저장 | PRD 섹션 5, API 명세서 |
| 5 | routine_trigger.py + 비동기 실행 | 기능 설계 결정 문서 C섹션 |
| 6 | 루틴 관리 API (추가·삭제·완료 처리) | API 명세서 |
| 7 | 리포트 집계 API + 주간 배치 스케줄러 | PRD 섹션 7, API 명세서 |
| 8 | 미션 점수 시스템 | PRD 섹션 10, API 명세서 |

---

## 절대 하지 말아야 할 것

- LLM 기반 심리상담·진단 기능 구현 금지
- "치료", "진단", "개선", "효과" 표현 사용 금지 (의료적 의미)
- 사용자 정신건강 데이터 제3자 제공 금지
- 평문(Plain Text) 상태로 메모·평가지 DB 저장 금지
- PHQ-9 점수 수치를 사용자에게 직접 노출 금지
- 구간명("중등도 우울" 등) 의료 표현 사용자 노출 금지

---

## 규제 표현 가이드

| 금지 | 허용 |
|------|------|
| 치료 | 회복, 관리 |
| 진단 | 확인, 파악 |
| 개선 | 변화, 기록 |
| 중등도 우울 | 지금 조금 지쳐있는 것 같아요 |
| PHQ-9 점수 표시 | (수치 비노출) |

---

## 참고 문서 위치

모든 기획 문서는 `docs/` 폴더에 위치한다.

| 파일 | 내용 |
|------|------|
| docs/Bridge_PRD.md | 기능 명세서 전체 |
| docs/Bridge_API_명세서.md | API 엔드포인트 상세 |
| docs/Bridge_기능설계_결정문서.md | A~E 설계 결정 사항 |
| docs/Bridge_시스템아키텍처.md | 시스템 구조 |
| docs/Bridge_시퀀스다이어그램.md | 로그인·일기·JWT 갱신 흐름 |
| docs/Bridge_화면정의서.md | 화면별 구성 요소 |
| docs/Bridge_개인정보처리방침.md | 법적 의무 문서 |
