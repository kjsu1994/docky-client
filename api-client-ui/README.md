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
cd client
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
- Invest assistant localization update (`src/pages/InvestAssistant.jsx`)
  - Localized the bottom `limitations` and `available_sections` values on `/app/invest`.
  - Applied translation only at render time to keep API payloads and behavior unchanged.
- Invest assistant US finance/dividend update (`src/pages/InvestAssistant.jsx`)
  - `/app/invest` now also exposes US annual financial metrics and dividend snapshot/history when v3 returns supplemental data.
  - Reused the KR card layout for US so the added data does not change symbol search or chart behavior.
- Invest assistant US provider warning update (`src/pages/InvestAssistant.jsx`)
  - If US quote is available but SEC EDGAR fundamentals are unavailable, `/app/invest` now shows the provider cause near the summary card instead of leaving only blank finance/dividend slots.
  - SEC EDGAR provider failure details are localized for the limitation area and top warning copy.
- Invest assistant US news card update (`src/pages/InvestAssistant.jsx`)
  - `/app/invest` no longer renders the empty `뉴스 / 이슈` card for US symbols because the current US pipeline does not provide news items.
  - SEC/KIS limitation strings shown under `제약사항 / 섹션 상태` are localized in Korean.
- Invest assistant symbol suggest update (`src/pages/InvestAssistant.jsx`)
  - The frontend now shows only the top 2 symbol suggestions ranked by `match_score` so the dropdown does not cover the screen.
  - The backend suggest API still returns up to 5 items by the current request parameter, and the frontend trims the visible list.
- Mypage level experience UX update (`src/pages/Mypage.jsx`)
  - Fetches `/members/level/history` when level tab is active.
  - Shows XP history cards with granted XP, penalty, and timestamp.
  - Normalizes wrapped API payload shapes (`data/items/content`) for stable rendering.
- Feature removal (`src/App.jsx`, `src/components/Header.jsx`, `src/pages/AllMenu.jsx`, `src/pages/Home.jsx`)
  - Removed GPT question and electricity calculator routes/menu entry points.
  - Deleted page modules: `src/pages/GptQuestion.jsx`, `src/pages/Calculators.jsx`.
- Tabletop game lobby foundation update (`src/App.jsx`, `src/pages/games/GamesHub.jsx`, `src/pages/games/TabletopGame.jsx`)
  - Added Korean-first game hub entries and routes for Catan, Blokus, Mahe, and Dalmuti.
  - Header and full-menu game navigation now expose the game hub plus direct entries for Catan, Blokus, Mahe, and Dalmuti, so desktop and mobile users can reach the new board games without relying only on the bottom game tab.
  - Games hub now groups Catan, Blokus, Mahe, and Dalmuti under a first-screen `신규 보드게임` section, with older games separated below so the active board-game work is easier to find.
  - Games hub cards now use Korean-first status copy, tighter mobile spacing, full-width touch entry buttons on smartphones, and focus rings for keyboard navigation.
  - Games hub cards now include custom CSS mini-previews for each game type instead of a repeated generic icon, so Catan, Blokus, Mahe, and Dalmuti are visually distinguishable before entering a room.
  - Games hub previews for the four new board games now use richer locally drawn board/card miniatures: Catan terrain hexes with routes, Blokus polyomino placements, Mahe turtle-track stacks, and Dalmuti court cards, without external copyrighted assets.
  - Games hub labels and previews now prefer Korean board-game terms for new games, including Blokus `듀오` and Dalmuti `광` joker preview labels.
  - Games hub cards now show compact rule-scope chips and richer Korean link labels, making base/expansion, Duo/team, turtle-stack odds, and Dalmuti tax/revolution support easier to compare before entering a room.
  - Games hub cards now preload each lazy game route on desktop hover or keyboard focus, reducing pointer/keyboard entry delay while avoiding accidental large game-chunk downloads during smartphone scroll gestures.
  - Added shared room lobby UI for room title, room code entry, variant selection, ready state, host start, settings, and leave flow.
  - Shared board-game lobby now separates host and guest readiness clearly: the host sees the start-condition badge, while guests see ready/ready-cancel controls and ready badges.
  - Waiting rooms now show a start-condition checklist for player range, guest readiness, and host authority, including max-player validation when a host changes to a smaller variant.
  - Selected-room start guidance now derives the player range and key rule notes from the active variant instead of showing a Catan-specific hint for every game.
  - Shared room cards and selected-room headers now show variant group, variant summary, feature tags, and min/max player constraints so expansion rooms are understandable before joining or starting.
  - Variant selectors now group non-Catan games by their real choice type as well: Blokus base/Duo/player-count/team variants, Mahe base game, and Dalmuti official optional rules.
  - Room creation and host settings now include a grouped visual rule picker with Korean labels, base/expansion badges, player counts, and compact scrolling for smartphone/tablet screens.
  - The shared visual rule picker now exposes richer Korean comparison labels for each card and select option, including selected state, base/expansion type, player range, feature tags, and disabled reasons for screen readers and keyboard users.
  - Long variant pickers now use viewport-bounded scrolling with sticky Korean group headers and group counts, so Catan expansion/scenario selection stays readable on smartphone and tablet screens.
  - In active Catan, Blokus, Mahe, and Dalmuti rooms, smartphone/tablet layouts now render a sticky Korean quick-jump bar for the board, action, track, hand, or status sections so players can move between the visual board and touch controls without long scrolling.
  - Mobile/tablet quick-jump bars now account for the app's sticky header and increase anchor scroll margins, preventing board/action/status sections from landing hidden under the header.
  - Smartphone and tablet action strips now share bounded internal scrolling, so sticky controls stay usable without covering too much of the board on mid-size screens.
  - Vite production builds now clean the compose-served `C:/compose/minio-data/client/dist` directory before writing new hashed assets, preventing old board-game chunks from accumulating in the deployed static folder.
  - The `/app/games` hub is now lazy-loaded as its own production chunk, so users who are not entering the game hub do not pay for the new board-game card previews in the initial app bundle.
  - Rule picker cards now show server-provided Korean feature tags for each selected variant, such as Catanian 1/2 turns, Blokus shared green, Mahe turtle stacking, and Dalmuti stripped-deck tax flow, with a client fallback for older payloads.
  - Host settings now disable variant choices whose maximum player count is below the current room occupancy, with Korean inline reasons and a disabled save button before the backend rejection path.
  - Shared lobby inputs and primary room-flow controls use touch-sized targets, mobile-first wrapping, full-width smartphone buttons, and safer long-room-title wrapping for room-code entry, waiting-room join, ready/start, settings save, and leave actions.
  - Waiting-room cards now mark full rooms as `가득 참`, disable new joins locally, and change the action to `열기` when the viewer is already a participant.
  - Selected room headers now include a touch-sized `코드 복사` action so hosts can share the same room-code entry flow without manually selecting text on mobile.
  - The shared tabletop screen scopes mobile browser safeguards for touch manipulation, 16px mobile form inputs to avoid iOS zoom, and safer long-text wrapping.
  - Shared tabletop layouts now force grid/flex children and board media to shrink within their containers, reducing horizontal page overflow risk on smartphone and tablet widths while keeping intentional board/hand rails scrollable.
  - Shared play surfaces now use game-specific accent variables, safer touch feedback, smooth contained board/hand scrolling, and stronger safe-area-aware mobile action-strip depth without changing server actions or room flow.
  - The shared rules panel now renders game-specific Korean rule cards for objective, turn flow, scoring, and official variants, so Catan, Blokus, Mahe, and Dalmuti explain the server-enforced rules without changing gameplay actions.
  - Shared create/join/waiting-room controls now expose Korean labels for room title, room code, variant selection, refresh, ready/start, settings save, room actions, and listed-room entry; empty room-code submits are disabled locally before the API call.
  - Shared tabletop lobbies now distinguish initial loading, failed variant/room fetches, manual room-list refresh progress, and true empty-room states in Korean so mobile users do not see a silent disabled room-flow screen.
  - Lobby fetch errors now include a touch-sized Korean `다시 시도` action that reloads both variant metadata and room lists, which is important when expansion selection metadata fails before room creation.
  - Lobby metadata reloads, saved-room restoration, room opening, state fetches, and STOMP room updates now ignore stale responses after route changes or rapid room switches, so quickly moving between Catan, Blokus, Mahe, and Dalmuti cannot mix the previous game's room/variant/state data into the next screen.
  - Board interaction targets now have scoped hover/tap feedback, selected-card depth, and reduced-motion-aware highlights for active/projected spaces without relying on external copyrighted assets.
  - Shared game actions now use a client-side in-flight guard and Korean "서버 판정 중" status text so rapid repeated taps do not submit duplicate moves while the backend validates the action.
  - While a move is being judged by the server, the active board area now shows a Korean overlay and blocks further board taps across Catan, Blokus, Mahe, and Dalmuti.
  - Dynamic turn, selection, room-request, and server-judgement messages now use polite live-status regions so browser/tablet/mobile assistive technologies can follow state changes without altering the visual layout.
  - Shared room actions now also use a synchronous ref guard plus disabled controls while create, join, ready, start, settings save, rematch, force-finish, or leave requests are pending, so pre-game and post-game mobile taps cannot submit duplicate room operations before React state finishes updating.
  - Room state load failures from non-member or stale saved rooms now clear the selected room/subscription and ask the user to re-enter.
  - Added `npm run smoke:tabletop-ui`, a no-dependency Chrome/Edge DevTools smoke check that mocks authenticated member/game API responses and opens `/app/games` plus Catan, Blokus, Mahe, and Dalmuti lobbies at desktop, tablet, and smartphone widths.
  - The same smoke check now clicks the shared room flow for all four new games: create a titled room, send host start, join by room code, and send guest ready, while asserting the REST payloads and Korean waiting-room text.
  - Verification: `npm run smoke:tabletop-ui` succeeded on 2026-05-31 for 15 route/viewport combinations plus Catan, Blokus, Mahe, and Dalmuti create/start/join-by-code/ready interaction flows, with Korean hub/lobby text present, the Catan active-room selected-rule brief present, and no page-level horizontal overflow.
  - Verification: `npm run build` succeeded on 2026-05-31 after adding shared tabletop lobby loading/error/refresh states, new-game navigation entries, and mobile quick-jump offset fixes.
  - Game detail routes now lazy-load Las Vegas, No Thanks, and shared tabletop screens so the games hub and general app entry do not eagerly load every board-game UI.
  - Mapped the new shared APIs in `docs/SCREEN_API_MAPPING.md`.
  - Verification: `npm run build` succeeded on 2026-05-30.
