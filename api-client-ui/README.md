# 洹몃┛ 而ㅻ??덊떚 ?꾨줎?몄뿏??
理쒖쥌 ?낅뜲?댄듃: 2026-02-21

???꾨줈?앺듃??`../API 湲곕뒫紐낆꽭.md`瑜?湲곗??쇰줈 援ы쁽??React + Vite ?대씪?댁뼵?몄엯?덈떎.

## 二쇱슂 湲곕뒫

### 1) ?몄쬆/?뚯썝
- 濡쒓렇?? `POST /members/login`
- 濡쒓렇?꾩썐: `POST /members/logout`
- ?뚯썝媛?? `POST /members`
- ???뺣낫 議고쉶: `GET /members`
- ???뺣낫 ?섏젙: `PATCH /members/{member-id}`
- ?뚯썝 ?덊눜: `DELETE /members`
- ?꾨줈???낅줈?? `POST /members/uploadProfile`
- ?좏겙 ?щ컻湲? `POST /api/auth/reissue` (401 諛쒖깮 ???ъ떆??
- OAuth2 Google 濡쒓렇?? `/oauth2/authorization/google`

### 2) ?湲곗뿴
- ?湲곗뿴 ?낆옣: `POST /api/queue/join`
- ?湲곗뿴 ?곹깭 議고쉶: `GET /api/queue/status`
- ?꾩슜 ?붾㈃: `/queue`

### 3) 寃뚯떆??- 紐⑸줉: `GET /boards`
- ?곸꽭: `GET /boards/{board-id}`
- ?묒꽦: `POST /boards/{free|eco|green}`
- ?섏젙: `PATCH /boards/{board-id}` (multipart)
- ??젣: `DELETE /boards/{board-id}`
- 醫뗭븘?? `POST /boards/{board-id}/Like`
- ??寃뚯떆湲: `GET /boards/myBoards`
- 泥⑤??뚯씪 ?ㅼ슫濡쒕뱶: `GET /file/{file-id}`

### 4) ?볤?
- ?묒꽦: `POST /comments`
- ?④굔 議고쉶: `GET /comments/{comment-id}`
- 紐⑸줉: `GET /comments?boardId={id}&page={n}&size={n}`
- ?섏젙/??젣: `PATCH`, `DELETE /comments/{comment-id}`
- 醫뗭븘?? `POST /comments/{comment-id}/Like`

### 5) ??궧/?듦퀎/湲고?
- 寃뚯떆????궧: `GET /boards/rankFreeBoards`, `/rankEcoBoards`, `/rankGreenBoards`
- ?덈꺼 ??궧: `GET /members/levelRanks`
- 湲곕? ??궧: `GET /members/donationRanks`
- ?듦퀎 ?붿빟: `GET /stats/summary`
- ?댁긽?먯?: `GET /stats/anomalies?limit={1..200}`
- 以묎컙吏??理쒖쟻?? `POST /api/optimizer/optimize`
- ?댁뒪 寃?? `GET /news`
- 湲고썑湲곌툑 怨꾩궛: `POST /calculators`
- GPT 吏덈Ц: `POST /gpt/question`

### 6) ??궎 ?뚮쭅肄?- 二쇱궗??援대━湲? `POST /game/dice/roll`
- ?ш뎬由? `POST /game/dice/reroll`
- ?뚮쭅肄??ㅽ뻾: `POST /game/plinko/play`
- ?쒕쾭 `landingSlots` 湲곗??쇰줈 理쒖쥌 ?щ’ 寃곌낵 ?숆린??
## ?붾㈃/沅뚰븳 李멸퀬
- 愿由ъ옄 ?댁긽?먯? 肄섏넄: `/app/admin/anomalies` (`ROLE_ADMIN` ?꾩슜)
- ?쇰컲 ?ъ슜?먮뒗 蹂댄샇 ?쇱슦??`ProtectedRoute`)瑜??듯빐 `/app/*` ?묎렐

## ?ㅽ뻾 諛⑸쾿
```bash
cd api-client-ui
npm install
npm run dev
```

- 諛깆뿏??湲곕낯 URL: `http://localhost:8080`
- ?꾨줎??湲곕낯 URL: `http://localhost:5173`

## 臾몄꽌
- API 紐낆꽭: `../API 湲곕뒫紐낆꽭.md`
- ?꾨줎??臾몄꽌 ?몃뜳?? `./docs/README.md`
- 怨듯넻 API ?대씪?댁뼵?? `src/utils/api.js`

## 理쒓렐 ?묒뾽 濡쒓렇

