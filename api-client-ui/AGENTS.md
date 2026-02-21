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

## 5) Definition of Done
- Feature behavior works on target route.
- `npm run build` passes in `api-client-ui`.
- OpenAPI/API checklist impact is documented.
- README or docs update is included.
- UI 4-state check passes: loading / empty / error / forbidden.

## 6) Required Docs for API Change
- `.github/PULL_REQUEST_TEMPLATE.md`
- `docs/API_CHANGE_CHECKLIST.md`
- `docs/SCREEN_API_MAPPING.md` (if route/screen impact exists)
- `docs/VIBE_CODING_RULES.md`