- Catan play screen update (`src/pages/games/TabletopGame.jsx`)
  - Added the playable island-board screen under `/app/games/catan` after the same shared room start flow.
  - Catan room creation/settings now expose the server-provided official variant list, grouped by base game, 5-6 player expansion, Seafarers, Traders & Barbarians, Explorers & Pirates, and Cities & Knights.
  - Renders Korean-first setup guidance, SVG hex/sea/gold board, foreign-island and Four Islands island outlines, Fog Islands 미탐험 타일/발견 안내, Through the Desert 사막/외국 지역 안내, Forgotten Tribe 부족 섬/선물 해안 표식/선물 승점 배지, Catan for Cloth 부족 마을/직물 공급/직물 승점 표시, harbor markers, fishing-ground markers, vertex/edge build targets, robber/pirate target selection, 7-discard controls, E&P 해적 이동 안내, Cities & Knights first-barbarian-attack robber-lock guidance and progress-card hand-limit discard controls, gold-field and Aqueduct resource choice controls, dice/resource/commodity panels, development cards, player-to-player resource trade proposal/accept/reject/cancel controls, ship build/move controls, Seafarers foreign-island special-victory/home-island badges, Traders & Barbarians harbor-point/Harbormaster, Friendly Robber protection, Fishermen fish-token/old-boot badges, Rivers bridge/gold controls, Caravans oasis/camel markers and wool/grain bid/placement controls, Barbarian Attack coastal/barbarian/defensive-knight markers and expel controls, Explorers & Pirates 미발견 타일/탐험 발견 markers, gold/harbor-settlement/settler/crew/fish/spice/pirate-lair mission badges, spice-village advantage counters, harbor-settlement build mode, settler/crew/fish/spice cargo controls, one-large/two-small cargo markers, pirate-lair crew/capture markers, council dock markers, and Swift Voyage-aware ship movement path picker, Cities & Knights event-die/progress-card/knight/city-improvement/city-wall/barbarian panels, phase-aware 5-6 player Catanian 1/2 turn markers, player scores, bonus badges, and recent event records.
  - Uses `POST /game/catan/rooms/{roomId}/actions` for server-authoritative `SETUP_BUILD`, `ROLL_DICE`, `DISCARD_RESOURCES`, `DISCARD_PROGRESS_CARD`, `CHOOSE_GOLD_RESOURCE`, `CHOOSE_AQUEDUCT_RESOURCE`, `MOVE_ROBBER`, `MOVE_PIRATE`, `BUILD_ROAD`, `BUILD_BRIDGE`, `BUILD_SHIP`, `MOVE_SHIP`, `BUILD_SETTLER`, `LOAD_SETTLER`, `BUILD_CREW`, `UNLOAD_CREW_TO_PIRATE_LAIR`, `ROLL_FISH_HAUL`, `CATCH_FISH`, `COLLECT_SPICE`, `SELL_RESOURCE_FOR_GOLD`, `CHASE_AWAY_PIRATE`, `TRANSFER_CARGO`, `DELIVER_CARGO`, `FOUND_SETTLEMENT_FROM_SHIP`, `SPEND_FISH_MOVE_ROBBER`, `SPEND_FISH_STEAL_RESOURCE`, `SPEND_FISH_TAKE_RESOURCE`, `SPEND_FISH_BUILD_ROAD`, `SPEND_FISH_DRAW_DEVELOPMENT`, `GIVE_OLD_BOOT`, `SPEND_GOLD_FOR_RESOURCE`, `BID_CAMEL`, `PLACE_CAMEL`, `RECRUIT_BARBARIAN_KNIGHT`, `EXPEL_BARBARIANS`, `BUILD_KNIGHT`, `ACTIVATE_KNIGHT`, `PROMOTE_KNIGHT`, `MOVE_KNIGHT`, `MOVE_DISPLACED_KNIGHT`, `CHASE_ROBBER_WITH_KNIGHT`, `BUILD_CITY_IMPROVEMENT`, `BUILD_CITY_WALL`, `PLAY_PROGRESS_CARD`, `REMOVE_DESERTER_KNIGHT`, `PLACE_DESERTER_KNIGHT`, `MOVE_INTRIGUE_KNIGHT`, `RESPOND_COMMERCIAL_HARBOR`, `CHOOSE_MASTER_MERCHANT_CARDS`, `CHOOSE_SPY_PROGRESS_CARD`, `RESPOND_WEDDING_CARDS`, `BUILD_SETTLEMENT`, `BUILD_HARBOR_SETTLEMENT`, `BUILD_CITY`, `MARITIME_TRADE`, `PROPOSE_TRADE`, `ACCEPT_TRADE`, `REJECT_TRADE`, `CANCEL_TRADE`, `BUY_DEVELOPMENT_CARD`, `PLAY_DEVELOPMENT_CARD`, and `END_TURN`.
  - Cities & Knights progress-card controls wire Alchemist, Commercial Harbor, Crane, Engineer, Inventor, Irrigation, Medicine, Mining, Road Building, Smith with Fortress-gated mighty-knight promotion, Warlord, Resource Monopoly, Trade Monopoly, Bishop, Deserter, Diplomat, Intrigue, Master Merchant exact-card selection, Merchant, Merchant Fleet, Saboteur, Spy exact-card selection, and Wedding exact-card response to server-side effects; Printer and Constitution remain passive victory-point cards.
  - Cities & Knights action-phase progress-card selector now excludes roll-phase Alchemist and passive victory-point cards, with Korean guidance shown when only automatic or roll-phase cards are in hand.
  - Cities & Knights progress-card hand chips now label each card as `행동 단계`, `주사위 전`, or `자동 승점`, reducing confusion about Alchemist and passive victory-point timing.
  - Cities & Knights barbarian records include individual city pillage events after tied weakest-player and metropolis-immunity resolution, and tied defenders can choose their progress-card deck before production resolves.
  - Trade controls now show the effective exchange ratio from ports, Merchant, and Merchant Fleet instead of a static 4:1 label.
  - Recent Catan event labels include resource supply shortage, matching the server rule that a scarce produced resource is skipped for that roll; bank-trade and Year of Plenty shortages are rejected by the server.
  - My-resource cards now also show the public bank remainder for each base resource from server `resourceBank`, and gold-field, Aqueduct, maritime trade, and Year of Plenty controls use those counts for Korean pre-submit warnings/disabled states without exposing opponent hands.
  - Broadcast updates refresh the viewer-specific state so only the local player's detailed resources and development cards are visible.
