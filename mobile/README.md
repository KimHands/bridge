# Bridge Mobile (React Native + Expo)

Bridge 앱의 모바일 클라이언트 개발 가이드. **Expo + TypeScript + React Navigation + TanStack Query + Zustand** 기반 RN 앱이며, 21개 화면 사양과 폴더 구조·연동 가이드를 다룹니다. 픽셀 단위 레퍼런스는 `docs/prototype/Bridge Prototype.html` 을 참고하세요.

---

## 1. 프로젝트 셋업

```bash
# 1. 의존성 설치
cd mobile
npm install
# 또는
yarn

# 2. 폰트 다운로드 (assets/fonts/ 에 직접 배치 필요)
#    - PretendardVariable.ttf  (https://github.com/orioncactus/pretendard)
#    - Pretendard-Bold.otf
#    - Manrope-Regular.ttf, Manrope-Bold.ttf  (Google Fonts)
#    - PlusJakartaSans-Bold.ttf

# 3. 실행
npx expo start --ios   # 또는 --android
```

**환경변수**: `src/lib/api.ts`의 `API_BASE_URL`은 현재 `http://localhost:8000`. 운영 빌드는 환경별로 `app.config.js`에서 주입하도록 분리하세요.

---

## 2. 폴더 구조

```
mobile/
├── App.tsx                      # 폰트 로드 + Provider 부트스트랩
├── app.json                     # Expo 설정
├── babel.config.js              # module-resolver alias @ → src
├── package.json
├── tsconfig.json                # paths: { "@/*": ["src/*"] }
├── assets/
│   ├── fonts/                   # ⚠ 폰트 파일 직접 배치
│   ├── icon.png, splash.png
└── src/
    ├── lib/
    │   └── api.ts               # axios + 토큰 인터셉터 + endpoint helpers
    ├── store/
    │   ├── auth.ts              # zustand: user/token + secure-store hydration
    │   └── diaryDraft.ts        # 일기 작성 4-step 위저드 상태
    ├── theme/
    │   └── tokens.ts            # color/radius/spacing/typography/shadow/moodMeta
    ├── navigation/
    │   └── Navigation.tsx       # Stack + BottomTab 루트
    ├── components/
    │   ├── atoms.tsx            # PrimaryButton, Card, TextField, Pill, Screen
    │   ├── TabBarIcon.tsx       # SVG 탭바 아이콘
    │   ├── BackHeader.tsx       # 공통 상단 바 (← 타이틀 - trailing)
    │   ├── StepProgress.tsx     # 일기/온보딩의 진행 막대
    │   ├── BottomCTA.tsx        # 화면 하단 고정 버튼 영역
    │   ├── MoodLineChart.tsx    # 리포트의 mood 추세 차트 (svg)
    │   └── CircleGauge.tsx
    ├── hooks/
    │   ├── useDiaryQueries.ts   # diary list/get/create + react-query invalidation
    │   ├── useRoutineQueries.ts
    │   └── useReportQueries.ts
    └── screens/
        ├── auth/
        │   ├── SplashScreen.tsx
        │   ├── OnboardingScreen.tsx     # 3-page Pager (FlatList horizontal pagingEnabled)
        │   ├── LoginScreen.tsx
        │   ├── SignupScreen.tsx
        │   ├── AssessmentScreen.tsx     # PHQ-9, 9 questions + result
        │   └── InitialRoutineScreen.tsx # 8 routines, 최소 3개 선택
        ├── main/
        │   ├── HomeScreen.tsx
        │   ├── RoutineScreen.tsx
        │   ├── DiaryListScreen.tsx
        │   ├── ReportScreen.tsx
        │   └── MyPageScreen.tsx
        ├── diary/
        │   ├── DiaryMoodScreen.tsx
        │   ├── DiaryKeywordScreen.tsx
        │   ├── DiaryQuestionScreen.tsx
        │   ├── DiaryMemoScreen.tsx
        │   └── DiaryDetailScreen.tsx
        ├── routine/
        │   ├── RoutineDetailScreen.tsx
        │   └── RoutineAddScreen.tsx
        └── my/
            └── ProfileEditScreen.tsx
```

---

## 3. 디자인 토큰 (src/theme/tokens.ts)

| 토큰 | 값 | 용도 |
|---|---|---|
| `palette.primary` | `#5B558E` | 브랜드 보라, 1차 액션 |
| `palette.primarySoft` | `#736EA8` | 보조 |
| `palette.primaryBgSoft` | `#E4DFFF` | 선택된 칩, soft 버튼 |
| `palette.primaryBgWash` | `#F4F3FB` | 카드 안 강조 영역 |
| `palette.mint` `mintDeep` `mintBgSoft` | `#A8D8D0` `#3D6B64` `#B9E9E1` | 긍정 액센트 |
| `palette.bg` | `#FAF8FF` | 화면 기본 배경 |
| `palette.surface` | `#FFFFFF` | 카드 |
| `palette.textHeading/Body/Caption/Muted` | `#1A1B21` `#47464F` `#787680` `#94A3B8` | 4단계 텍스트 |
| `radius` | sm 8 / md 12 / lg 16 / xl 24 / pill 9999 | 입력 12, 카드 16, 버튼 24 |
| `spacing` | 4 8 12 16 24 32 48 | xs..xxxl |

