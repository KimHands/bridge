# AI 챗봇 (SCR-012-C) 설계 문서

- 작성일: 2026-06-02
- 화면 ID: SCR-012-C (부가 기능 — 챗봇 · 병원 안내)
- 상태: 설계 승인됨, 구현 계획 대기

---

## 1. 목적

청년 정서 웰니스 플랫폼 Bridge에 "정서적 교감 수준"의 AI 챗봇을 추가한다.
사용자가 자유롭게 마음을 털어놓을 수 있는 대화형 공간을 제공하되, **상담·진단이 아닌 정서적 교감과 전문기관 연결**에 한정한다.

## 2. 규제 포지셔닝 (최우선 제약)

> 이 챗봇은 **진단·치료·상담 서비스가 아니다.** "정서적 교감 도구"로 포지셔닝한다.

- CLAUDE.md 절대 금지: **LLM 기반 심리상담·진단 기능 구현 금지**
- 금지 표현: "치료", "진단", "개선", "효과" 등 의료적 의미
- 필수 고지(화면정의서 SCR-012-C): *"Bridge 챗봇은 정서적 교감을 위한 도구로, 전문적인 상담이나 진단을 제공하지 않아요."*
- 위기·민감 주제는 LLM이 관여하지 않고 전문기관으로 연결한다.

## 3. 핵심 결정 사항 요약

| 항목 | 결정 |
|------|------|
| 응답 방식 | 하이브리드(C) — 가벼운 공감은 LLM, 민감·위기 주제는 룰베이스 차단 |
| LLM 엔진 | 마인드로직 게이트웨이 (`https://factchat-cloud.mindlogic.ai/v1/gateway`), 모델 `claude-sonnet-4-6` (config로 교체 가능) |
| 안전 구조 | 다층 방어(B) — 입력 사전필터 → 시스템 프롬프트 가드레일 → 출력 사후검증 |
| 위기 처리 | 즉시 룰베이스 전환 + 전문기관 안내 (LLM 미호출) |
| 대화 저장 | 원문 미보관. 세션은 Redis 단기 TTL. **사용자 특징만 "메모리"로 AES-256-GCM 암호화 저장** |
| 진입점 | 홈 헤더의 말풍선 아이콘 |
| 병원 찾기 | 외부 지도 앱 딥링크 (정적 병원 데이터 없음) |
| 구현 범위 | 챗봇 화면 완성 + 진입점 1개 + 백엔드 API (부가기능 탭 전체는 비범위) |

## 4. 아키텍처 — 데이터 흐름

```
모바일 ChatScreen
   │ POST /v1/chat/messages { message }
   ▼
백엔드 chat 서비스 (다층 방어 오케스트레이션)
   ① 입력 사전필터 ──위기 키워드 감지?──▶ [룰베이스 위기 안내] (LLM 미호출, 메모리 저장 안 함)
   │ (정상)
   ② Redis 세션 컨텍스트(최근 N턴) + DB 특징 메모리(복호화) 로드
   ③ system 프롬프트(페르소나 + 규제 + 메모리) + 컨텍스트 → 마인드로직 게이트웨이 호출
   ④ 출력 사후검증 (assert_domain_safe / _BANNED_TERMS) ──위반?──▶ 안전 대체 메시지
   ⑤ Redis 세션에 턴 추가 (TTL 갱신)
   ⑥ BackgroundTask: 특징 메모리 추출 → AES-256-GCM 암호화 저장 (위기 발화 제외)
   ▼
{ reply, is_crisis, crisis_info? } → 모바일 렌더
```

## 5. 백엔드 설계

### 5.1 모듈 경계

