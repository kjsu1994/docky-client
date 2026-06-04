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

## 2026-06-01 Applied Notes
- [x] `/app/games/video/:videoGameCode` uses `src/adapters/videoGameAdapter.js` for `/game/video/**` room APIs and subscribes to `/sub/game/video/{gameCode}/room/{roomId}` plus `/signal` only after the user is a room member. The iframe bridge sends transient Good_ETC input/snapshot payloads over `/pub/game/video/{gameCode}/room/{roomId}/signal`; trusted actor metadata is supplied by the backend STOMP relay. `npm run build` and static Good_ETC JS syntax checks passed.
- [x] `/app/optimizer` invalid address-count / valid-geocode shortage errors use the standard server error schema (`status`, `code`, `message`).
- [x] `src/adapters/optimizerAdapter.js` keeps the page component behind the adapter boundary and displays `ErrorResponse.message` through `getApiErrorMessage`.
- [x] Optimizer browser requests use `/api/optimizer/**` while the adapter calls backend `/optimizer/**`; legacy direct backend `/api/optimizer/**` remains compatible.
- [x] `/todos` range queries now reject windows longer than 93 days with the same standard error schema; the weekly/monthly/day UI remains within the supported range through `src/adapters/todoAdapter.js`.
- [x] `POST /todos` and `PATCH /todos/{todo-id}` now use documented `due_date` from `src/adapters/todoAdapter.js`; the server retains `dueDate` aliases and returns standard validation errors for blank titles or missing create dates.
- [x] `/app/facility` keeps the existing parking/restroom/library/bunker/medical response shapes; only the server-side radius bounding-box calculation was centralized and clamped for finite edge-coordinate ranges.
- [x] `/app/admin/anomalies` keeps the existing `/admin/audits` page response shape; the server only caps the internal `type=ALL` audit merge prefetch window for large manual requests.
- [x] `/app/facility` medical import/status response shapes stay unchanged; server-side medical missing-coordinate queue seeding now uses cursor batches instead of full-list JVM loading.
- [x] `/app/admin/streaming` keeps the existing upload/import response shapes; batch upload and inbox import now reject more than 8 files per request, and the UI enforces the same limit before calling `src/adapters/streamingAdapter.js`.
- [x] `/api/auth/reissue` uses POST with the `Refresh` header from `src/utils/api.js`, while also sending `Authorization: Bearer {refreshToken}` for deployed-client compatibility. Response token extraction accepts `Refresh`, `RefreshToken`, and bearer-prefixed values.
- [x] `/boards`, `/boards/myBoards`, and `/boards/rankBoards` keep the existing array response body and pagination headers; server-side page size is now bounded to 50/50/20 respectively to avoid oversized manual requests under concurrent traffic.
- [x] `/admin/anomalies/incidents`, `/admin/reports`, `/admin/sanctions`, `/admin/sanctions/release-requests`, `/admin/moderation/*`, `/admin/roles/*`, and `/admin/banners` keep their existing page response shape; server-side page size is bounded to 50 and `src/adapters/adminOperationsAdapter.js` no longer requests 100 moderation rows at once.
- [x] `/admin/anomalies/report?days={days}` keeps the CSV download response but now exports at most the latest 5,000 incidents; `AdminAnomalies` disables the download button while the request is in flight and shows Korean success/failure toasts.
- [x] `/admin/anomalies/incidents/{incident-id}` keeps the same detail response shape, but the `actions` timeline is bounded to the latest 100 logs so old incidents cannot return an unbounded action history.
- [x] `/app/statistics` keeps the existing `GET /stats/trend?days={days}` `days/items` response shape; the server now aggregates board/comment daily buckets in DB while `src/adapters/statsAdapter.js` continues response normalization.
- [x] `/stats/summary` and `/stats/visitors/compare` visitor-count fields keep the same response shape; server-side visitor tracking suppresses short-window duplicate Redis writes for the same visitor and releases the local reservation after a Redis write failure so a later request can retry. Redis visitor-count read failures degrade only the affected visitor counts to `0` instead of failing the whole stats response.
- [x] `/stats/dashboard` combines the existing summary and visitor-compare payloads under `summary` and `visitors_compare`; split `/stats/summary` and `/stats/visitors/compare` remain as fallback endpoints in `src/adapters/statsAdapter.js`.
- [x] `/app` homepage latest posts use `GET /boards/latest?kind=FREE_BOARD&kind=ADMIN_NOTICE&page=0&size=6` first, with legacy per-kind `/boards` fallback during staggered deployments; list item response shape stays the same, and the server now caches identical kind/page/sort reads for 5 seconds with write/moderation invalidation. If both latest and legacy list reads fail, the UI shows a delayed-posts notice and retry action instead of the empty-posts state.
- [x] `/app` homepage stats, latest posts, and banners still use the same API contracts, but their adapter calls now accept an `AbortController` signal so stale first-paint requests cannot overwrite newer route/auth state. If only the stats request fails while posts/banners succeed, the UI shows a delayed-stats notice and retry action instead of rendering misleading zero counters.
- [x] `/app` homepage banners keep the same `GET /banners` response contract. If the banner request fails, the UI keeps fallback content visible but also shows a delayed-banner notice and retry action so the fallback is not mistaken for a configured operating banner.
- [x] `/app` homepage partial-failure retry uses the same dashboard API contracts in background mode; it does not switch the already-rendered page back to the full-page loading state, disables duplicate retry clicks while the refresh is in flight, and preserves already-rendered successful sections if another section fails during the retry.
- [x] `/app` homepage banner previous/next/pause/dot controls and carousel accessibility attributes are client-only UI behavior and do not change banner API response or event request contracts. Infinite-loop clone slides keep only the visible slide active for aria/tab navigation.
- [x] `/banners/events` keeps the same `banner_id`, `event_type`, `placement` request shape; repeated `IMPRESSION` events for the same banner/placement/client are suppressed in a short window on client and before server banner lookup/event write, while failed client sends release the same-tab reservation and `CLICK` events remain unsuppressed. Client banner events are sent without the global loading indicator, and `CLICK` events prefer `navigator.sendBeacon` with `fetch keepalive` fallback so navigation immediately after a CTA click is less likely to drop analytics. Homepage banner CTAs render as semantic links and internal CTA navigation uses client-side routing; banner CTA/image URL normalization is client-only, allows only http(s) external URLs and `/` internal paths without quote/backslash/control characters, and does not change the banner API contract. Image-banner background loading is limited to the current/adjacent slides and does not change the API contract.
- [x] Board list-style responses keep the `contents` field but return only first-image plus short summary HTML; detail reads still provide the full sanitized content.
- [x] Board attachment uploads now use UUID-scoped server object keys to avoid same-name overwrites; `/boards` attachment responses and `/file/{file-id}` downloads keep exposing the display filename, and the UI continues to operate by `file_id`.
- [x] Board attachment uploads are capped at 5 files per board and 20MB per file; `src/adapters/boardAdapter.js` exposes the same limits so `BoardForm` rejects oversized selections before sending multipart requests.
- [x] `GET /file/{file-id}` keeps public downloads for visible board attachments but returns the standard not-found error for attachments whose board is hidden by moderation.
- [x] Public comment reads now require a visible parent board as well as a visible comment; hidden-board comments no longer appear through `/comments` list/detail APIs.
- [x] `DELETE /boards/{board-id}` keeps the existing no-content response; the server now removes stored board attachment objects before deleting the board row, so the client still deletes by board id through `boardAdapter`.
- [x] `POST /boards` and `PATCH /boards/{board-id}` keep the same fields but now sanitize board HTML at the server boundary; the client also sanitizes editor/detail HTML before sending or rendering.
- [x] `POST /comments` now uses the documented `board_id` request field from `src/adapters/commentAdapter.js`; the server retains `boardId` as a legacy alias and validates comment contents at 2,000 characters for create/update.
- [x] `POST /boards/{board-id}/Like` and `POST /comments/{comment-id}/Like` keep the existing response shape; server-side toggles now lock the visible target row before changing status/count/points, and client buttons keep their in-flight disabled states.
- [x] `POST /reports` now uses documented `target_type`/`target_id` fields from board/comment adapters; the server retains camelCase aliases and returns standard Korean error bodies for duplicate OPEN reports and invalid report id/type/status values.
- [x] `/pub/chat/message` keeps the existing camelCase WebSocket message fields while accepting snake_case aliases; the server validates room membership, TALK messages at 2,000 characters, and required FILE metadata before persisting.
- [x] `/ws/chat` STOMP CONNECT now requires `Authorization: Bearer {accessToken}` for chat and board-game realtime flows. The client builds that header through `src/adapters/realtimeAdapter.js`, avoids sending `Bearer null`, and treats `senderId` in outgoing chat payloads as optimistic UI metadata because the server persists the JWT principal as the sender.
- [x] `/sub/chat/room/{chatRoomId}` and `/sub/game/**/room/{roomId}` STOMP subscriptions now require the authenticated member to belong to the target room; clients should subscribe only after joining/restoring an active room.
- [x] `/pub/game/las-vegas/{roomId}/action` and `/pub/game/no-thanks/{roomId}/action` no longer send or trust client `member_id`; the server resolves the acting member from the STOMP JWT principal.
- [x] Security `401`/`403` error responses keep the standard `status/code/message` shape but now use Korean UTF-8 JSON at the Spring Security handler boundary instead of default English exception text. Missing authentication returns `UNAUTHORIZED`, invalid JWTs return `AUTHENTICATION_FAILED`, expired JWTs return `CREDENTIALS_EXPIRED`, and denied access returns `ACCESS_DENIED`.
- [x] Google OAuth2 entry remains `GET /oauth2/authorization/google` and callback remains `/login/oauth2/code/google`. The server now stores the OAuth2 authorization request in an HttpOnly `SameSite=Lax` cookie instead of an HTTP session so stateless blue/green backends can validate `state`; failed callbacks redirect to `/login?error=oauth2`, and the client also handles legacy `/login?error`.