### 2026-02-21
- Admin Anomalies 肄섏넄 ?뺤옣
  - Incident Inbox, Timeline, Rule Editor, KPI, CSV 由ы룷??  - 議곗튂 ?≪뀡 ?곕룞: `BLOCK_QUEUE_USER`, `WARN_MEMBER`, `CLEAR_QUEUE_BLOCK`
- Lucky Plinko ?숆린??臾쇰━ 蹂댁젙
  - ?щ’ ?쒓컖 ?쇰뱶諛?媛쒖꽑
  - ?붾㈃ ?ш린 ???醫뚰몴 ?숆린??  - 理쒖쥌 寃곌낵 ?щ’ ?쇱튂 ?덉젙??
### 2026-02-22
- 愿由ъ옄 硫붿떊?(?뚮┝?? UI 異붽?: `/app/admin/anomalies`
  - 誘명솗???뚮┝ 紐⑸줉 議고쉶: `GET /admin/notifications?readYn=false&page=1&size=8`
  - ?④굔 ?쎌쓬: `PATCH /admin/notifications/{notification-id}/read`
  - ?꾩껜 ?쎌쓬: `POST /admin/notifications/read-all`
- ?좉퀬??UI 異붽?: `/app/admin/anomalies`
  - ?좉퀬 紐⑸줉 議고쉶/?꾪꽣: `GET /admin/reports?status={ALL|OPEN|IN_REVIEW|RESOLVED|REJECTED}`
  - ?좉퀬 泥섎━: `PATCH /admin/reports/{report-id}`
- 寃뚯떆湲/?볤? ?좉퀬 踰꾪듉 異붽?
  - 寃뚯떆湲 ?곸꽭: `POST /reports` (`targetType: "BOARD"`)
  - ?볤? 紐⑸줉: `POST /reports` (`targetType: "COMMENT"`)
- ?꾨줎??鍮뚮뱶 寃利? `npm run build` ?깃났- 沅뚰븳愿由?UI 異붽?: `/app/admin/anomalies`
  - ?뚯썝 沅뚰븳 議고쉶/寃?? `GET /admin/roles/members?keyword=&page=&size=`
  - 愿由ъ옄 沅뚰븳 遺???댁젣: `PATCH /admin/roles/members/{member-id}`
  - 沅뚰븳 蹂寃??대젰 議고쉶: `GET /admin/roles/audits?page=&size=`
  - ?덉쟾 洹쒖튃 諛섏쁺: 留덉?留?愿由ъ옄/?먭린 ?먯떊??愿由ъ옄 沅뚰븳 ?쒓굅 諛⑹?- ROLE_MASTER 諛섏쁺
  - `ROLE_MASTER`??愿由ъ옄 沅뚰븳?쇰줈 ?몄떇?섎룄濡?`src/utils/authorization.js` ?뺤옣
  - 愿由ъ옄 ?붾㈃ ?묎렐 ?먯젙 ??`ROLE_ADMIN` ?먮뒗 `ROLE_MASTER` ?덉슜- 愿由ъ옄 沅뚰븳愿由?UX 媛쒖꽑
  - 沅뚰븳 遺???댁젣 ?ㅽ뙣 ???좎뒪?몃줈 ?ㅻ쪟 硫붿떆吏 ?쒖떆(?? 403/400)
  - ?깃났 ??利됱떆 ?깃났 ?좎뒪???쒖떆 諛?紐⑸줉/?대젰 ?ъ“?? 沅뚰븳愿由??⑤꼸????沅뚰븳 諛곗? 異붽?
  - `??沅뚰븳: MASTER` / `??沅뚰븳: ADMIN` ?쒖떆
  - MASTER媛 ?꾨땺 ??愿由ъ옄 遺???댁젣 踰꾪듉 鍮꾪솢?깊솕- 沅뚰븳愿由?member-id ?ㅻ쪟 ?섏젙
  - 諛깆뿏???묐떟 `member_id`(snake_case) / `memberId`(camelCase) 紐⑤몢 泥섎━
  - `/admin/roles/members/{member-id}` ?몄텧 ??undefined ?꾩넚 臾몄젣 ?닿껐- Mypage JSX 寃쎄퀬 ?섏젙
  - `src/pages/Mypage.jsx`??`->` ?띿뒪?몃? JSX ?덉쟾 ?쒗쁽(`{"->"}`)?쇰줈 蹂寃?  - `npm run build` ???대떦 寃쎄퀬 ?쒓굅 ?뺤씤- ADMIN ?묎렐 遺꾨━ ?섏젙
  - `src/pages/AdminAnomalies.jsx`?먯꽌 MASTER ?꾩슜 API(`/admin/roles/*`)瑜?MASTER???뚮쭔 ?몄텧
  - ADMIN???댁긽?먯? ?붾㈃ 吏꾩엯 ??403?쇰줈 ?꾩껜 濡쒕뵫 ?ㅽ뙣?섎뜕 臾몄젣 ?닿껐
  - 沅뚰븳愿由??뱀뀡? MASTER?먭쾶留??몄텧- 愿由ъ옄 ?듭떖 ?댁쁺 ?⑤꼸 異붽? (`/app/admin/anomalies`)
  - ?ъ슜???쒖옱: `GET/POST/PATCH /admin/sanctions*`
  - 肄섑뀗痢?紐⑤뜑?덉씠?? `GET/PATCH /admin/moderation/boards*`, `/admin/moderation/comments*`
  - ?듯빀 Audit: `GET /admin/audits?type=...`
  - ?뺤콉 諛섏쁺: ADMIN? ?댁긽?먯?/?좉퀬/硫붿떊?/?쒖옱/紐⑤뜑?덉씠??Audit ?ъ슜 媛?? 沅뚰븳遺?щ뒗 MASTER留?媛?? 肄섑뀗痢?紐⑤뜑?덉씠??ID ?명솚??蹂닿컯
  - `src/pages/AdminAnomalies.jsx`?먯꽌 `boardId/board_id`, `commentId/comment_id` ?숈떆 吏??  - ?④?/蹂듦뎄 ?몄텧 ??ID ?レ옄 寃利?異붽?濡?`Parameter 'board-id' should be of type 'long'` ?щ컻 諛⑹?
- Admin ?댁긽?먯? ?붾㈃ ?쒓? 源⑥쭚 蹂듦뎄
  - `src/pages/AdminAnomalies.jsx` ?몄퐫?⑹쓣 UTF-8濡??뺢퇋??CP949 ????댁뒋 ?섏젙)
