# API Change Checklist (API 변경 체크)

## 1) Contract First (계약 우선)
- [ ] OpenAPI 기준 endpoint/method/path/query/body 확인
- [ ] response schema + snake_case field 확인
- [ ] error schema (`status`, `code`, `message`) 확인

## 2) Auth / Security (인증/보안)
- [ ] `Authorization` header 동작 확인
- [ ] `401` reissue flow (`/api/auth/reissue`) 확인
- [ ] role UI (`ROLE_ADMIN` / owner) 영향 확인

## 3) Runtime Alignment (런타임 정합)
- [ ] Vite proxy `/api` rewrite 호환 확인
- [ ] docker compose host (`backend`) 가정 확인
- [ ] WebSocket endpoint (`/ws`) 영향 확인

## 4) Data / Migration Awareness (데이터 영향)
- [ ] backend entity/schema 변경 시 frontend 가정 재검토
- [ ] 신규/변경 field를 UI/validation에 반영

## 5) Verification (검증)
- [ ] build success (`npm run build`)
- [ ] smoke tests: login, board list/detail, mypage
- [ ] docs update 완료