- New Catan rooms default to the base game but can switch to the implemented expansion/scenario variants before start.
  - Player score rows now distinguish the local player's private development-card victory points from public points, while opponents remain shown as public score only.
  - Finished Catan games now show a Korean final-winner strip at the top of the board panel instead of only the compact action-panel result.
  - Victory-point development cards are labeled as automatic hidden points and are excluded from the playable development-card action selector, matching the server rule that they cannot be manually played.
  - 5-6 player Catanian markers now distinguish setup, Catanian 1 roll/action, Catanian 2 follow-up action, next-marker movement, the viewer's current marker role, and the result of pressing turn end in Korean guidance.
  - The Catan action panel and mobile board footer now summarize selected board targets in Korean, replacing raw vertex/edge/hex IDs with tile terrain/number/production, route/cargo/camel/dock, and vertex building/port/knight/cargo details.
  - Catan selected-target labels and Cities & Knights knight board markers now use Korean game terms such as `선택 타일`, `선택 간선`, `선택 교차점`, and `기1` instead of raw target IDs or English knight abbreviations.
  - The Catan mobile selected-target footer now includes an `액션 보기` jump link to the action panel, reducing the scroll distance after choosing a hex, edge, or vertex on smartphone screens.
  - The Catan action panel now includes a smartphone/tablet `보드 보기` jump link back to the board, making the board-selection/action-panel loop usable without repeated long scrolling.
  - Catan now renders a board-top `지금 할 일` status card with phase, turn owner, target score, selected-target count, and a Korean next-action hint so browser, tablet, and smartphone users can see the required next step before scrolling into the long action panel.
  - Catan now also renders a board-top selected-rule brief for base game, 5-6 player, Seafarers scenarios, Cities & Knights, Traders & Barbarians modules, and Explorers & Pirates, using the sanitized game-state flags without changing any action payload.
  - Catan now also participates in the shared mobile quick-jump bar, linking directly to `보드` and `액션` from the active room header area.
  - Catan board hexes, routes, cloth villages, and vertices are now keyboard-focusable SVG controls with Korean labels and visible focus outlines, so desktop browser users can select board targets without a mouse while touch users keep the same tap flow.
  - Catan board hexes now use locally drawn SVG terrain textures for forest, pasture, field, hill, mountain, desert, gold, sea, and unexplored tiles instead of flat fills, without introducing external copyrighted assets.
  - Cities & Knights knight-placement controls now pre-check the server's empty-intersection and own-route adjacency requirements before sending `BUILD_KNIGHT`, with Korean guidance when the selected vertex is not a legal knight build spot.
  - Cities & Knights knight-move controls now mirror the server road-network reachability check before enabling `기사 이동`, with Korean guidance when the selected destination is not connected from the marked source knight.
  - Base-game trade, development-card purchase, and development-card play buttons now pre-disable clear invalid actions such as insufficient resources, same-resource maritime trade, newly purchased cards, and missing knight/road-building targets.
  - Newly purchased development cards are hidden from the playable selector until the next turn, with Korean guidance explaining the one-card-per-turn and next-turn timing rules.
  - Catan action-panel controls now use touch-sized targets and safer Korean label wrapping for smartphone and tablet layouts.
  - Pending player-trade cards now explain that a proposal must be accepted, rejected, or cancelled before another proposal is created.
  - Player-to-player resource trade controls now render not only in the 3~4 player base game but also in resource-only Catan variants such as the 5~6 player extension, Seafarers, and Traders & Barbarians rooms; Cities & Knights and Explorers & Pirates keep their specialized card/cargo flows separate.
  - Seafarers player badges now render home/settled island and foreign-region identifiers as Korean numbered labels such as `1번, 2번` instead of comma-only raw ID text.
  - Verification: `npm run build` succeeded on 2026-05-31 after adding the Catan next-action status card.
