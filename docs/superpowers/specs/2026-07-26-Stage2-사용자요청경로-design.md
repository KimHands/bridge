# Stage 2 — 사용자 요청 경로(On-Demand 루틴) 설계

> 작성: 2026-07-26 · 상태: 승인됨(브레인스토밍) → 구현 플랜 대상
> 근거: `참고파일/2026-07-22_리서치_Stage2_레이트리밋.md`, `참고파일/2026-07-22_문헌정리_통합.md`, 트리거 재설계 `docs/02-design/2026-07-21-트리거-재설계.design.md`
> 의존: B4 최소과제 트랙(`Routine.effort_level`, `is_minimal_task_track`) — 본 기능이 재사용.

## Goal
사용자가 힘들다고 느낄 때 **직접 대처 루틴을 요청**할 수 있는 경로를 추가한다. 자동 트리거(일기 저장 시, 게이트 통과)와 달리 **사용자 명시 요청**이므로 게이트를 우회하되, 과의존을 막는 **soft 레이트리밋**과 위기 안전을 둔다. 근거: JMIR 2025 MRT에서 "직접 요청(support-need)" 발동이 타이밍·도움됨 최고 평가.

## 핵심 설계 결정 (브레인스토밍 확정)
1. **위기 분기 = 사용자 자기선택 2단계.** 앱은 위기를 판단하지 않는다(비임상 규제 보호).
2. **게이트(G1~G5) 우회.** 사용자 명시 요청이므로 mood 게이트·후보·주간상한 미적용.
3. **레이트리밋 = Redis 원자 카운터(INCR+TTL).** TOCTOU 경합 원천 차단.
4. **루틴 선정 = 최근 맥락 자동.** 최근 7일 지배 키워드 → 저에너지면 최소과제 트랙(B4) → 없으면 기본 감정안정 세트 폴백.

## 아키텍처

### 사용자 흐름
```
홈 "지금 도움이 필요해요" 버튼
  └─탭→ 2지선다 시트
       ├─ [가벼운 대처 루틴]   → POST /v1/routines/request → 결과 카드(또는 넛지/연계 제안)
       └─ [지금 많이 힘들어요] → SupportConnect(기존 화면, 루틴 배정 없음)
```

### 컴포넌트 (단위·경계)
| 단위 | 책임 | 의존 |
|------|------|------|
| `api/v1/routines.request` (신규 핸들러) | 요청 접수·레이트리밋·루틴선정·응답 | rate_limiter, routine_selector, metrics |
| `services/request_rate_limiter.py` (신규) | Redis 원자 카운터로 soft 상태 판정(허용/넛지/확대제안) | core/redis |
| `services/routine_selector.py` (신규, 리팩터) | 게이트 무관 "최근 맥락 기반 루틴 1개 선정" 순수/DB 헬퍼 — `routine_trigger`의 선정 로직을 공유화 | models/routine, trigger_signal |
| `services/trigger_metrics` (확장) | 요청 경로 결정 카운터(요청/넛지/확대제안/무배정) | 기존 |
| mobile `HelpRequestButton` + `HelpRequestSheet` | 홈 버튼 + 2단계 시트 + 결과/넛지/연계 UI | api, navigation(SupportConnect) |

