# Plan: Phase4-루틴라이브러리

> Phase 번호 보충: 백엔드 단일 신규 엔드포인트 + 모바일 UI 정상화. 기존 Phase 1~9와 별개로 모바일 핫픽스 흐름에서 도출된 후속 작업.

## 개요

`RoutineAddScreen`(루틴 추가 화면)이 사용자에게 routine_id 직접 입력을 요구하는 임시 UI 상태였다.
원인은 백엔드에 추천 가능한 루틴 전체 목록을 조회할 엔드포인트가 부재했기 때문.
이 Phase에서는 라이브러리 조회 API를 백엔드에 신설하고, 모바일 UI를 라이브러리 카드 선택 방식으로 교체한다.

## 목표

- `GET /v1/routines/library` — 사용자별 루틴 라이브러리 목록 (이미 추가 여부 포함)
- 모바일 `RoutineAddScreen` 임시 UI 제거 → 라이브러리 카드 목록 UI

## 범위

### 포함

1. **백엔드 — 라이브러리 조회 API**
   - 인증 필요 (`get_current_user`)
   - 전체 `Routine` + 현재 유저의 활성 `UserRoutine` 교집합으로 `is_already_added` 동적 계산
   - 페이지네이션 없음 (시드 19개 한정)
   - 응답: `{ routines: [{ routine_id, title, description, target_keywords, is_already_added }] }`

2. **모바일 — 화면 정상화**
   - `types/routine.ts` — `RoutineLibraryItem`, `RoutineLibraryResponse` 신규
   - `lib/api.ts` — `routines.library()` 추가
   - `hooks/useRoutineQueries.ts` — `useRoutineLibrary()` 훅 추가
   - `screens/routine/RoutineAddScreen.tsx` — TextInput 임시 UI 제거, FlatList 카드 목록으로 교체
   - `is_already_added: true` 항목은 disabled + "추가됨" 뱃지 표시

### 제외

- `Routine` 모델에 카테고리/난이도 컬럼 추가 (스키마 변경 없음)
- 추천 알고리즘 기반 정렬 (단순 ID asc)
- 키워드 필터링 UI (단계적 적용 후보)

## 사용 모델·테이블

| 테이블 | 역할 |
|--------|------|
| `routines` | 전체 라이브러리 소스 |
| `user_routines` | 현재 유저의 활성 등록 루틴 (`is_already_added` 계산용) |

## 구현 파일 목록

```
backend/app/
├── schemas/routine.py       # RoutineLibraryItem, RoutineLibraryResponse 추가
└── api/v1/routines.py       # GET /library 엔드포인트 추가 (정적/동적 라우터 순서 유지)

mobile/src/
├── types/routine.ts                          # 2개 인터페이스 추가
├── lib/api.ts                                # routines.library() 추가
├── hooks/useRoutineQueries.ts                # useRoutineLibrary() 추가
└── screens/routine/RoutineAddScreen.tsx      # 라이브러리 카드 UI로 전면 교체
```

## 핵심 설계 결정

| 항목 | 결정 | 이유 |
|------|------|------|
| 응답에 `is_already_added` 포함 | 포함 | 모바일에서 추가/제외 두 번 쿼리할 필요 없음, UX 유연성 향상 |
| 인증 필요 여부 | 필요 | `is_already_added`가 사용자별 동적 값이라 익명 캐시 불가 + 다른 routines 엔드포인트와 일관 |
| 페이지네이션 | 미적용 | 시드 19개 → 단일 응답으로 충분, 추후 50+ 증가 시 도입 검토 |
| 라우터 순서 | `/me` → `/library` → `/{user_routine_id}/*` | FastAPI 라우터 패턴 일관성 (정적 경로 우선) |
| 캐시 무효화 | `useAddRoutineFromLibrary` 의 `['routines']` invalidate | `['routines', 'library']` 가 prefix 하위라 자동 무효화 → `is_already_added` 자동 갱신 |

## 검증 기준

- 백엔드: 라우터 정의 순서가 동적 경로보다 정적 경로 우선
- 모바일: `tsc --noEmit` 0건 유지
- 기능: 추가 후 같은 항목이 disabled 상태로 갱신됨

## 비고

- 본 Phase는 모바일 진단(2026-05-04) 결과 도출된 후속 작업
- Phase 1~3 모바일 정리 작업의 핫픽스 마무리 성격
