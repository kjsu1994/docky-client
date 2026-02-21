# API Change Checklist

## 1) Contract First
- [ ] Confirm endpoint/method/path/query/body from OpenAPI
- [ ] Confirm response schema and snake_case field names
- [ ] Confirm error schema (`status`, `code`, `message`)

## 2) Auth / Security
- [ ] `Authorization` header behavior checked
- [ ] `401` reissue flow (`/api/auth/reissue`) checked
- [ ] Role-based UI (`ROLE_ADMIN` / owner) impact checked

## 3) Runtime Alignment
- [ ] Vite proxy path `/api` rewrite compatibility checked
- [ ] docker compose hostname (`backend`) assumptions checked
- [ ] WebSocket endpoint (`/ws`) impact checked

## 4) Data / Migration Awareness
- [ ] If backend entity/schema changed, corresponding frontend assumptions reviewed
- [ ] New/changed fields reflected in UI/validation

## 5) Verification
- [ ] Build success (`npm run build`)
- [ ] Smoke tests: login, board list/detail, mypage
- [ ] Docs updated