- Blokus play screen update (`src/pages/games/TabletopGame.jsx`)
  - Added the first playable board-game screen under `/app/games/blokus` after the shared room start flow.
  - Renders the 20x20 board or Duo 14x14 board, clockwise start-point markers, current color/seat, piece selector, rotate/flip controls, official-rule placement preview for start/corner/edge/contact errors, tap-to-preview placement confirmation, mobile board density controls, pass action, score panel, and recent moves in Korean-first UI.
  - Smartphone-width screens now default to the tighter mobile board density, while tablet/desktop screens keep the standard density and still expose manual density controls with touch-sized buttons.
  - Blokus board density selection is now stored locally, so players who switch to mobile/compact/standard/expanded cells keep the same board scale when reopening the room or returning on the same device.
  - Blokus now renders a board-top `지금 할 일` status card with the current color, selected piece, total legal placements, selected anchor cell, and the next placement/pass hint before the piece drawer and mobile sticky controls.
  - 블로커스 모바일 배치 바에서 회전/뒤집기와 빠른 조각 선택을 바로 처리할 수 있어, 스마트폰/태블릿에서 보드와 조각 패널 사이를 왕복하지 않아도 됩니다.
  - Selected pieces now show the current legal-placement count, total legal-placement count across all remaining pieces, remaining piece/square totals, and Korean pass guidance so players understand that passing is only accepted when every remaining piece is blocked.
  - Blokus 3-player rooms now explain the shared green color turn order in Korean, and the score panel marks green as a shared non-scoring color while the server test pins player 1 -> 2 -> 3 controller rotation.
  - Mobile and tablet layouts now include a safe-area-aware sticky placement strip directly under the board, so players can confirm a selected cell or pass without scrolling back to the side panel.
  - Blokus now exposes mobile quick jumps for `보드` and `놓기`, anchored to the board panel and sticky placement strip.
  - The score panel now breaks down official scoring per color in a compact responsive layout: remaining-square penalty, completion +15, last one-square piece +5, and team/two-color totals.
  - Score rows and the final-winner strip now resolve Blokus score groups to room nicknames, including two-color players and team variants, instead of showing only generic seat labels.
  - Blokus board cells now expose Korean coordinate/status labels for occupied colors, start points, selected anchors, and legal/illegal placement previews, improving keyboard review without changing the touch board.
  - Blokus rotate/flip controls and piece buttons now expose Korean action labels with current orientation, piece size, legal-placement count, and selected state for keyboard and screen-reader use.
  - Piece pickers now show per-piece legal-placement counts and expose a Korean "둘 수 있는 조각 자동 선택" action when the current piece is blocked but another remaining piece can still be placed.
  - Variant options use the shared room min/max player contract, while the server engine now also rejects invalid Blokus variant/player-count pairs.
  - Finished games now surface a Korean final-winner strip from the server `winner` score flag instead of relying only on the compact score list icon.
  - Uses `POST /game/blokus/rooms/{roomId}/actions` for server-authoritative `PLACE` and `PASS`.
  - Verification: `npm run build` succeeded on 2026-05-31.
- Mahe play screen update (`src/pages/games/TabletopGame.jsx`)
  - Added the playable turtle-race screen under `/app/games/mahe` after the same shared room start flow.
  - Renders the circular track, responsive mobile-sized spaces, start raft, turtle stacks, visible egg card, final 7-egg reward state, remaining egg count, dice controls, projected movement/scoring hints, scores, and recent records with Korean action labels.
  - Mahe now renders a track-top `지금 할 일` status card with phase, active player, dice sum, current egg value, and a push-your-luck hint before the circular track and sticky roll controls.
  - Mahe now highlights the active and projected turtle spaces, and the dice panel shows safe remaining sum, next-roll bust odds, safe/bust die faces, and stop-now movement/scoring outcome.
  - Mahe dice decisions now show per-face next-roll outcomes plus 1/2/3-dice safety, bust, movement, and scoring odds for carried-turtle forced choices on both mobile and desktop.
  - Mahe now explains stacked turtle order in Korean on both the mobile sticky strip and desktop dice panel, including which turtles move together and when the top turtle chooses dice count for a carried turtle.
  - Mahe scoring previews now name the top turtle that will receive the egg when a carried stack crosses the finish line, avoiding confusion between the active lower turtle and the scoring rider.
  - Mahe risk guidance now states exactly which moving turtle segment returns to start on a bust and calls out the final 7-point egg ending condition.
  - Mahe track spaces, the start raft, next-roll outcome tiles, and carried dice-count buttons now expose Korean labels for stack order, active/projected positions, bust risk, safe movement, and egg-scoring chances.
  - The Mahe start raft now uses the same active/projected highlight treatment as numbered track spaces, so starting turtles and wrap-around destination previews remain visible on browser, tablet, and smartphone layouts.
  - Score rows now show egg-card counts and the tie-break reminder, matching the server rule that tied final scores are ordered by having more egg cards.
  - The track and dice panels now use tighter smartphone padding with touch-sized dice action buttons while keeping tablet/desktop spacing.
  - Mobile layouts now include a safe-area-aware dice action strip directly under the track, mirroring roll/stop and dice-count decisions without forcing players to scroll to the side panel.
  - Mahe now exposes mobile quick jumps for `트랙` and `굴리기`, anchored to the circular track and sticky dice strip.
  - Turn, score, winner, and recent-record text now resolves room participant nicknames instead of relying only on seat numbers.
  - Variant options use the shared room min/max player contract, and the server engine now also rejects invalid Mahe variant/player-count pairs.
  - Finished games now show a Korean final-winner strip with total score from the server `winner` score flag.
  - Uses `POST /game/mahe/rooms/{roomId}/actions` for server-authoritative `ROLL_DIE`, `STOP_ROLLING`, and `CHOOSE_DICE_COUNT`.
  - Verification: `npm run build` succeeded on 2026-05-31.
- Dalmuti play screen update (`src/pages/games/TabletopGame.jsx`)
  - Added the playable climbing-card screen under `/app/games/dalmuti` after the same shared room start flow.
  - Renders Korean-first role status, hand number, stripped-deck and first-deal-revolution badges, current/next social turn order, hidden-hand counts, current trick, revolution/tax panels, selectable hand cards, submit/pass controls, per-hand result scoring, cumulative score ranking, recent plays, and event records.
  - Current trick panels now show pass progress and explain when the trick will clear, including the official case where the lead player already went out and every remaining player must pass.
  - Tax-return panels now show both Greater/Lesser Dalmuti tax exchanges, completed/waiting status, and explain that peons' best cards move automatically while Dalmuti players select return cards.
  - Revolution declare/skip controls normalize eligible and declined seat numbers from the sanitized state before enabling the local buttons, so the Korean decision panel remains usable even if the payload mixes numeric and string seat IDs.
  - Selected hand cards now show an immediate Korean validity hint for rank/count/climbing rules, and the submit/pass controls use a mobile sticky action strip with touch-sized buttons so long hands do not push actions out of reach.
  - Tax-return controls now also appear in the mobile sticky hand strip and stay disabled until the required return-card count is selected, so Dalmuti players do not need to scroll back to the tax panel after choosing cards.
  - The sticky action strip now summarizes the selected cards as compact chips with a one-tap clear action, reducing accidental submits on smartphone hands.
  - The mobile sticky action strip now respects device safe areas for smartphone browser chrome and notched screens.
  - Dalmuti's top progress notice now uses the same `지금 할 일` pattern, showing phase, current player, selected-card count, current trick baseline, and the next legal obligation before the hand grid.
  - Dalmuti now exposes mobile quick jumps for `판세`, `손패`, and `제출`, anchored to the status panel, hand panel, and sticky submit strip.
  - Dalmuti's hand submit strip now stays sticky through tablet widths, matching Blokus and Mahe so selected-card submission remains reachable while reviewing long hands.
  - Hand cards now include grouped quick-select controls by rank, including playable/blocked badges, current-trick count limits, joker fill support, and tax-return hints, so long mobile hands can be played without tapping every matching card one by one.
  - Dalmuti rank quick-select buttons now expose Korean action labels for selected state, playable/blocked badge, and joker/tax-return reason so long hands remain understandable without visual-only cues.
  - Dalmuti hand cards now expose Korean card-state labels and pressed state for rank, joker/wild status, selected state, and disabled phases, improving keyboard and screen-reader review of long hands.
  - Dalmuti joker cards now render their large face marker as Korean `광` in both the hub preview and in-game hand cards, while keeping the server `jester`/rank data unchanged.
  - A Korean progress notice now stays visible at the top of the Dalmuti board and in the smartphone hand-action strip, calling out the viewer's current obligation during play, tax return, revolution decisions, and finished-hand review.
  - Uses `POST /game/dalmuti/rooms/{roomId}/actions` for server-authoritative `DECLARE_REVOLUTION`, `SKIP_REVOLUTION`, `RETURN_TAX`, `PLAY`, and `PASS`.
  - Broadcast updates refresh the viewer-specific state so only the local player's hand is visible.
  - Verification: `npm run build` succeeded on 2026-05-31.