## 레이트리밋 정책 (Codex 이중검토 반영)
- **전면 soft.** 사용자 대면 상한은 **차단이 아니라 간격·넛지**. 최종 요청은 원칙적으로 허용.
- **구체값은 config 상수 + 비임상 주석 명시** (Codex #1 — 임상 임계값 아님):
  - `REQUEST_COOLDOWN_MIN = 30` (분), `REQUEST_SOFT_DAILY = 3`, `REQUEST_SOFT_WEEKLY = 12`
  - ⚠️ **임상 근거 없는 운영 잠정값. M2 계측으로 튜닝. 소스 주석·본 문서에 "clinical threshold 아님" 명기.**
- **한도 근접/초과 = 위기 라벨❌ → 중립적 "연계 제안"** (Codex #3):
  - 문구는 "자주 찾고 계시네요. 원하시면 사람과 이야기해볼 수 있어요"처럼 **선택지 제시**(사용자가 고름). "당신은 위기다"라고 앱이 단정하지 않음. 결정1(자기선택)과 정합.
- **인프라 하드캡(남용 방어)은 별도 유지** (Codex #2): 분당 과다요청(봇/자동화) 차단용 상한(예 `HARD_PER_MIN = 20`)은 soft와 별개로 존재.
- **위기 경로(SupportConnect)는 레이트리밋 완전 예외 — 상시 개방** (Parrish 2021).
- **Redis 장애 시 fail-open**(요청 허용 + 로깅): 안전밸브 차단이 더 나쁨. 단 인프라 하드캡은 앱계층 최소 방어 유지.

## 데이터 흐름 / 저장
- `UserRoutine.source = "request"` (기존 initial/trigger/manual에 값 추가 — 스키마 변경 없음, 문자열 컬럼).
- Redis 키: `rl:req:{user_id}:cooldown`(TTL=쿨다운), `rl:req:{user_id}:day`(TTL 자정), `rl:req:{user_id}:week`(TTL 7일), `rl:req:{user_id}:min`(TTL 60s, 하드캡).
- 결정 카운터(익명): `request_fired / request_nudged / request_escalation_offered / request_no_routine`.

## 루틴 선정 (게이트 우회)
1. 최근 7일 일기의 감정 키워드 빈도 집계(기존 `count_keyword_frequency` 재사용).
2. 지배 키워드가 저에너지(무기력·우울)뿐 → `effort_level=1` 최소과제 트랙(B4 재사용).
3. 그 외 → 지배 키워드 매칭 루틴(현행 선정 로직).
4. 최근 기록 없음/매칭 없음 → **기본 감정안정 세트**(호흡·음악 등 effort_level=1 중 tier 무관) 폴백.
5. 이미 활성인 루틴 제외. tier는 최신 PHQ(없으면 2). **4구간도 "가벼운 대처 루틴"을 명시 선택했으므로 최소과제 제공**(위기 옵션은 시트에서 이미 제시됨).

## 에러 / 엣지케이스
- Redis 다운 → fail-open(허용), 경고 로깅.
- 배정할 루틴 0건 → 기본 감정안정 세트 폴백 → 그래도 없으면 "잠시 호흡 안내" 정적 콘텐츠(무배정 아님).
- 동시 요청 → Redis INCR 원자성으로 정확히 카운트.
- 미인증 → 401(기존 인증 미들웨어).

## 규제·안전 가드
- 위기=사용자 선택(핸드오프), 앱 미판단.
- 사용자 노출 문구 금지어(치료/진단/개선/효과) 필터 적용.
- escalation은 "연계 제안"(선택지)일 뿐 위기 단정 아님.

## 테스트
- `request_rate_limiter`: 원자 카운터 동시성(경합 시 정확 카운트), 쿨다운/일/주/분 경계, Redis 다운 fail-open.
- `routine_selector`: 저에너지→최소과제, 매칭, 폴백, 활성 제외 (순수/DB).
- 엔드포인트: 허용/넛지/확대제안/무배정 분기, source="request" 기록, 카운터 증가.
- 위기 분기: [지금 많이 힘들어요]→SupportConnect 라우팅(모바일).
- E2E: 요청→루틴 배정 / 반복→넛지 / 고반복→연계 제안.

## 범위 밖 (YAGNI)
- 사용자별 개인화 레이트리밋 학습(추후 M2 데이터로).
- 요청 경로 전용 신규 루틴 콘텐츠(기존 라이브러리 재사용).
- ML 기반 위기 탐지(비임상 원칙상 배제).

## 미해결·튜닝 대상
- 레이트리밋 구체값(30분/3/12/20)은 잠정 — M2 지표로 조정.
- "연계 제안" 노출 임계(주 몇 회에서 제안할지)는 사용자 조사로 검증(근거 미발견 영역).