타이포: **Pretendard**(한글) + **Manrope**(영문/숫자) + **Plus Jakarta Sans**(브랜드 헤더). `expo-font`로 로드.

---

## 4. 네비게이션 구조

```
RootStack (Native Stack)
├── [!user] Auth Group
│     ├── Splash → 1.6s 후 자동 navigate → Onboarding
│     ├── Onboarding (3-page swiper)
│     ├── Login
│     └── Signup
├── [user.requires_assessment] Onboarding Group
│     ├── Assessment      (PHQ-9, 9문항)
│     └── InitialRoutine  (최소 3개 선택)
└── [user] Main Group
      ├── Main (Bottom Tab)
      │     ├── Home
      │     ├── Routine
      │     ├── Diary    (목록)
      │     ├── Report
      │     └── My
      ├── DiaryMood → DiaryKeyword → DiaryQuestion → DiaryMemo  (모달 스택)
      ├── DiaryDetail
      ├── RoutineDetail / RoutineAdd
      └── ProfileEdit
```

`useAuth().user` 변화로 그룹이 자동 전환됩니다 (React Navigation 권장 패턴). 토큰 만료 시 `api.ts`의 401 인터셉터가 `useAuth.setState({ user: null })` → 자동으로 Auth Group으로 복귀.

---

## 5. 백엔드 API 매핑

| 화면 | 호출 | 메서드 | 응답 형태 (예상) |
|---|---|---|---|
| Login | `auth.login(email, pw)` | POST `/v1/auth/login` | `TokenResponse { access_token, refresh_token, requires_assessment, ... }` |
| Signup | `auth.signup({email,pw,nickname})` | POST `/v1/auth/register` | 동일. `requires_assessment: true` |
| Assessment 결과 제출 | `assessments.submit(answers, primary_cause)` | POST `/v1/assessments` | `AssessmentResponse { phq9_level, primary_cause, assigned_routines, ... }` (점수 비노출) |
| Assessment 이력 조회 | `assessments.latest()` | GET `/v1/assessments` | `AssessmentHistoryItem[]` (마이페이지 "이전 결과 보기"에서 사용) |
| InitialRoutine 저장 | `assessments.submit` 시 자동 배정 (별도 호출 X) | — | — |
| Home / Routine 탭 | `routines.list()` | GET `/v1/routines/me` | `RoutineListResponse { routines: RoutineItem[] }` (`is_completed_today`) |
| 루틴 라이브러리 | `routines.library()` | GET `/v1/routines/library` | `RoutineLibraryResponse { routines }` (`is_already_added`, title 기준 dedup) |
| 루틴 추가 | `routines.addFromLibrary(routine_id)` | POST `/v1/routines/me` | `RoutineAddResponse` |
| 루틴 토글 | `routines.complete(id) / uncomplete(id)` | PATCH `/v1/routines/:user_routine_id/complete` | `RoutineCompleteResponse` |
| 일기 목록 | `diary.list()` | GET `/v1/diaries` | `DiaryListResponse { items, cursor, has_next }` |
| 일기 사전 체크 | `diary.todayStatus()` | GET `/v1/diaries/today/status` | `TodayStatusResponse { has_diary_today, diary_id }` |
| 감정 키워드 | `keywords.emotions()` | GET `/v1/keywords/emotions` | `KeywordsResponse { keywords[8], highlights_by_mood }` (staleTime: Infinity) |
| 일기 작성 | `diary.create(...)` | POST `/v1/diaries` | `DiaryCreateResponse` (409 시 `DIARY_ALREADY_EXISTS_TODAY`) |
| 일기 상세 | `diary.get(id)` | GET `/v1/diaries/:id` | `DiaryDetailResponse` (LLM 인사이트 없음 — 도메인 원칙) |
| Report 탭 | `reports.weekly() / monthly() / moodTrend(from, to)` | GET `/v1/reports/{weekly,monthly,mood-trend}` | LLM 표현 없음 |
| 미션 점수 | `missions.weekly() / total()` | GET `/v1/missions/{weekly,total}` | `WeeklyMissionData / TotalMissionData` |
| MyPage | `auth.me()` | GET `/v1/auth/me` | `UserMe`. `/me/stats`는 미존재 — 통계는 missions + diaryList 조합으로 대체 |
| ProfileEdit 저장 | `me.update({nickname})` | PATCH `/v1/auth/me` | `UserMe` |

