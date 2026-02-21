# PR Summary
- Goal:
- Scope:

# Feature Contract Input
- UI Contract file path (required for new screen):
- [ ] No UI contract (reason provided below)
- Reason if missing:

# API Contract
- [ ] No API change
- [ ] API change exists
- Changed endpoint(s):
- Request/Response field changes:
- Frontend affected routes:
- Backward compatibility impact:

# OpenAPI / Docs Sync
- [ ] OpenAPI spec checked (`/v3/api-docs`)
- [ ] Swagger UI checked (`/swagger-ui/index.html`)
- [ ] `docs/API_CHANGE_CHECKLIST.md` completed
- [ ] `docs/SCREEN_API_MAPPING.md` updated if needed
- [ ] `docs/VIBE_CODING_RULES.md` consulted

# UI 4-State Validation
- [ ] Loading state
- [ ] Empty state
- [ ] Error state
- [ ] Forbidden/Unauthorized state

# No Hollow Screen Check (Strict)
- [ ] 모든 표시 버튼이 실제 동작에 연결됨
- [ ] 폼 submit/검증/요청이 실제 동작함
- [ ] TODO/placeholder/mock-only UI 없음
- [ ] 미구현 기능은 disabled/hidden 처리 + PR에 명시됨

# Impact Table
- API impact: Yes / No
- Data shape impact: Yes / No
- Auth/Role impact: Yes / No
- Docs impact: Yes / No
- Release note impact: Yes / No

# Event / Funnel Impact
- Affected events (signup/login/conversion):
- Added/changed tracking fields:

# Validation
- [ ] `cd api-client-ui && npm run build`
- [ ] Auth flow smoke test (login/reissue/logout)
- [ ] Main route smoke test (core pages)

# Risk / Rollback
- Risk:
- Rollback plan:
