# Frontend-Backend Collaboration Guide (협업 가이드)

## Purpose (목적)
- API contract-first 워크플로우로 FE/BE 구현 방향을 일치시킨다.
- 백엔드 코드 역추론 기반 화면 구현을 피한다.

## Single Source of Truth (단일 계약)
- OpenAPI JSON: `http://localhost:8080/v3/api-docs`
- Swagger UI: `http://localhost:8080/swagger-ui/index.html`

## Mandatory Workflow (필수 흐름)
1. route/screen goal 확정
2. OpenAPI contract 확인
3. UI + API call 구현
4. build/smoke check 실행
5. docs/checklist 같은 PR에서 갱신

## Smoke Checklist (최소 스모크)
- Login -> token storage -> user fetch
- 401 reissue flow
- Board list/detail render
- Mypage load/edit
- Changed scope 핵심 화면

## Environment Notes (환경 메모)
- Development는 docker compose 맥락 기준
- Frontend proxy host는 `backend:8080`
- Local standalone backend 사용 시 proxy target 조정 필요
