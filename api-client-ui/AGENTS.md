# Client Agent Playbook

## 경로

- 클라이언트 저장소: `C:\Users\honeybadger\Desktop\ctfmon_project\client`
- 앱 루트: `client\api-client-ui`
- 서버 저장소: `C:\Users\honeybadger\Desktop\ctfmon_project\CommunityServer`
- 운영 compose: `C:\compose`
- 운영 도메인: `https://ctfmon.shop`

## 작업 원칙

- React + Vite 프론트엔드다.
- 브라우저 API base는 `/api`, WebSocket은 `/ws`를 사용한다.
- 백엔드 API 계약은 OpenAPI 기준으로 확인한다.
- API 호출과 응답 정규화는 `src/adapters/**`에 둔다.
- page component에서 raw response shape를 직접 해석하지 않는다.
- 요청 범위 밖의 UI 개편, 리팩터링, 문서 추가를 하지 않는다.
- PC, 테블릿, 모바일 환경(마우스클릭, 터치, 화면비율, 화면의 작은크기에 대한 UX대응 등)을 모두 고려해서 작업한다.
  Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. Think Before Coding
   Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.
2. Simplicity First
   Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
   Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
   Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
   Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## README 규칙

저장소 루트 `README.md`는 클라이언트 화면별 기능 문서로만 관리한다.

- 포함: 화면 경로별 기능, 사용자에게 보이는 동작, 공통 UI/인증/상태 원칙, 실행/빌드/검증 명령, 앱 구조
- 제외: 날짜별 작업 로그, PR 요약, 회고, 인수인계, API 체크리스트 이력, 검증 이력 누적, 구현 과정 설명, 서버 API 상세 스키마
- 화면 경로, 사용자 기능, 공통 UX 정책이 바뀐 경우에만 README를 갱신한다.
- API 상세 계약은 서버 OpenAPI와 서버 README를 기준으로 한다.

## 구현 기준

- 인증 토큰 key는 `accessToken`, `refreshToken`, `userRoles`를 유지한다.
- 요청/응답 필드는 백엔드 `SNAKE_CASE` 기준에 맞춘다.
- public auth endpoint나 외부 URL에는 bearer token을 붙이지 않는다.
- 공통 UI는 기존 역할에 맞춰 `src/common/**` 또는 `src/components/**`에 둔다.
- 버튼, 폼, CTA는 실제 handler와 사용자 피드백을 가져야 한다.
- 완료 상태에서 mock-only, TODO-only, hollow UI를 남기지 않는다.
- 주요 화면은 loading, empty, error, forbidden/unauthorized 상태를 처리한다.

## 화면 기준

- 기존 화면 밀도와 스타일을 우선한다.
- 관리자/운영 화면은 스캔, 비교, 반복 작업 효율을 우선한다.
- 게임 화면은 실제 조작과 상태 이해가 먼저 보이게 구성한다.
- 텍스트, floating chat, toast, modal, 하단 내비게이션이 서로 겹치지 않게 확인한다.

## 검증

```powershell
cd api-client-ui
npm run build
```

- 변경 범위에 맞춰 `package.json`의 `smoke:*` script를 선택한다.
- 한글 포함 파일은 UTF-8로 저장하고, 깨진 문자열이 보이면 즉시 복구한다.

## 완료 보고

- 변경 파일
- 사용자 영향
- 검증 결과
- API/data shape/권한/문서 영향: 있음/없음
