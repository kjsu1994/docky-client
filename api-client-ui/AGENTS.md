# Client Agent Playbook

## 1) Scope
- Frontend project root: `api-client-ui`
- Runtime: React + Vite
- API base through Vite proxy: `/api`

## 2) Backend Alignment (Current)
- Backend base (docker compose): `http://backend:8080`
- Vite proxy rewrite:
  - Request `/api/*` -> Backend `/*`
- WebSocket proxy:
  - `/ws` -> `http://backend:8080` with `ws=true`
- OpenAPI source of truth:
  - `http://localhost:8080/swagger-ui/index.html`
  - `http://localhost:8080/v3/api-docs`

## 3) Auth Rules
- Access token header: `Authorization: Bearer {token}`
- Refresh flow: on `401`, call `/api/auth/reissue` with refresh token
- Persisted keys:
  - `accessToken`
  - `refreshToken`
  - `userRoles`

## 4) Implementation Rules
- Do not infer API from backend code first; use OpenAPI and API checklist first.
- If API contract changes, update docs/checklists in same change set.
- Keep Korean comments for non-obvious logic.
- Preserve owner/admin authorization UI checks.
- Enforce API adapter layer: do not parse mixed response shapes directly in page components.
- Keep work units small: one PR should focus on one feature/risk domain.

## 4-1) FE/BE Responsibility Decision Rule
- Before implementing new feature, classify as FE / BE / Mixed.
- BE-first if:
  - Auth/permission/security validation is required.
  - Data consistency, transaction, concurrency control is required.
  - Secret keys or external API credentials are involved.
- FE-first if:
  - UI rendering/interaction/state transition is the core value.
  - No server truth mutation is needed (format/filter/sort on fetched data).
- Mixed if:
  - Backend owns rule/validation/calculation.
  - Frontend owns flow/interaction/presentation.
- Record one-line decision in PR summary (e.g., `BE 70 / FE 30`).

## 4-2) UI Contract Auto-Apply Rule
- For new screen requests, agent automatically searches `docs/UI_CONTRACTS/` first.
- If one best matching contract exists (feature/route keyword match), apply it without asking.
- If multiple candidates exist, pick the closest by route/feature name and report selected file.
- If no contract exists, apply `docs/SCREEN_COMPOSITION_BASELINE.md` + `docs/UI_CONTRACT_TEMPLATE.md` defaults and proceed.
- If UI contract and API contract conflict, stop and report conflict before coding.
- Conflict precedence (explicit):
  - Data schema/required fields/auth/error codes: OpenAPI first
  - Screen layout/copy/interaction flow: UI Contract first
  - Existing UI pattern is third priority unless contract explicitly overrides

## 4-3) UI Contract File Naming Rule
- Contract file location: `docs/UI_CONTRACTS/`
- File name format: `{route-or-domain}-{feature-kebab}.md`
- Examples:
  - `boards-write.md`
  - `mypage-profile-edit.md`
  - `statistics-dashboard.md`
- Use lowercase letters, digits, and hyphens only.

## 4-4) No Hollow Screen Rule (Strict)
- Do not mark feature complete when screen is scaffold-only.
- Every visible CTA/button/form action must be wired to a real handler.
- Placeholder/TODO/mock-only controls are prohibited in completion state.
- If partial delivery is unavoidable:
  - Keep unfinished actions disabled/hidden,
  - Declare scope explicitly in PR,
  - Keep unchecked in completion gate.

## 5) Definition of Done
- Feature behavior works on target route.
- `npm run build` passes in `api-client-ui`.
- OpenAPI/API checklist impact is documented.
- README or docs update is included.
- UI 4-state check passes: loading / empty / error / forbidden.
- Action wiring check passes: no hollow buttons/forms.

## 6) Required Docs for API Change
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/API_CHANGE_CHECKLIST.md`
- `docs/SCREEN_API_MAPPING.md` (if route/screen impact exists)
- `docs/VIBE_CODING_RULES.md`
- `docs/UI_CONTRACT_TEMPLATE.md` (or concrete file under `docs/UI_CONTRACTS/`)
- `docs/HANDOFF_TEMPLATE.md` (for long-thread handoff)
