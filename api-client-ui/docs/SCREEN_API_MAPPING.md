# Screen to API Mapping (화면-API 매핑)

## Core Routes
- `/login`
  - `POST /members/login`
  - `GET /members` (post-login user fetch)
- `/register`
  - `POST /members`
- `/queue`
  - `POST /api/queue/join`
  - `GET /api/queue/status`
  - `DELETE /api/queue/leave`

## App Routes
- `/app` (Home)
  - summary/rank/stats widget APIs
- `/app/boards/:kind`
  - `GET /boards`
- `/app/boards/:kind/:boardId`
  - `GET /boards/{board-id}`
  - `GET /comments?boardId={id}&page={n}&size={n}`
  - `POST /comments`
- `/app/boards/:kind/new`
  - `POST /boards/{free|eco|green}`
- `/app/boards/:kind/:boardId/edit`
  - `PATCH /boards/{board-id}`
  - `DELETE /boards/{board-id}/files/{file-id}` (attachment delete)
- `/app/mypage`
  - `GET /members`
  - `GET /boards/myBoards`
- `/app/mypage/edit`
  - `PATCH /members/{member-id}`
  - `POST /members/uploadProfile`
- `/app/ranks`
  - `GET /boards/rankBoards?kind={FREE_BOARD|ADMIN_NOTICE|QUESTION_ANSWER}`
  - `GET /members/levelRanks`
  - `GET /members/donationRanks`
- `/app/news`
  - `GET /news`
- `/app/calculators`
  - `POST /calculators`
- `/app/gpt`
  - `POST /gpt/question`
- `/app/statistics`
  - `GET /stats/summary`
  - `GET /stats/visitors/compare`
  - `GET /stats/trend?days={1..365}`
- `/app/plinko`
  - `POST /game/dice/roll`
  - `POST /game/dice/reroll`
  - `POST /game/plinko/play`
- `/app/optimizer`
  - `POST /api/optimizer/optimize`
- `/app/admin/anomalies` (ROLE_ADMIN)
  - `GET /stats/summary`
  - `GET /stats/anomalies?limit={1..200}`
  - `GET /admin/anomalies/kpi?days={1..365}`
  - `GET /admin/anomalies/rules`
  - `PUT /admin/anomalies/rules`
  - `GET /admin/anomalies/incidents?status={ALL|NEW|REVIEWING|RESOLVED|FALSE_POSITIVE}&page={n}&size={n}`
  - `GET /admin/anomalies/incidents/{incident-id}`
  - `PATCH /admin/anomalies/incidents/{incident-id}`
  - `POST /admin/anomalies/incidents/{incident-id}/actions`
  - `GET /admin/anomalies/report?days={1..365}`

## Real-time / Chat
- WebSocket endpoint: `/ws/chat/websocket` (via `/ws` proxy)
- REST:
  - `POST /chat/room`
  - `GET /chat/rooms`
  - `GET /chat/room/{roomId}/messages`
  - `PATCH /chat/room/{roomId}/read`

## Update Rule (갱신 규칙)
- route behavior 변경 시 이 파일을 같은 PR에서 갱신한다.
- endpoint contract 변경 시 OpenAPI-linked checks를 먼저 갱신한다.

- `/app/admin/operations` (ROLE_ADMIN | ROLE_MASTER)
  - `PATCH /admin/moderation/boards/batch`
  - `PATCH /admin/moderation/comments/batch`
  - `GET /admin/members/{member-id}`