**도메인 원칙 (CLAUDE.md)**:
1. `User.requires_assessment`는 자가진단 완료 시 false로 자동 전환.
2. 백엔드는 LLM 인사이트(`ai_summary` 등)를 의도적으로 제공하지 않음. 모바일에서 만나는 LLM 표현은 제거가 정답.
3. PHQ-9 점수 / 의료 표현(중등도/중증 등)은 사용자에게 노출 금지. tier별 정적 안내 텍스트만 사용.
4. 하루 1개 일기 정책 (`uq_diary_user_date`) — 작성 진입 시 `todayStatus` 사전 체크 + 작성 시점 catch 안전망 양쪽 사용.

---

## 6. React Query 패턴

```ts
// hooks/useDiaryQueries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { diary } from '@/lib/api';

export const useDiaryList = (filter?: { mood?: string }) =>
  useQuery({ queryKey: ['diary', filter], queryFn: () => diary.list(filter) });

export const useDiaryEntry = (id: string) =>
  useQuery({ queryKey: ['diary', id], queryFn: () => diary.get(id), enabled: !!id });

export const useCreateDiary = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: diary.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['diary'] }); qc.invalidateQueries({ queryKey: ['reports'] }); },
  });
};
```

루틴 토글은 **optimistic update** 권장:
```ts
useMutation({
  mutationFn: ({id, done}: {id:string; done:boolean}) => done ? routines.complete(id) : routines.uncomplete(id),
  onMutate: async ({id, done}) => {
    await qc.cancelQueries({ queryKey: ['routines'] });
    const prev = qc.getQueryData(['routines']);
    qc.setQueryData(['routines'], (old: any[]) => old.map(r => r.id === id ? {...r, done_today: done} : r));
    return { prev };
  },
  onError: (_e, _v, ctx) => qc.setQueryData(['routines'], ctx?.prev),
  onSettled: () => qc.invalidateQueries({ queryKey: ['routines'] }),
});
```

---

## 7. 화면별 구현 노트 (요약)

각 화면의 픽셀 단위 레이아웃과 인터랙션은 **`docs/prototype/Bridge Prototype.html`의 같은 번호 화면**을 정확한 참조로 사용하세요. 화면별 핵심 동작:

1. **Splash** — `setTimeout(1600)` 후 `replace('Onboarding')`. 토큰 있으면 hydrate 결과로 자동 Main.
2. **Onboarding (3-page)** — `FlatList horizontal pagingEnabled`. Skip/Next/Prev. 각 페이지의 카드는 데모 콘텐츠.
3. **Login** — 이메일 정규식 + 비번 ≥ 8자 검증. 실패 시 빨간 인라인 메시지.
4. **Signup** — 닉네임/이메일/비번/비번확인/약관(필수 2 + 선택 1). 모두 통과 시 `requires_assessment: true`로 받아 자동으로 Assessment 화면으로 전환.
5. **Assessment** — PHQ-9 9문항 (`docs/prototype/screens-assessment.jsx`의 `ASSESSMENT_QUESTIONS` 참조). 점수 합계로 정상/경증/중등도/중증/심각 5단계. 결과 화면의 추천 루틴은 서버 응답으로 대체.
6. **InitialRoutine** — 추천 8개 중 ≥3개 선택해야 CTA 활성화. 선택 항목을 N번 `routines.create` 호출 또는 bulk endpoint.
7. **Home** — Hero(인사) / 오늘 기분 5-칩(클릭 → DiaryMood) / 오늘 루틴 진행률 / AI 카드 / 최근 일기 3개.
8. **Routine** — 진행률 카드 + 리스트(체크박스 토글) + 추가 버튼.
9. **DiaryList** — 6개 mood 필터 칩 + 월별 그룹핑.
10. **Report** — 기간 토글(주/월/년) + 평균 mood + 라인차트 + 키워드 클라우드 + AI 분석 + 루틴 달성률.
11. **MyPage** — 프로필 카드(편집) / 3개 스탯 / 활동·설정·지원 섹션 / 로그아웃.
12. **DiaryMood (1/4)** — **5단계 mood 그리드** (매우 나쁨/나쁨/보통/좋음/매우 좋음). 선택 시 `diaryDraft.set({mood})`.
13. **DiaryKeyword (2/4)** — `useEmotionKeywords()` → **8개 emotion_keyword** 칩 + mood별 highlights. 다중 선택, 최대 2개. mood ↔ keyword 자동 매핑 금지 (도메인 정의: 두 모델 독립).
14. **DiaryQuestion (3/4)** — 선택한 키워드의 `KEYWORD_META.question` + answers 4개 hint 표시 + 500자 textarea. 건너뛰기 허용. 저장 시 `situation_keywords[{emotion_keyword, answer}]`로 분리.
15. **DiaryMemo (4/4)** — title (선택) + memo (선택) + 요약 카드 (mood + 키워드 + detailAnswer). 저장 시 `diary.create()` → 성공 시 실 `diary_id`로 DiaryDetail 이동, `DIARY_ALREADY_EXISTS_TODAY` catch 시 Alert + 기존 일기 라우팅.
16. **DiaryDetail** — 날짜(한국어 포맷) / mood pill / 키워드 / situation answer / 메모. **AI 인사이트 없음** (도메인 원칙). MOCK 폴백 없음 — 데이터 없으면 빈 상태 화면.
17. **RoutineDetail** — 아이콘 + 제목 + 설명 + 완료 토글.
18. **RoutineAdd** — `routines.library()` 카드 목록 + `is_already_added` 시 disabled. 영어 카테고리(sleep/academic 등)는 한국어로 매핑 노출.
19. **ProfileEdit** — 아바타(이니셜 그라데이션) + 닉네임 + 이메일(읽기전용). 저장 시 `me.update`.

