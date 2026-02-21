# PR Summary (요약)
- Goal (목표):
- Scope (범위):

# Feature Contract Input (화면 계약 입력)
- UI Contract file path (신규 화면 필수):
- [ ] No UI contract (reason provided below)
- Reason if missing (없으면 사유):

# API Contract (API 계약)
- [ ] No API change
- [ ] API change exists
- Changed endpoint(s):
- Request/Response field changes:
- Frontend affected routes:
- Backward compatibility impact:

# OpenAPI / Docs Sync (문서 동기화)
- [ ] OpenAPI spec checked (`/v3/api-docs`)
- [ ] Swagger UI checked (`/swagger-ui/index.html`)
- [ ] `docs/API_CHANGE_CHECKLIST.md` completed
- [ ] `docs/SCREEN_API_MAPPING.md` updated if needed
- [ ] `docs/VIBE_CODING_RULES.md` consulted

# UI 4-State Validation (필수 상태)
- [ ] Loading state
- [ ] Empty state
- [ ] Error state
- [ ] Forbidden/Unauthorized state

# No Hollow Screen Check (깡통 금지)
- [ ] 모든 표시 버튼이 실제 동작에 연결됨
- [ ] 폼 submit/검증/요청이 실제 동작함
- [ ] TODO/placeholder/mock-only UI 없음
- [ ] 미구현 기능은 disabled/hidden 처리 + PR 명시

# Impact Table (영향표)
- API impact: Yes / No
- Data shape impact: Yes / No
- Auth/Role impact: Yes / No
- Docs impact: Yes / No
- Release note impact: Yes / No

# Event / Funnel Impact (이벤트 영향)
- Affected events (signup/login/conversion):
- Added/changed tracking fields:

# Validation (검증)
- [ ] `cd api-client-ui && npm run build`
- [ ] Auth flow smoke test (login/reissue/logout)
- [ ] Main route smoke test (core pages)

# Risk / Rollback
- Risk:
- Rollback plan:
