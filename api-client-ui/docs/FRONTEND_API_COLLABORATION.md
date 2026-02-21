# Frontend-Backend Collaboration Guide

## Purpose
- Keep frontend and backend implementations aligned through API contract-first workflow.
- Avoid reverse-engineering backend code for UI implementation.

## Single Source of Truth
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`

## Mandatory Workflow for New Feature
1. Confirm route/screen goal.
2. Confirm endpoint contract from OpenAPI.
3. Implement UI and API call.
4. Run build/smoke checks.
5. Update docs/checklists in same PR.

## Smoke Checklist (Minimum)
- Login -> token storage -> user fetch
- 401 reissue flow
- Board list/detail render
- Mypage load/edit
- Core feature page for changed scope

## Environment Notes
- Development runs in docker compose context.
- Frontend proxy assumes backend host `backend:8080`.
- If local standalone backend is used, proxy target must be adjusted.