---

## 8. 작업 순서 (권장)

1. **Setup**: 폰트 배치 → `npx expo start`로 빈 화면 띄우기.
2. **Theme + atoms**: `tokens.ts` + `components/atoms.tsx` 검수. Storybook 없이 바로 다음으로.
3. **Auth flow**: Splash → Onboarding → Login → Signup. 모킹 사용. 그 다음 `api.ts` 연결.
4. **Assessment + InitialRoutine**: 모든 답변 로컬 state, 서버 호출은 마지막에.
5. **Main tabs**: Home, Routine, DiaryList, Report, MyPage. 데이터는 `useQuery`.
6. **Diary write flow**: `useDiaryDraft` zustand 위저드 + 4단계.
7. **Detail/Edit**: DiaryDetail, RoutineDetail/Add, ProfileEdit.
8. **Polish**: 로딩 스켈레톤, 에러 토스트, 접근성 라벨.

---

## 9. 참고

- 프로토타입 HTML: `docs/prototype/Bridge Prototype.html` — 21개 화면 인터랙티브 데모.
- 컴포넌트 소스: `docs/prototype/theme.jsx`, `docs/prototype/screens-*.jsx` (웹 버전이지만 RN과 1:1 매핑됨).
- 디자인 토큰은 **반드시 `tokens.ts`만 사용**. 화면 안에서 raw hex/숫자 금지.
- 모든 화면은 `Screen` (`atoms.tsx`)로 감싸서 SafeArea 처리.

---

## 10. 변경 이력 (주요 결정)

### 2026-05-04 모바일 통합 + QA Hot-fix

**도메인 일관성 (Phase A/B/C)**
- mood: 6단계 → **5단계** (`verybad/bad/normal/good/verygood`, mood_score 1~5)
- emotion_keyword: 자유 → **8개 사전 정의** (CLAUDE.md L173-181, 백엔드 `GET /keywords/emotions`로 노출)
- mood ↔ emotion_keyword **자동 매핑 금지** (highlights 추천만 가능)
- LLM 표현 (`ai_summary`, "AI 인사이트") 모바일에서 전면 제거 (백엔드 의도적 미제공)
- PHQ-9 점수 노출 제거 (옵션 라벨에서 `+0~+3` 제거 등)

**일관 패턴**
- `lib/api.ts`의 `getApiError(err)`: 모든 화면 catch에서 백엔드 `HTTPException(detail={code,message})` 표준 파싱.
- `hooks/useStartDiary.ts`: 일기 작성 진입점 공통 훅. 진입 시점 `todayStatus` 사전 체크. 새 진입점 추가 시 이 훅 사용.
- 빈 상태 UI 의무화: MOCK 폴백 안티패턴 제거 (Home / RoutineScreen / DiaryListScreen / DiaryDetailScreen).
- `data?.items` 타입 매칭: DiaryListResponse 등 wrapper 응답은 단일 진실 공급원으로 `mobile/src/types/`의 백엔드 schemas 1:1 매핑.

**라이브러리 dedup 정책 (#42)**
- 백엔드 `GET /v1/routines/library`: 동일 title이 phq_tier별로 시드된 경우 user의 latest assessment phq_tier에 적합한 항목만 노출. 적합한 게 없으면 가장 낮은 ID 유지. 그 외 모든 루틴은 노출(tier 무관).
- **이유**: 사용자가 회복 단계에서 가벼운 루틴도 추가할 수 있어야 함. 엄격 필터(`min ≤ tier ≤ max`)는 인지 가능한 회귀 발생.

**자가평가 결과 보기 (#23)**
- `Assessment` 라우트 파라미터: `{ mode?: 'view' } | undefined`. `mode='view'` 진입 시 `assessments.latest()` → 결과 화면 직진.
- MyPage "이전 자가평가 결과 보기" 진입점.
