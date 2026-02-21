# Client Agent Playbook (프론트 운영 규칙)

## 1) Scope (범위)
- Frontend project root: `api-client-ui`
- Runtime: React + Vite
- API base through Vite proxy: `/api`

## 2) Backend Alignment (백엔드 정합)
- Backend base (docker compose): `http://backend:8080`
- Vite proxy rewrite:
  - Request `/api/*` -> Backend `/*`
- WebSocket proxy:
  - `/ws` -> `http://backend:8080` with `ws=true`
- OpenAPI source of truth (단일 계약 기준):
  - `http://localhost:8080/swagger-ui/index.html`
  - `http://localhost:8080/v3/api-docs`

## 3) Auth Rules (인증 규칙)
- Access token header: `Authorization: Bearer {token}`
- Refresh flow: on `401`, call `/api/auth/reissue` with refresh token
- Persisted keys (localStorage):
  - `accessToken`
  - `refreshToken`
  - `userRoles`

## 4) Implementation Rules (구현 규칙)
- API를 백엔드 코드에서 추측하지 말고 OpenAPI + 체크리스트 기준으로 구현한다.
- API 계약 변경 시 docs/checklists를 같은 변경 세트로 갱신한다.
- 비자명 로직 주석은 한글로 작성한다.
- owner/admin 권한 분기 UI를 유지한다.
- API adapter 계층을 강제한다. (page component에서 응답 shape 직접 파싱 금지)
- 작업 단위는 작게 유지한다. (one PR = one feature/risk domain)

## 4-1) FE/BE Responsibility Decision Rule (책임 분리)
- 신규 기능 구현 전 FE / BE / Mixed를 먼저 판정한다.
- BE-first:
  - auth/permission/security validation 필요
  - data consistency/transaction/concurrency 필요
  - external API secret/key 처리 필요
- FE-first:
  - UI 렌더링/인터랙션/상태 전환이 핵심
  - 서버 진실값 변경 없는 format/filter/sort
- Mixed:
  - Backend = rule/validation/calculation
  - Frontend = flow/interaction/presentation
- PR summary에 한 줄로 기록: `BE 70 / FE 30`

## 4-2) UI Contract Auto-Apply Rule (자동 적용)
- 신규 화면 요청 시 `docs/UI_CONTRACTS/`를 먼저 자동 탐색한다.
- best match 1개면 질문 없이 적용한다.
- 후보가 여러 개면 route/feature 이름 기준으로 가장 가까운 파일을 선택하고 보고한다.
- 계약서가 없으면 `docs/SCREEN_COMPOSITION_BASELINE.md` + `docs/UI_CONTRACT_TEMPLATE.md` 기본값으로 진행한다.
- UI contract vs API contract 충돌 시 코딩 전에 중단하고 충돌을 보고한다.
- Conflict precedence (우선순위):
  - Data schema/required/auth/error code: OpenAPI first
  - Screen layout/copy/interaction flow: UI Contract first
  - Existing UI pattern: third priority

## 4-3) UI Contract File Naming Rule (파일명 규칙)
- Location: `docs/UI_CONTRACTS/`
- Format: `{route-or-domain}-{feature-kebab}.md`
- Examples:
  - `boards-write.md`
  - `mypage-profile-edit.md`
  - `statistics-dashboard.md`
- lowercase/digits/hyphen only

## 4-4) No Hollow Screen Rule (깡통 화면 금지)
- scaffold-only 화면은 완료로 간주하지 않는다.
- visible CTA/button/form action은 모두 real handler에 연결되어야 한다.
- placeholder/TODO/mock-only control은 완료 상태에서 금지.
- 부분 전달이 불가피하면:
  - unfinished action을 disabled/hidden 처리
  - PR에 범위 명시
  - completion gate에서 미완료로 유지

## 5) Definition of Done (완료 기준)
- target route에서 기능 동작 확인
- `npm run build` 통과
- OpenAPI/API checklist 영향 문서화
- README/docs 업데이트 포함
- UI 4-state 통과: loading / empty / error / forbidden
- action wiring 통과: hollow button/form 없음

## 6) Required Docs (필수 문서)
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/API_CHANGE_CHECKLIST.md`
- `docs/SCREEN_API_MAPPING.md` (route/screen 영향 시)
- `docs/VIBE_CODING_RULES.md`
- `docs/UI_CONTRACT_TEMPLATE.md` (or concrete file under `docs/UI_CONTRACTS/`)
- `docs/HANDOFF_TEMPLATE.md` (long-thread handoff)
