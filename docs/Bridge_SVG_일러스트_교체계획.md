# Bridge 모바일 앱 — SVG 일러스트 교체 계획

> 모바일 앱(`mobile/src/`) 내 이모지를 SVG 일러스트로 교체하기 위한 정리 문서.
> 총 **5개 카테고리, 약 40개 고유 이미지**가 필요하다.

---

## 📑 목차

1. [추천 라이브러리 — Phosphor Icons](#추천-라이브러리--phosphor-icons)
2. [우선순위 1 — 루틴 아이콘 (8종)](#우선순위-1--루틴-아이콘-8종)
3. [우선순위 2 — 기분 감정 (5단계)](#우선순위-2--기분-감정-5단계)
4. [우선순위 3 — 자가평가 원인 선택 (7종)](#우선순위-3--자가평가-원인-선택-7종)
5. [우선순위 4 — 화면 장식 / 헤더 아이콘](#우선순위-4--화면-장식--헤더-아이콘)
6. [우선순위 5 — 마이페이지 메뉴 아이콘 (11종)](#우선순위-5--마이페이지-메뉴-아이콘-11종)
7. [기타 — 격려 메시지 인라인 이모지](#기타--격려-메시지-인라인-이모지)
8. [SVG 제작 일반 가이드](#svg-제작-일반-가이드)

---

## 추천 라이브러리 — Phosphor Icons

> **결론: Phosphor Icons 단일 라이브러리로 38종 거의 전부 커버 가능.**

### 왜 Phosphor인가?

| 기준 | 평가 |
|------|------|
| 라이센스 | MIT (상업적 무료) |
| 아이콘 수 | 9,000+ |
| **6가지 굵기** | regular / bold / duotone / fill / light / thin |
| 인물·표정 아이콘 | ⭐ 풍부 (Lucide·Heroicons 약점 보완) |
| 톤 | 둥근 모서리, 따뜻한 라인 — Bridge 정서에 적합 |
| React Native | `phosphor-react-native` 패키지 공식 지원 |
| 직접 SVG 다운로드 | phosphoricons.com 에서 가능 |

### 사용 권장 굵기

- **메뉴 아이콘 / 장식 (24px 이하)** → `regular` (기본)
- **루틴 / 기분 / 자가평가 원인 (40px 이상)** → `duotone` (2색 — 따뜻한 톤)
- **헤더 강조 (64px+)** → `duotone` 또는 `fill`

> 💡 굵기 통일은 결국 디자인 결정. 처음엔 모두 `regular`로 시작하고, 큰 자산만 `duotone`으로 교체하는 점진적 접근 추천.

### 다운로드 / 설치

- **공식 사이트**: https://phosphoricons.com
- **React Native 패키지**: `npm install phosphor-react-native react-native-svg`
- **SVG 직접 다운로드**: 사이트에서 아이콘 클릭 → SVG 복사 또는 다운로드

---

## 우선순위 1 — 루틴 아이콘 (8종)

> **`mobile/src/lib/routineEmoji.ts` 한 파일만 수정하면 4개 화면에 즉시 반영됨.**
> 가장 ROI가 높아 우선순위 최상위.

### 교체 대상 → Phosphor 매핑

| 이모지 | 의미 | **Phosphor 아이콘** | 비고 |
|:---:|------|---------|------|
| 🤸 | 스트레칭 | `ph:person-arms-spread` | 팔 벌린 인물 |
| 🚶 | 산책 | `ph:person-simple-walk` | 걷는 자세 |
| 📓 | 일기쓰기 | `ph:notebook` | 노트북 |
| 📚 | 독서 | `ph:book-open` | 펼쳐진 책 |
| 🧘 | 명상·호흡 | `ph:flower-lotus` | 연꽃 (명상 상징) |
| 💧 | 수분 섭취 | `ph:drop` | 물방울 |
| 🌙 | 수면 | `ph:moon-stars` | 달 + 별 (수면 분위기) |
| ✨ | 기본값 | `ph:sparkle` | 반짝임 |

### 사용 화면 & 권장 SVG 크기

| 화면 | 위치 | 표시 크기 | **권장 SVG 크기** |
|------|------|:----:|:----:|
| `RoutineDetailScreen.tsx:54` | 루틴 상세 헤더 | fontSize 36 | **64×64** |
| `InitialRoutineScreen.tsx:54` | 첫 루틴 카드 | fontSize 26 | **48×48** |
| `RoutineScreen.tsx:77` | 루틴 목록 카드 | fontSize 20 | **36×36** |
| `HomeScreen.tsx:129` | 홈 루틴 미리보기 | fontSize 14 | **24×24** |

**제작 권장**: 1종당 1개 SVG로 제작. `width`/`height` props로 4가지 크기 대응 (벡터라 가능).

---

## 우선순위 2 — 기분 감정 (5단계)

> **앱에서 가장 자주 보이는 이미지. 브랜드 정체성의 핵심 시각 요소.**

### 교체 대상 → Phosphor 매핑

| 이모지 | 의미 | 키 | **Phosphor 아이콘** | 비고 |
|:---:|------|------|---------|------|
| 😭 | 매우 나쁨 | verybad | `ph:smiley-x-eyes` | X자 눈 (강한 부정) |
| 😢 | 나쁨 | bad | `ph:smiley-sad` | 우는 표정 |
| 😐 | 보통 | normal | `ph:smiley-meh` | 무표정 |
| 🙂 | 좋음 | good | `ph:smiley` | 일반 미소 |
| 😊 | 매우 좋음 | verygood | `ph:smiley-wink` | 활짝 웃음 (윙크) |

**대안**: `verygood`을 `ph:smiley-sticker` (별모양 스티커형) 로 교체하면 더 밝은 느낌. 디자인 톤에 맞게 선택.

### 사용 화면 & 권장 SVG 크기

| 화면 | 위치 | 표시 크기 | **권장 SVG 크기** |
|------|------|:----:|:----:|
| `DiaryMoodScreen.tsx:17-21` | 일기 작성 1/4 — 기분 선택 (메인) | fontSize 36 | **64×64** |
| `OnboardingScreen.tsx:28-32` | 온보딩 1페이지 미리보기 | fontSize 22 | **40×40** |
| `HomeScreen.tsx:27-31` | 홈 — 오늘의 기분 칩 | fontSize 22 | **40×40** |
| `DiaryListScreen.tsx:21-25` | 일기 목록 필터 칩 | inline 텍스트 | **20×20** |

**제작 권장**:
- 작은 크기(20px)에서도 표정이 뭉개지지 않도록 **단순한 라인 스타일** 권장.
- 5개 시리즈가 시각적으로 일관성 있어야 함 (같은 얼굴 형태에 표정만 변화).

---

## 우선순위 3 — 자가평가 원인 선택 (7종)

> **온보딩 직후 첫 인상을 결정하는 핵심 화면.**

화면: `AssessmentScreen.tsx:32-38` — "마음이 무거운 주된 이유는?"

### 교체 대상 → Phosphor 매핑 & 권장 크기

| 이모지 | 의미 | 라벨 | **Phosphor 아이콘** | 권장 크기 |
|:---:|------|------|---------|:----:|
| 😴 | 수면 | 수면 문제 | `ph:bed` | 48×48 |
| 📚 | 학업 | 학업·업무 | `ph:graduation-cap` | 48×48 |
| 🔮 | 미래 | 미래·진로 | `ph:magic-wand` | 48×48 |
| 💸 | 경제 | 경제적 걱정 | `ph:money` | 48×48 |
| 👥 | 관계 | 대인관계 | `ph:users-three` | 48×48 |
| 💪 | 건강 | 신체 건강 | `ph:barbell` | 48×48 |
| 🤔 | 의문 | 잘 모르겠음 | `ph:seal-question` | 48×48 |

**주의**: Phosphor에 crystal-ball 아이콘은 없음. `magic-wand` 또는 `sphere`로 대체. 톤이 신비로운 쪽이 적합.

**제작 권장**: 7개가 한 화면에 그리드로 배치되므로 **시각적 무게감(stroke·여백·채도)이 균일**해야 한다.

---

## 우선순위 4 — 화면 장식 / 헤더 아이콘

> **단일 위치 사용. 정보성 시각 요소.**

| 이모지 | 화면 | 위치 | **Phosphor 아이콘** | 권장 크기 |
|:---:|------|------|---------|:----:|
| 🌱 | `AssessmentScreen.tsx:161` | 결과 화면 헤더 (96×96 원형) | `ph:plant` | 64×64 |
| 🌱 | `InitialRoutineScreen.tsx:44` | 루틴 로딩 빈 상태 | `ph:plant` | 56×56 |
| 💡 | `DiaryKeywordScreen.tsx:69` | 키워드 선택 팁 박스 | `ph:lightbulb` | 24×24 |
| 📈 | `OnboardingScreen.tsx:113` | 온보딩 3페이지 차트 박스 | `ph:chart-line-up` | 24×24 |
| 📈 | `ReportScreen.tsx:115` | 평균 기분 카드 | `ph:chart-line-up` | 24×24 |
| 📅 | `ReportScreen.tsx:34` | 연간 리포트 준비 중 | `ph:calendar` | 48×48 |
| 📔 | `ReportScreen.tsx:170` | 일기 수 요약 카드 | `ph:notebook` | 24×24 |

**제작 권장**:
- 🌱은 1개 SVG로 두 화면에서 크기만 다르게 사용.
- 📈도 1개 SVG로 두 화면에서 재사용.
- 실제 제작 필요 종수: **5종** (🌱 / 💡 / 📈 / 📅 / 📔)

---

## 우선순위 5 — 마이페이지 메뉴 아이콘 (11종)

> **시각적 면적 작음. 일관된 스타일 1세트로 제작 권장.**

화면: `MyPageScreen.tsx:89-105`

### 교체 대상 → Phosphor 매핑

#### 활동 섹션
| 이모지 | 메뉴 | **Phosphor 아이콘** |
|:---:|------|---------|
| 🎯 | 내 목표 | `ph:target` |
| 🏆 | 달성 기록 | `ph:trophy` |
| 📊 | 이전 자가평가 결과 | `ph:chart-bar` |
| 📝 | 자가평가 다시 하기 | `ph:notepad` |

#### 설정 섹션
| 이모지 | 메뉴 | **Phosphor 아이콘** |
|:---:|------|---------|
| 🔔 | 알림 설정 | `ph:bell` |
| 🌙 | 다크 모드 | `ph:moon` |
| 🔒 | 잠금 설정 | `ph:lock` |
| 🌐 | 언어 | `ph:globe` |

#### 고객 지원 섹션
| 이모지 | 메뉴 | **Phosphor 아이콘** |
|:---:|------|---------|
| ❓ | 자주 묻는 질문 | `ph:question` |
| ✉️ | 문의하기 | `ph:envelope` |
| 📜 | 이용약관 | `ph:scroll` |
| 🔐 | 개인정보 처리방침 | `ph:shield-check` |
| 📣 | 마케팅 정보 수신 동의 | `ph:megaphone` |

### 권장 크기

| 표시 위치 | 표시 크기 | **권장 SVG 크기** |
|------|:----:|:----:|
| 메뉴 좌측 (28×28 박스) | fontSize 14 | **24×24** |

**제작 권장**:
- **단색 라인 아이콘** 스타일 (Heroicons / Phosphor 같은 톤).
- 메뉴 13개 전체가 동일 굵기·동일 라운드 처리로 시각적 통일감 확보.
- ⚠️ 🌙은 **루틴 아이콘의 🌙(수면)** 과 별개 자산으로 제작 (크기·맥락이 다름).

---

## 기타 — 격려 메시지 인라인 이모지

> **권장: SVG로 교체하지 않고 그대로 두거나 텍스트만 남기는 것도 선택지.**

화면: `RoutineScreen.tsx:58` — 루틴 진행률에 따른 격려 메시지

| 이모지 | 메시지 |
|:---:|------|
| ✨ | "완벽해요! 이대로 계속 이어가요 ✨" |
| 🙌 | "절반 넘었어요! 조금만 더 해요 🙌" |
| 💪 | "오늘도 화이팅! 천천히 해나가요 💪" |

**판단**:
- 텍스트 문장에 인라인으로 박혀있어 SVG 삽입 시 줄바꿈·정렬이 까다로움.
- 우선순위 최하위. 이모지 유지 또는 제거 둘 다 가능.

---

## SVG 제작 일반 가이드

### 색상

| 항목 | 권장 |
|------|------|
| 기본 컬러 | Bridge 브랜드 컬러 팔레트 사용 |
| 라인 굵기 | 1.5~2px (24px 기준) — 작은 사이즈에서도 가독성 확보 |
| 다크 모드 | `currentColor` 사용해서 색상 자동 대응 |

### 사이즈 정책

> **모든 SVG는 단일 viewBox로 제작하고, React Native에서 `width`/`height` props로 가변 크기 처리한다.**

| 권장 viewBox | 실제 사용 크기 |
|:----:|:----:|
| `0 0 24 24` | 20, 24, 36, 48, 64 |

### 파일 구조 권장

```
mobile/
├── assets/
│   └── illustrations/
│       ├── mood/             # 기분 5종
│       │   ├── verybad.svg
│       │   ├── bad.svg
│       │   └── ...
│       ├── routine/          # 루틴 8종
│       │   ├── stretch.svg
│       │   ├── walk.svg
│       │   └── ...
│       ├── cause/            # 자가평가 원인 7종
│       │   ├── sleep.svg
│       │   └── ...
│       ├── decoration/       # 화면 장식 5종
│       │   ├── seedling.svg
│       │   └── ...
│       └── menu/             # 마이페이지 13종
│           ├── target.svg
│           └── ...
└── src/
    └── components/
        └── icons/            # SVG → React 컴포넌트 래퍼
```

### 라이브러리 권장

- **react-native-svg** (Expo 호환) 사용
- SVG → 컴포넌트 변환: `react-native-svg-transformer` 또는 SVGR

### 통합 단계 (제안)

1. `react-native-svg` + `react-native-svg-transformer` 설치
2. `metro.config.js` 에서 SVG transformer 등록
3. `mobile/assets/illustrations/` 디렉토리 생성 및 SVG 적재
4. 각 카테고리별 wrapper 컴포넌트 작성 (`<MoodIcon mood="good" size={40} />` 등)
5. 우선순위 1 → 5 순서대로 교체
6. `routineEmoji.ts` 함수는 `routineIcon.tsx` 컴포넌트로 대체

---

## 작업 권장 순서 요약

| 순서 | 카테고리 | 종수 | 예상 영향 범위 |
|:----:|------|:----:|------|
| 1 | 루틴 아이콘 | 8종 | 4개 화면 (단일 파일 수정으로 일괄 적용) |
| 2 | 기분 감정 | 5종 | 4개 화면 (브랜드 핵심 자산) |
| 3 | 자가평가 원인 | 7종 | 1개 화면 (온보딩 핵심) |
| 4 | 화면 장식 | 5종 | 5개 화면 |
| 5 | 마이페이지 메뉴 | 13종 | 1개 화면 |
| - | 격려 메시지 | 3종 | 보류 (선택사항) |

**총 SVG 자산**: 약 **38종** (재사용 포함 시 실제 표시 인스턴스 80+ 위치 커버)