| 파일 | 책임 | 의존 |
|------|------|------|
| `app/core/llm_gateway.py` | 마인드로직 게이트웨이 HTTP 클라이언트 (httpx, 인증 헤더, 타임아웃, 재시도) | config |
| `app/services/chat.py` | 오케스트레이션 (①~⑥ 흐름 조립) | llm_gateway, chat_guard, chat_memory, redis |
| `app/services/chat_guard.py` | 위기 키워드 사전필터 + 출력 검증 (`assert_domain_safe` 확장) | — |
| `app/services/chat_memory.py` | 특징 메모리 추출 호출 · 암호화 저장 · 복호화 로드 · 상한 정리 | llm_gateway, encryption, models |
| `app/api/v1/chat.py` | `POST /v1/chat/messages`, `GET /v1/chat/memories`, `DELETE /v1/chat/memories` | services, dependencies.auth |
| `app/models/chat.py` | `ChatMemory` ORM | base |
| `app/schemas/chat.py` | 요청/응답 Pydantic 스키마 | — |

각 모듈은 단일 책임을 가지며 인터페이스로만 통신한다. `chat.py` 서비스가 흐름을 조립하고, 가드/메모리/게이트웨이는 독립적으로 테스트 가능하다.

### 5.2 API 엔드포인트

- `POST /v1/chat/messages` (인증 필요)
  - 요청: `{ "message": str }`
  - 응답: `{ "reply": str, "is_crisis": bool, "crisis_info": { "lines": [...], "show_hospital_cta": true } | null }`
- `GET /v1/chat/memories` (인증) — 저장된 특징 메모리 목록 조회 (복호화)
- `DELETE /v1/chat/memories` (인증) — 사용자가 저장된 메모리 전체 삭제 (프라이버시 권리)

### 5.3 데이터 모델

```
ChatMemory
  id            UUID PK
  user_id       UUID FK(users.id) ON DELETE CASCADE
  encrypted_content  Text   -- AES-256-GCM (encrypt_json 재사용)
  created_at    DateTime(tz)
```

- 대화 원문 테이블은 두지 않는다. (민감 발화 영구 보관 회피)
- user당 메모리 상한: 최근 20개. 초과 시 오래된 것부터 삭제.

### 5.4 Redis 세션

- 키: `chat:session:{user_id}` — 최근 N턴(예: 10턴) 대화 컨텍스트(JSON 리스트)
- TTL: `CHAT_SESSION_TTL` (기본 3600초). 매 턴 갱신.
- 앱 재진입 후 TTL 만료 시 새 세션으로 시작(이전 대화 사라짐 — 의도된 프라이버시 동작).

### 5.5 설정 (config / .env)

```
MINDLOGIC_API_KEY        # 게이트웨이 인증 키
MINDLOGIC_BASE_URL       # 기본 https://factchat-cloud.mindlogic.ai/v1/gateway
CHAT_MODEL               # 기본 claude-sonnet-4-6
CHAT_SESSION_TTL         # 기본 3600
CHAT_MEMORY_MAX          # 기본 20
```

## 6. 안전 레이어 (다층 방어)

### 6.1 입력 사전필터 (`chat_guard`)

- `_CRISIS_PATTERNS`: 자살·자해·죽음 등 위기 키워드/패턴 상수.
- 사용자 메시지에서 감지 시 **LLM을 호출하지 않고** 즉시 룰베이스 위기 안내 반환:
  - 자살예방상담 **1393**, 정신건강위기상담 **1577-0199**
  - 병원찾기 CTA 강조 (`show_hospital_cta: true`)
- 위기 발화는 특징 메모리 추출 대상에서 제외한다.

### 6.2 시스템 프롬프트 가드레일

- 정서적 교감 페르소나 (따뜻하고 짧은 공감, 청년 친화 톤)
- 규제 제약: 의료 표현("치료/진단/개선/효과") 금지, 진단·처방·상담 행위 금지
- 민감/위기 주제는 직접 다루지 말고 "전문기관에 이야기해보길" 권유로 유도
- 저장된 사용자 특징 메모리를 컨텍스트로 주입 (개인화)

### 6.3 출력 사후검증 (`chat_guard`)

- 기존 `app/services/notification.py`의 `_BANNED_TERMS` + `assert_domain_safe` 패턴을 확장/재사용.
- LLM 응답을 사용자에게 보내기 전 금지어(치료/진단/PHQ 등) 검사.
- 위반 시 안전한 대체 메시지로 교체하고 로깅(원문 비저장).

## 7. 특징 메모리 ("memory")

- **추출 시점**: 세션 종료 또는 주기적 BackgroundTask (매 턴 LLM 호출 비용 회피).
- **추출 방식**: 게이트웨이에 "이 대화에서 사용자의 지속적 특징(선호·상황·관심사)만 1~2줄로 추출, 감정·위기 발화 내용은 제외" 요청 → 구조화 결과.
- **저장**: `encrypt_json`으로 AES-256-GCM 암호화 후 `ChatMemory`에 저장. user당 상한 초과 시 오래된 것 삭제.
- **활용**: 다음 대화 시작 시 복호화하여 system 프롬프트에 주입.
- **삭제권**: `DELETE /v1/chat/memories`로 사용자가 직접 전체 삭제 가능.

## 8. 모바일 설계

| 파일 | 책임 |
|------|------|
| `screens/chat/ChatScreen.tsx` | 말풍선 대화 UI, 입력창(하단 고정), 첫 메시지 안내 고지, 병원찾기 배너 |
| `hooks/useChatQueries.ts` | React Query mutation (메시지 전송, 낙관적 렌더), 메모리 조회/삭제 |
| `types/chat.ts` | 요청/응답 타입 (백엔드 schemas와 1:1) |
| `lib/api.ts` | `chat` 객체 (sendMessage, getMemories, clearMemories) |
| `navigation/Navigation.tsx` | `Chat` 라우트 추가 (main 그룹) |
| 진입점 | 홈 헤더(HomeScreen)의 알림 종 아이콘 옆에 말풍선 아이콘 → `navigate('Chat')` |
| 병원찾기 배너 | "전문가와 이야기 나눠보고 싶다면" + 외부 지도 딥링크("내 주변 정신건강의학과" 검색) |

- 안내 고지는 화면 진입 시 첫 시스템 말풍선으로 표시.
- 위기 응답(`is_crisis=true`)은 별도 강조 스타일 + 병원찾기 CTA 부각.

## 9. 테스트 / 에러처리

### 9.1 테스트 (백엔드)
- 위기 키워드 감지 → LLM 미호출 + 위기 안내 반환
- 출력 검증 → 금지어 포함 응답 차단/대체
- 특징 메모리 추출 시 위기 발화 제외
- 게이트웨이 클라이언트 (httpx mock)
- 기존 `assert_domain_safe` 확장 패턴 단위 테스트

### 9.2 에러처리
- 게이트웨이 타임아웃/실패 → 친절한 폴백 메시지("지금 잠시 응답이 어려워요. 잠시 후 다시 시도해주세요.")
- 위기 감지는 어떤 경우에도 최우선 (게이트웨이 장애와 무관하게 동작)

## 10. 범위 / 비범위 (YAGNI)

### 범위
- 챗봇 대화 (LLM + 다층 가드 + 위기 처리)
- 특징 메모리 (추출·암호화 저장·주입·삭제)
- 병원찾기 배너 (외부 딥링크)
- 홈 진입점 1개
- 백엔드 API + 모바일 화면

### 비범위 (후속)
- 부가기능 탭 전체 구조 (정신건강 정보 SCR-012-A, 익명 커뮤니티 SCR-012-B)
- 응답 스트리밍 (MVP는 단발 응답)
- 대화 원문 영구 저장/검색
- 정적 병원 DB / 지도 내장

## 11. 미해결 / 후속 확인

- 마인드로직 게이트웨이의 세션·페르소나·스트리밍 세부 사양은 문서에 미명시 → 표준 OpenAI/Anthropic `messages` 방식으로 구현, 실제 키 발급 후 검증 필요.
- 위기 키워드 사전(`_CRISIS_PATTERNS`)의 구체 목록은 구현 시 정신건강 도메인 가이드 참고하여 확정.
