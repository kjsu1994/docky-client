# Screen to API Mapping

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
  - Summary/rank/stats related APIs based on widgets
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
  - `DELETE /boards/{board-id}/files/{file-id}` (if attachment delete)
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

## Real-time / Chat
- WebSocket endpoint: `/ws/chat/websocket` (through `/ws` proxy)
- REST:
  - `POST /chat/room`
  - `GET /chat/rooms`
  - `GET /chat/room/{roomId}/messages`
  - `PATCH /chat/room/{roomId}/read`

## Update Rule
- If route behavior changes, update this file in same PR.
- If endpoint contract changes, update OpenAPI-linked checks first.
