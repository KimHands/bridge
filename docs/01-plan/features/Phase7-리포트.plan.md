# Plan: Phase7-리포트

## 개요

리포트 집계 API와 APScheduler 주간 배치 스케줄러를 구현한다.
사용자의 일기·루틴 데이터를 집계해 주간/월간 리포트와 감정 추이를 제공한다.

## 목표

- GET /reports/weekly — 주간 리포트 (루틴 달성률, 기분 평균, TOP 키워드)
- GET /reports/monthly — 월간 리포트 (루틴 달성률, 기분 추이, 감정 키워드 분포)
- GET /reports/mood-trend — 기간별 감정 추이
- APScheduler 주간 배치 — 매주 월요일 자정 mission_points 집계

## 범위

### 포함

1. **주간 리포트 API** (`GET /reports/weekly?date=YYYY-MM-DD`)
   - week_start, week_end 계산 (월요일~일요일)
   - routine_completion_rate: 해당 주 루틴 달성 일수 / 7
   - mood_average: 해당 주 diary_entries.mood_score 평균
   - mood_scores: 7일치 배열 (미기록일 null)
   - top_emotion_keywords: 해당 주 diary_emotion_keywords 빈도 TOP 3
   - top_situation_keywords: 해당 주 situation_keywords.answer_text 빈도 TOP 3
   - diary_count: 해당 주 일기 작성 수

2. **월간 리포트 API** (`GET /reports/monthly?year=YYYY&month=MM`)
   - routine_completion_rate: 해당 월 루틴 달성률
   - mood_average: 해당 월 mood_score 평균
   - mood_trend: 날짜별 mood_score 배열 (미기록일 제외)
   - emotion_keyword_distribution: 감정 키워드별 빈도 딕셔너리
   - diary_count: 해당 월 일기 수

3. **감정 추이 API** (`GET /reports/mood-trend?from=YYYY-MM-DD&to=YYYY-MM-DD`)
   - 지정 기간 diary_entries.mood_score 날짜별 목록

4. **APScheduler 주간 배치**
   - 매주 월요일 00:05 KST 실행
   - 전 주 데이터로 mission_points 테이블 Upsert
   - 점수 계산: 루틴 달성 70% + 일기 작성 30%

### 제외

- 리포트 Push 알림 (Phase 추가 검토 사항)
- 데이터 부족 시 N일 남음 계산은 diary_count로 클라이언트가 처리

## 사용 모델·테이블

| 테이블 | 역할 |
|--------|------|
| diary_entries | mood_score, recorded_date |
| diary_emotion_keywords | 감정 키워드 매핑 |
| situation_keywords | 상황 키워드 answer_text |
| emotion_keywords | 키워드 이름 |
| routine_logs | 루틴 완료 기록 (completed_date) |
| user_routines | 활성 루틴 목록 |
| mission_points | 주간 점수 (배치 Upsert 대상) |

## 구현 파일 목록

```
backend/app/
├── schemas/report.py          # 요청/응답 Pydantic 스키마
├── api/v1/reports.py          # 3개 엔드포인트
├── scheduler.py               # APScheduler 설정 + 배치 잡
└── main.py                    # 스케줄러 lifespan 연결
```

## 의존성

- `apscheduler>=3.10` — 배치 스케줄러 (requirements.txt 추가)
- 기존 AsyncSession, get_current_user 재사용

## 핵심 제약

- 루틴 달성률 계산 기준: 활성 루틴(is_active=True) 할당 기준이 아닌, 해당 주 routine_logs 기록 수 / (활성 루틴 수 × 7)
- mood_scores 7일 배열: 기록 없는 날은 null 처리
- 배치 실행 시각: KST 기준 월요일 00:05 (UTC 일요일 15:05)
- mission_points Upsert: week_start UNIQUE 제약 활용

## 완료 기준

- [ ] 주간 리포트 API: 응답 스키마 100% 일치
- [ ] 월간 리포트 API: 응답 스키마 100% 일치
- [ ] 감정 추이 API: 응답 스키마 100% 일치
- [ ] APScheduler 배치: Docker 재시작 후 자동 등록 확인
- [ ] 데이터 없는 주: 빈 값(0, null, []) 정상 반환

## 참고 문서

- docs/Bridge_PRD.md — 섹션 7 리포트 탭
- docs/Bridge_API_명세서.md — 섹션 8 리포트, 섹션 10 미션 (배치 연계)
