# bridge

정신건강 습관형성 앱(비의료기기 포지셔닝). FastAPI 백엔드 + React Native 모바일.

## 이 프로젝트에서 항상 지킬 것
- 형식 규칙: `~/Ops/domains/web.md`
- 사용자 노출 텍스트(알림·UI 카피·AI 생성 텍스트)에 의료 금지어(치료/진단/개선/효과/장애/우울/PHQ/GAD/구간/점수 등) 금지 — `assert_domain_safe` 가드 통과 필수
- 10+ commit 예상되는 큰 Phase 작업은 main 직접 커밋 대신 `feature/phase-N-<주제>` 브랜치 후 PR 머지
- RN 화면에서 `navigation.goBack/popToTop/replace` 호출 시 `canGoBack()`+`isFocused()` 가드 필수 (지연 콜백 경로 특히)
- `TopBar` 쓰는 화면은 `SafeAreaView edges={['top']}` 금지 (TopBar가 자체 insets 처리, 이중 여백 방지)
- 외부 바이너리를 PATH 영구 위치에 설치하기 전 SHA256·file 포맷 검증 후 결과 보고

## 자주 쓰는 참조
전체 코드 검토·백로그 상태는 memory에 있다. 착수 전 확인할 것.