- ?꾨줎???몄퐫??媛?쒕젅??臾몄꽌??  - AGENTS.md??UTF-8(?쒓?) ???洹쒖튃 異붽?
  - PowerShell ?????CP949/ANSI 湲덉?, 源⑥쭚 臾몄옄??占? 챙, 챘) 利됱떆 蹂듦뎄 洹쒖튃 異붽?

### 2026-02-23
- 愿由ъ옄 ?댁쁺 ?붾㈃ 異붽?: `/app/admin/operations`
  - 湲곕뒫: 寃뚯떆湲/?볤? ?쇨큵 紐⑤뜑?덉씠?? ?뚯썝 360 ?곸꽭 議고쉶
  - ?곌껐 API:
    - `PATCH /admin/moderation/boards/batch`
    - `PATCH /admin/moderation/comments/batch`
    - `GET /admin/members/{member-id}`
- ?쇱슦???대퉬寃뚯씠???낅뜲?댄듃
  - `src/App.jsx` ?쇱슦??異붽?
  - `src/components/Header.jsx` 愿由ъ옄 硫붾돱 異붽?
  - `src/pages/AllMenu.jsx` 愿由ъ옄 硫붾돱 異붽?
- 寃利?  - `npm run build` ?깃났
- Admin 콘솔 흰 화면 수정
  - 원인: `src/pages/AdminAnomalies.jsx`에서 `ArrowRight` 아이콘 미-import로 런타임 ReferenceError 발생
  - 조치: `ArrowRight` import 추가
  - 검증: `npm run build` 성공
- 사용자 제재 UX 개선 (`/app/admin/anomalies`)
  - prompt 기반 입력 제거
  - 키워드(이름/이메일)로 회원 검색: `GET /members/list?keyword=&page=0&size=20`
  - 검색 결과에서 대상 회원 선택 후 사유/기간 입력하여 제재 등록
  - 제재 등록 API: `POST /admin/sanctions`
- 관리자 콘솔 안정화
  - `AdminAnomalies.jsx` 내 깨진 JSX 문자열/태그(헤더, 권한관리 버튼, 검색 placeholder 등) 문법 복구
- 검증
  - `npm run build` 성공

- Home banner carousel fix (`src/pages/Home.jsx`)
  - Fixed blank hero area by correcting slider track transform/width behavior.
  - Updated loop logic to one-way infinite autoplay using only registered banners.
  - Removed reverse navigation controls to keep operational one-direction flow.
- Home banner behavior update (`src/pages/Home.jsx`)
  - `CONTENT` + `image_url`: render banner background image with readable overlay.
  - `ADSENSE`: switch whole banner frame to ad-first layout (not inner card-only).
  - Keep gradient fallback when `image_url` is empty.
- Mypage level experience UX update (`src/pages/Mypage.jsx`)
  - Fetches `/members/level/history` when level tab is active.
  - Shows XP history cards with granted XP, penalty, and timestamp.
  - Normalizes wrapped API payload shapes (`data/items/content`) for stable rendering.
