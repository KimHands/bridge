# Changelog

이 프로젝트의 주요 변경 사항을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를, 버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.
버전은 모바일 앱(`mobile/app.json`) 기준이며, 각 버전은 같은 이름의 git 태그로 남깁니다.

## [1.0.1] - 2026-10-07

### Fixed
- 첫 루틴 설정 화면의 **시작하기**를 두 번 눌러야 홈으로 이동하던 문제를 고쳤습니다.
  auth 단계가 바뀔 때 `Stack.Navigator`만 다시 마운트되고 내비게이션 상태는 `NavigationContainer`에 남아 있었습니다. 그래서 같은 이름의 화면(`Assessment`·`InitialRoutine`)이 있는 main 그룹에서 이전 스택이 그대로 복원됐습니다. 이제 `NavigationContainer`를 단계별로 다시 마운트해 상태를 함께 초기화합니다.
- 루틴 화면 진행률 링에서 **100 %** 표시가 원 밖으로 넘치던 문제를 고쳤습니다.
  SVG 텍스트(18px, 공백 포함)를 링 위에 겹친 일반 텍스트로 바꾸고, 숫자 16px · `%` 10px로 나눠 안쪽 지름 50px 안에 들어가게 했습니다.

### Docs
- README의 루틴 스크린샷과 루틴·리포트 GIF를 수정된 화면으로 교체했습니다.

## [1.0.0] - 2026-10-07

GitHub 공개 기준 버전입니다.

### Added
- 익명 우선 인증과 이메일 인증을 통한 계정 전환
- PHQ-9 자가평가와 초기 루틴 배정
- 감정 일기(기분 → 감정 키워드 → 세부 질문 → 메모), 메모 AES-256-GCM 암호화
- 근거 기반 루틴 트리거(게이트 체인 G1~G5)와 "지금 도움이 필요해요" 즉시 도움 경로
- 주간·월간·연간 리포트, 미션 점수, 푸시 알림
- AI 마음 대화(입력 위기 필터와 출력 금지어 검증)

[1.0.1]: https://github.com/KimHands/bridge/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/KimHands/bridge/releases/tag/v1.0.0
