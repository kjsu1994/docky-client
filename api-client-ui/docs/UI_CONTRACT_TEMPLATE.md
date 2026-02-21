# UI Contract Template

## 1) Feature Meta
- Feature name:
- Owner:
- Related backend feature/API:
- Target release:

## 2) Goal
- One-line goal of this screen:
- Success metric (optional):

## 3) Target User / Permission
- Target roles:
- Permission gate rules (show/hide/edit/delete):

## 4) Primary User Flow
1. Entry point:
2. Main action path:
3. Success path:
4. Failure path:

## 5) Screen Composition
- Section order (top -> bottom):
- Required components:
- Optional components:
- CTA priority (primary/secondary):

## 6) API Mapping (OpenAPI-aligned)
- Endpoint(s):
- Request payload fields:
- Response fields used in UI:
- Error codes used in UI:

## 7) UI State Rules (Mandatory)
- Loading state:
- Empty state:
- Error state:
- Forbidden/Unauthorized state:

## 8) Data Display Rules
- Sort order:
- Pagination rules:
- Date/number format:
- Null/default fallback:

## 9) UX Copy
- Button labels:
- Toast messages:
- Error messages:

## 10) Action Wiring Map (No Hollow UI)
- Primary CTA -> handler -> API(or local action):
- Secondary CTA 1 -> handler -> API(or local action):
- Secondary CTA 2 -> handler -> API(or local action):
- Form submit -> validation -> API:
- Retry button -> retry handler:

## 11) Functional Completeness Gate
- [ ] 모든 표시 버튼이 실제 동작에 연결됨
- [ ] TODO/placeholder/mock 버튼 없음
- [ ] 입력 폼 submit이 실제 검증/요청 수행
- [ ] 실패 시 사용자 복구 동작(다시 시도/뒤로가기) 제공

## 12) Acceptance Criteria
- [ ] Scenario 1:
- [ ] Scenario 2:
- [ ] Scenario 3:

## 13) Out of Scope
- Not included in this feature:

## 14) Notes
- Design reference links:
- Additional implementation notes:
