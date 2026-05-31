# 화면별 API 매핑

이 문서는 프론트 화면이 사용하는 주요 API를 추적하기 위한 운영 문서입니다. 라우트나 API 계약이 바뀌면 같은 변경에서 함께 갱신합니다.

## 공통

- 인증 사용자 조회: `GET /members`
- 토큰 재발급: `POST /api/auth/reissue`
- 공통 API 클라이언트: `src/utils/api.js`
- 페이지별 도움말: `src/common/PageGuideButton.jsx`, `src/common/pageGuides.js`
- 보호 라우트는 `ProtectedRoute`를 통과한 뒤 `AppLayout` 안에서 렌더링합니다.
- 주요 앱 라우트는 `React.lazy`로 분리되어 초기 진입 번들을 줄입니다.
- 플로팅 채팅은 `React.lazy`로 별도 청크에서 로드되지만, 사용하는 REST/WebSocket API는 기존과 같습니다.

## 공개 화면

- `/login`
  - `POST /members/login`
  - OAuth 진입: `/oauth2/authorization/google`
- `/register`
  - `POST /members`
- `/queue`
  - `POST /api/queue/join`
  - `GET /api/queue/status`
  - `DELETE /api/queue/leave`

## 앱 홈과 커뮤니티

- `/app`
  - `GET /stats/summary`
  - 게시글/랭킹/배너 요약 API
- `/app/boards/:kind`
  - `GET /boards`
- `/app/boards/:kind/:boardId`
  - `GET /boards/{board-id}`
  - `GET /comments?boardId={id}&page={page}&size={size}`
  - `POST /comments`
  - `POST /reports`
- `/app/boards/:kind/new`
  - `POST /boards/{free|eco|green}`
- `/app/boards/:kind/:boardId/edit`
  - `PATCH /boards/{board-id}`
  - `DELETE /boards/{board-id}/files/{file-id}`
- `/app/chat`
  - `GET /chat/rooms`
  - `POST /chat/room`
  - `GET /chat/room/{roomId}/messages`
  - `GET /chat/room/{roomId}/members`
  - `PATCH /chat/room/{roomId}/read`
  - `POST /chat/room/{roomId}/file`
  - 플로팅 채팅도 같은 API를 공유합니다.

## 개인/정보 화면

- `/app/mypage`
  - `GET /members`
  - `GET /boards/myBoards`
  - `GET /members/level/history`
- `/app/mypage/edit`
  - `PATCH /members/{member-id}`
  - `POST /members/uploadProfile`
- `/app/ranks`
  - `GET /boards/rankBoards?kind={kind}`
  - `GET /members/levelRanks`
  - `GET /members/donationRanks`
- `/app/news`
  - `GET /news`
- `/app/statistics`
  - `GET /stats/summary`
  - `GET /stats/visitors/compare`
  - `GET /stats/trend?days={days}`

## 편의 도구

- `/app/todos`
  - 할 일 목록 API
- `/app/streaming`
  - 스트리밍 허브 API
  - 목록 화면은 `hls.js`를 포함하지 않고, 영상 재생 URL이 준비될 때 동적으로 플레이어 엔진을 로드합니다.
- `/app/invest`
  - 투자 분석 API
  - 국내/미국 종목 보조 데이터는 응답에 있을 때만 렌더링합니다.
- `/app/facility`
  - 주차장, 화장실, 도서관, 대피소, 의료시설 하위 화면을 지연 로딩합니다.
- `/app/optimizer`
  - `POST /api/optimizer/optimize`

## 게임

- `/app/games`
  - 게임 허브. 게임 설명서 모달은 클라이언트 로컬 데이터만 사용합니다.
  - 보드게임 입장 방식은 공통 흐름을 유지합니다: 방 제목 입력, 방 코드 입장, 준비, 방장 시작.
- `/app/plinko`
  - `POST /game/dice/roll`
  - `POST /game/dice/reroll`
  - `POST /game/plinko/play`
- `/app/games/catan`
  - `GET /game/catan/variants`
  - `GET /game/catan/rooms`
  - `POST /game/catan/rooms`
  - `GET /game/catan/rooms/me`
  - `POST /game/catan/rooms/join-by-code`
  - `POST /game/catan/rooms/{roomId}/join`
  - `POST /game/catan/rooms/{roomId}/ready`
  - `POST /game/catan/rooms/{roomId}/start`
  - `PATCH /game/catan/rooms/{roomId}/settings`
  - `POST /game/catan/rooms/{roomId}/leave`
  - `GET /game/catan/rooms/{roomId}/state`
  - `POST /game/catan/rooms/{roomId}/actions`
- `/app/games/blokus`
  - 공통 방 API: `/game/blokus/variants`, `/game/blokus/rooms`, `/game/blokus/rooms/{roomId}/state`
  - 액션: `POST /game/blokus/rooms/{roomId}/actions` (`PLACE`, `PASS`)
- `/app/games/mahe`
  - 공통 방 API: `/game/mahe/variants`, `/game/mahe/rooms`, `/game/mahe/rooms/{roomId}/state`
  - 액션: `POST /game/mahe/rooms/{roomId}/actions` (`ROLL_DIE`, `STOP_ROLLING`, `CHOOSE_DICE_COUNT`)
- `/app/games/dalmuti`
  - 공통 방 API: `/game/dalmuti/variants`, `/game/dalmuti/rooms`, `/game/dalmuti/rooms/{roomId}/state`
  - 액션: `POST /game/dalmuti/rooms/{roomId}/actions` (`DECLARE_REVOLUTION`, `SKIP_REVOLUTION`, `RETURN_TAX`, `PLAY`, `PASS`)
- `/app/games/las-vegas`
  - 라스베가스 게임 API
- `/app/games/no-thanks`
  - 노 땡스 게임 API

## 관리자

- `/app/admin/anomalies` (`ROLE_ADMIN`)
  - `GET /stats/summary`
  - `GET /stats/anomalies?limit={limit}`
  - `GET /admin/anomalies/kpi?days={days}`
  - `GET /admin/anomalies/rules`
  - `PUT /admin/anomalies/rules`
  - `GET /admin/anomalies/incidents?status={status}&page={page}&size={size}`
  - `GET /admin/anomalies/incidents/{incident-id}`
  - `PATCH /admin/anomalies/incidents/{incident-id}`
  - `POST /admin/anomalies/incidents/{incident-id}/actions`
  - `GET /admin/anomalies/report?days={days}`
  - `GET /admin/notifications`
  - `PATCH /admin/notifications/{notification-id}/read`
  - `POST /admin/notifications/read-all`
  - `GET /admin/reports`
  - `PATCH /admin/reports/{report-id}`
  - `GET /admin/sanctions`
  - `POST /admin/sanctions`
  - `PATCH /admin/sanctions/{sanction-id}/release`
  - `GET /admin/sanctions/release-requests`
  - `GET /admin/moderation/boards`
  - `PATCH /admin/moderation/boards/{board-id}`
  - `GET /admin/moderation/comments`
  - `PATCH /admin/moderation/comments/{comment-id}`
  - `GET /admin/audits`
  - `GET /admin/roles/members` (`ROLE_MASTER`)
  - `PATCH /admin/roles/members/{member-id}` (`ROLE_MASTER`)
  - `GET /admin/roles/audits` (`ROLE_MASTER`)
- `/app/admin/operations` (`ROLE_ADMIN` 또는 `ROLE_MASTER`)
  - `GET /admin/moderation/boards`
  - `GET /admin/moderation/comments`
  - `PATCH /admin/moderation/boards/batch`
  - `PATCH /admin/moderation/comments/batch`
  - `GET /admin/members/{member-id}`
  - `GET /members/list?keyword={keyword}&page=0&size=20`
  - `GET /admin/banners`
  - `POST /admin/banners`
  - `PATCH /admin/banners/{banner-id}`
  - `PATCH /admin/banners/{banner-id}/active`
  - `DELETE /admin/banners/{banner-id}`
- `/app/admin/streaming`
  - 관리자 스트리밍 운영 API

## 실시간

- WebSocket/STOMP: `/ws/chat/websocket`
- 보드게임 화면은 방 상태 구독과 REST 재조회가 함께 사용됩니다.

## 2026-05-31 변경 반영

- 공통 페이지별 `?` 도움말 버튼이 추가되었습니다.
- 앱 라우트와 시설 하위 화면을 지연 로딩하도록 정리했습니다.
- 플로팅 채팅을 별도 지연 로딩 청크로 분리했습니다.
- 모바일 플로팅 채팅은 전체 패널이 열린 동안 런처를 숨겨 전송 버튼과 겹치지 않습니다.
- 관리자 운영/이상징후 화면의 주요 UI 문구를 한국어 중심으로 정리했습니다.
