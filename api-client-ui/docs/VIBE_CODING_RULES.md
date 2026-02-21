# Vibe Coding Rules (Frontend)

## 1) Core Principle
- Keep velocity high, but gate quality with explicit checks.
- Do not merge AI-generated code without review and verification.

## 2) Work Unit Rule
- One PR = one feature or one risk domain.
- Split large UI work into independent increments (0.5~1 day each).

## 3) Contract-First Rule
- Start from OpenAPI (`/v3/api-docs`) before coding screens.
- If contract changes, update docs in the same PR.

## 4) Adapter Rule
- Normalize API response in adapter/utils layer.
- Page components should consume normalized view models only.

## 5) UI Completion Rule (Mandatory 4 States)
- Loading state
- Empty state
- Error state
- Forbidden/Unauthorized state

## 6) Validation Gate
- Build must pass (`npm run build`).
- Auth smoke path must pass (login -> token -> reissue -> logout).
- Route smoke for changed screen must pass.

## 7) Communication Rule
- Include impact table (API/data/auth/docs/release note) in PR.
- If user-facing behavior changed, add short release note summary.
