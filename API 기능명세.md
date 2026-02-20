# Community Server - Frontend Implementation Guide

Last updated: 2026-02-17
Backend base URL: `http://localhost:8080`

## 1) Goal
이 문서는 프론트엔드 구현 시 필요한 화면, API, 인증/권한 흐름을 빠르게 연결하기 위한 개발 문서다.

## 2) Auth and Token Rules
- Login endpoint: `POST /members/login`
- Access token: response header `Authorization: Bearer {token}`
- Refresh token: response header `Refresh: {token}`
- Logout endpoint: `POST /members/logout`

Frontend rule:
- 요청 인터셉터에서 `Authorization` 헤더 자동 부착
- `401` 발생 시 refresh 재발급 로직(또는 재로그인) 처리
- 로그인 성공 후 사용자 정보와 `roles`를 상태 저장

## 3) Role Rules (USER / ADMIN)
- 일반 회원가입: `POST /members`
- 역할은 서버에서 이메일 기준으로 자동 부여
- `application.yml`의 `mail.address.admin`와 동일한 이메일이면 `ROLE_ADMIN`
- 그 외는 `ROLE_USER`

확인 방법:
- 로그인 응답 JSON의 `roles` 필드

권한 UI 분기:
- `ROLE_ADMIN` 포함 시 관리자 전용 버튼/메뉴 노출
- 예: 전체 게시글 삭제 기능

## 4) Page-by-Page API Mapping
### 4.1 Auth
- 로그인: `POST /members/login`
- 로그아웃: `POST /members/logout`

### 4.2 Member
- 회원가입: `POST /members`
- 내 정보 조회: `GET /members`
- 회원 목록/검색: `GET /members/list?keyword={name|email}&page={n}&size={n}`
- 내 정보 수정: `PATCH /members/{member-id}`
- 회원 탈퇴: `DELETE /members`
- 프로필 업로드: `POST /members/uploadProfile` (multipart/form-data)

### 4.3 Board
- 게시글 목록: `GET /boards`
- 게시글 상세: `GET /boards/{board-id}`
- 게시글 작성: `POST /boards/{free|eco|green}`
- 게시글 수정/삭제: `PATCH`, `DELETE /boards/{board-id}`
- 게시글 첨부파일 삭제: `DELETE /boards/{board-id}/files/{file-id}`
- 게시글 좋아요: `POST /boards/{board-id}/Like`
- 내 게시글 목록: `GET /boards/myBoards`

### 4.4 Comment
- 댓글 작성: `POST /comments`
- 댓글 단건: `GET /comments/{comment-id}`
- 댓글 목록: `GET /comments?boardId={id}&page={n}&size={n}`
- 댓글 수정/삭제: `PATCH`, `DELETE /comments/{comment-id}`
- 댓글 좋아요: `POST /comments/{comment-id}/Like`

### 4.5 Ranking
- 자유 게시판 랭킹: `GET /boards/rankFreeBoards`
- 에코 게시판 랭킹: `GET /boards/rankEcoBoards`
- 그린 게시판 랭킹: `GET /boards/rankGreenBoards`
- 레벨 랭킹: `GET /members/levelRanks`
- 기부 랭킹: `GET /members/donationRanks`

### 4.6 Other Features
- 파일 다운로드: `GET /file/{file-id}`
- 뉴스 검색: `GET /news`
- 전기요금 계산기: `POST /calculators`
- GPT 질문: `POST /gpt/question`
- 주사위 굴리기 (1단계): `POST /game/dice/roll`
- 주사위 재굴림 (1.5단계): `POST /game/dice/reroll` (Body: `[indices]`)
- 플링코 실행 (2단계): `POST /game/plinko/play`

## 5) Recommended Frontend Structure
- `src/api/client.ts`: axios/fetch 공통 클라이언트
- `src/api/endpoints.ts`: endpoint 상수
- `src/features/auth/*`: login/logout, token store
- `src/features/member/*`
- `src/features/board/*`
- `src/features/comment/*`
- `src/features/ranking/*`

상태 관리 권장:
- auth 상태: 로그인 여부, access token, roles, member summary
- 서버 상태: React Query 또는 SWR 권장

## 6) Implementation Order (Suggested)
1. 공통 API 클라이언트 + 인증 인터셉터
2. 로그인/로그아웃 + 보호 라우트
3. 회원가입/내 정보
4. 게시글 목록/상세
5. 게시글 작성/수정/삭제 + 파일 업로드
6. 댓글 CRUD + 좋아요
7. 랭킹/뉴스/계산기/GPT 기능
8. admin 전용 UI 분기

## 7) Error Handling Contract
기본 에러 응답 스키마:
```json
{
  "status": 400,
  "code": "INVALID_INPUT_VALUE",
  "message": "Invalid input value"
}
```

Validation 에러 응답 예 (`@Valid`, `BindingResult`):
```json
{
  "status": 400,
  "code": "INVALID_INPUT_VALUE",
  "message": "Invalid input value",
  "fieldErrors": [
    {
      "field": "email",
      "rejectedValue": "",
      "reason": "must not be blank"
    }
  ]
}
```

ConstraintViolation 에러 응답 예 (`@RequestParam`, `@PathVariable`):
```json
{
  "status": 400,
  "code": "INVALID_INPUT_VALUE",
  "message": "Invalid input value",
  "violationErrors": [
    {
      "propertyPath": "getBoard.boardId",
      "rejectedValue": -1,
      "reason": "must be greater than 0"
    }
  ]
}
```

Frontend 처리 기준:
- `400`: 폼 필드 에러 표시
- `401`: 로그인 만료 처리
- `403`: 권한 없음 안내
- `404`: 존재하지 않는 리소스 안내
- `500`: 공통 에러 토스트/페이지

주요 에러 코드 예시:
- `INVALID_INPUT_VALUE`
- `MISSING_REQUEST_PARAMETER`
- `MESSAGE_NOT_READABLE`
- `METHOD_ARGUMENT_TYPE_MISMATCH`
- `METHOD_NOT_ALLOWED`
- `UNSUPPORTED_MEDIA_TYPE`
- `NOT_ACCEPTABLE`
- `UNAUTHORIZED`
- `BAD_CREDENTIALS`
- `ACCESS_DENIED`
- `MEMBER_NOT_FOUND`, `BOARD_NOT_FOUND`, `COMMENT_NOT_FOUND`
- `MEMBER_EXISTS`, `DATA_INTEGRITY_VIOLATION`
- `INTERNAL_SERVER_ERROR`

## 8) Quick Test Checklist
- 로그인 시 토큰 헤더 저장 확인
- `ROLE_ADMIN` 계정 로그인 시 관리자 UI 노출 확인
- 보호 API 호출 시 인증 헤더 포함 확인
- 게시글/댓글 CRUD 후 목록 캐시 갱신 확인
- 파일 업로드/다운로드 동작 확인
- 첨부파일 삭제 후 게시글 상세의 `uploadDto` 목록/대표 이미지 반영 확인

## 9) Notes
- CORS는 현재 전체 허용 설정(`*`) 상태
- 실제 운영 전에는 origin 제한 필요
- OAuth 로그인 사용 시에도 roles 값을 기준으로 UI 분기

## 10) Authorization Policy Update (2026-02-17)
- 게시글 수정/삭제(`PATCH /boards/{board-id}`, `DELETE /boards/{board-id}`):
  - 작성자 본인 또는 `ROLE_ADMIN`만 가능
- 게시글 첨부파일 삭제(`DELETE /boards/{board-id}/files/{file-id}`):
  - 작성자 본인 또는 `ROLE_ADMIN`만 가능
- 댓글 수정/삭제(`PATCH /comments/{comment-id}`, `DELETE /comments/{comment-id}`):
  - 작성자 본인 또는 `ROLE_ADMIN`만 가능

Frontend 권장 처리:
- 수정/삭제 버튼은 아래 조건에서만 노출
  - `currentUser.memberId === resource.member.member_id`
  - 또는 `roles`에 `ROLE_ADMIN` 포함
- 서버가 `403`을 반환하면 "수정/삭제 권한이 없습니다." 메시지 표시

## 10-1) Rank API Stabilization (2026-02-17)
- Board rank API는 단일 엔드포인트로 통합:
  - `GET /boards/rankBoards?kind={FREE_BOARD|ADMIN_NOTICE|QUESTION_ANSWER}`
- Board rank 정렬 기본값:
  - `likeCount DESC`, `viewCount DESC`, `createdAt DESC`

- Member rank 정렬 안정성 개선:
  - 기부 랭킹(`GET /members/donationRanks`): `treeCount DESC`, `memberId DESC`
  - 레벨 랭킹(`GET /members/levelRanks`): `totalExp DESC`, `level DESC`, `levelId DESC`
    - 구현 안정화: DB 정렬 의존 대신 서비스 레이어에서 정렬+페이징 수행
- 목적:
  - 동점자 발생 시 순서가 매 요청마다 바뀌는 문제 방지
  - 게시판 랭킹 컨트롤러를 단일 API로 유지해 관리 복잡도 감소

## 10-2) Level Rank 500 Fix (2026-02-17)
- 현상:
  - `GET /members/levelRanks` 호출 시 `500 INTERNAL_SERVER_ERROR`
- 원인:
  - `LEVEL_TB.member_id`가 삭제된 회원을 참조하는 깨진 FK 데이터가 존재해
    JPA 로딩 시 `EntityNotFoundException` 발생
- 조치:
  - `Level.member` 매핑에 `@NotFound(action = NotFoundAction.IGNORE)` 적용
  - `Level.member`를 `LAZY`로 설정해 불필요한 즉시 로딩 최소화
  - 레벨 랭킹은 서비스 레이어 정렬+페이징으로 안정화 유지
- docker compose 반영:
  - `./gradlew clean bootJar`
  - 빌드 산출물 `server/build/libs/app.jar`를 `C:\compose\backend\app.jar`로 교체
  - `docker restart spring-backend`
- 검증:
  - `curl http://localhost:8080/members/levelRanks` -> `HTTP/1.1 200`

## 12) bootJar 자동 배포 파일 교체 (2026-02-17)
- 목적:
  - `bootJar` 빌드 시 docker compose 백엔드 경로의 `app.jar`를 자동 생성/교체
- 변경 파일:
  - `server/build.gradle`
- 적용 내용:
  - `copyBootJarToCompose` 태스크 추가
  - 복사 경로: `server/build/libs/app.jar` -> `C:/compose/backend/app.jar`
  - `bootJar.finalizedBy(copyBootJarToCompose)` 설정으로 빌드 후 자동 복사
- 사용 방법:
  - `server` 경로에서 `./gradlew bootJar` 실행

## 11) Stats API Update (2026-02-17)
- 통계 요약 조회: `GET /stats/summary`
- 방문자 비교 조회: `GET /stats/visitors/compare`
- 기간 추이 조회: `GET /stats/trend?days={1..365}`
- 인증: 불필요 (`permitAll`)
- 요약 응답 예시:
```json
{
  "data": {
    "total_members": 120,
    "total_boards": 430,
    "total_comments": 980,
    "today_visitors": 56,
    "active_members": 115,
    "quit_members": 5
  }
}
```

방문자 비교 응답 예시:
```json
{
  "data": {
    "today_visitors": 56,
    "yesterday_visitors": 42,
    "day_over_day_change_rate": 33.33
  }
}
```

기간 추이 응답 예시:
```json
{
  "data": {
    "days": 7,
    "items": [
      {
        "date": "2026-02-11",
        "new_boards": 12,
        "new_comments": 41,
        "visitors": 73
      }
    ]
  }
}
```

집계 기준(기본 통계 기능 포함):
- `total_members`: 회원 전체 건수
- `total_boards`: 게시글 전체 건수
- `total_comments`: 댓글 전체 건수
- `today_visitors`: Redis 일자별 Set 기반 고유 방문자 수
- `active_members`: `MEMBER_ACTIVE` 상태 회원 수
- `quit_members`: `MEMBER_QUIT` 상태 회원 수
- `day_over_day_change_rate`: 오늘 방문자 대비 어제 방문자 증감률(%)
- `trend.items[].new_boards`: 날짜별 신규 게시글 수
- `trend.items[].new_comments`: 날짜별 신규 댓글 수
- `trend.items[].visitors`: 날짜별 고유 방문자 수

방문자 식별 규칙:
- 로그인 사용자: `MEMBER:{username}`
- 비로그인 사용자: `ANON:{clientIp}`
- 프록시/도메인 배포 환경 고려: `X-Forwarded-For` 헤더 우선, 없으면 `remoteAddr` 사용

운영 참고:
- 현재 `.docker compose` 환경에서 Redis(`redis:6379`)를 사용
- 일자별 방문자 키(`stats:visitors:yyyyMMdd`)는 TTL 2일로 관리
- 기간 추이 API는 차트 렌더링을 고려해 `오래된 날짜 -> 최신 날짜` 순으로 반환
- 빌드 검증: `server`에서 `./gradlew compileJava` 성공(2026-02-17)
- 쿼리 정책: `BoardRepository`의 기간별 게시글 수 집계 메서드(`countByCreatedAtBetween`)를 자동 파생 쿼리에서 명시적 JPQL(`@Query`)로 변경(2026-02-17)
- 가독성 개선: `BoardRepository`의 명시적 JPQL을 DB 쿼리 스타일의 줄바꿈 형태로 정리(2026-02-17)
- 쿼리 정책 확장: 통계 관련 나머지 자동 파생 쿼리도 명시적 JPQL(`@Query`)로 변경
  - `MemberRepository.countByMemberStatus`
  - `CommentRepository.countByCreatedAtBetween`
- 주의사항: `CommentRepository`는 UTF-8 BOM 이슈를 제거한 뒤 재컴파일하여 정상 동작 확인(2026-02-17)

## 15) Group Time Optimizer (Time Block Tetris)
다수의 참여자가 모일 때, 실제 대중교통/자동차 이동 시간을 분석하여 가장 공정하고 최적인 약속 장소를 추천하는 **고성능 위치 최적화 엔진**입니다.

### 15.1 Key Features
- **Geocoding Engine**: 텍스트 주소를 정밀한 위도/경도 좌표로 실시간 변환.
- **Fairness Scoring Algorithm**: 단순히 거리가 가까운 곳이 아닌, 참여자 전원의 **평균 이동 시간**과 **시간 편차(Standard Deviation)**를 결합한 공정성 지수 산출.
- **Multi-Candidate Evaluation**: 주요 거점(Hubs)들에 대해 실제 교통 API 데이터를 전수 분석하여 최적지 도출.
- **Detailed Travel Report**: 각 참여자별 예상 소요 시간과 경로 요약 데이터 제공.

### 15.2 API Endpoints
| 기능 | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **최적지 추천** | `POST` | `/api/optimizer/optimize` | 주소 리스트를 입력받아 최적의 장소와 리포트 반환 |

### 15.3 Technical Challenges
- **API Call Optimization**: N명의 참여자와 M개의 후보지에 대한 기하급수적인 API 호출을 줄이기 위한 2단계 필터링 아키텍처.
- **Geometric Median 연산**: 비유클리드 평면에서의 거리 합 최소화 로직 구현.
- **Exception Handling**: API 키 제한이나 주소 불명확 시의 대체 연산(Euclidean Distance) 로직 설계.

### 14.1 Key Features
- **Fair Queueing**: Redis ZSet을 활용하여 1ms의 오차 없이 공정한 순번 보장.
- **Real-time Status**: 내 앞의 대기자 수와 예상 대기 시간을 실시간 조회 가능.
- **Dynamic Throughput**: 초당 입장 허용 인원을 실시간으로 조절 가능.
- **System Protection**: 허가된 유저(Active Set)만 실제 서비스 API에 접근 가능하도록 제어.

### 14.2 API Endpoints
| 기능 | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **대기열 진입** | `POST` | `/api/queue/join` | 줄서기 시작 및 초기 순번 발급 |
| **상태 조회** | `GET` | `/api/queue/status` | 현재 내 순번 및 입장 허용 여부 확인 |
| **시스템 퇴장** | `DELETE` | `/api/queue/leave` | 서비스 이용 완료 후 세션 만료 처리 |

### 14.3 Implementation Flow
1. 유저는 로그인 후 `/api/queue/join`을 호출하여 대기열에 등록됩니다.
2. `GET /api/queue/status`를 주기적으로 호출하여 `status`가 `ALLOWED`가 될 때까지 대기합니다.
3. `status`가 `ALLOWED`가 되면 실제 구매/예약 API를 호출할 수 있는 권한을 가집니다.
4. 모든 작업이 끝나면 `/api/queue/leave`를 통해 명시적으로 퇴장하거나, 설정된 TTL에 의해 자동 만료됩니다.

### 14.4 Technical Stack
- **Backend**: Spring Boot 2.7.x
- **Infrastructure**: Redis (ZSet for Waiting, Set for Active)
- **Concurrency Control**: Distributed Lock (Redisson) 고려 가능

### 13.1 Connection & Protocol
- **WebSocket Endpoint**: `ws://localhost:8080/ws/chat/websocket`
  - *중요: 서버에 SockJS가 설정되어 있으므로 순수 WebSocket 클라이언트(Postman 등) 사용 시 경로 끝에 `/websocket`을 반드시 붙여야 합니다.*
- **Support**: SockJS 사용 권장
- **Protocol**: STOMP
- **Headers**: 인증을 위해 `Authorization` 헤더 포함 필요 (STOMP connect 시)

### 13.2 Messaging Flow
- **구독 (Subscribe)**: `/sub/chat/room/{roomId}`
  - 특정 채팅방의 메시지를 수신하기 위해 해당 경로를 구독한다.
- **발행 (Publish)**: `/pub/chat/message`
  - 메시지를 보낼 때 아래 JSON 형식을 해당 경로로 전송한다.

**Message Payload (JSON)**:
```json
{
  "roomId": 1,
  "senderId": 10,
  "message": "안녕하세요!",
  "type": "TALK" // ENTER, TALK, LEAVE, FILE
}
```

### 13.3 Chat REST API
| 기능 | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| 채팅방 생성 | `POST` | `/chat/room` | `title`, `type`, `memberIds`(Array) 전송 (본인 자동 포함) |
| 채팅방 목록 | `GET` | `/chat/rooms` | 내가 참여 중인 채팅방 목록 (안 읽은 메시지 수 포함) |
| 방 멤버 조회 | `GET` | `/chat/room/{roomId}/members` | 특정 방의 전체 참여자 목록 조회 |
| 방 나가기 | `DELETE` | `/chat/room/{roomId}/leave` | 채팅방 탈퇴 및 퇴장 알림 전송 |
| 내역 조회 | `GET` | `/chat/room/{roomId}/messages` | 과거 대화 내역 조회 (페이징 지원) |
| 멤버 초대 | `POST` | `/chat/room/{roomId}/invite` | 기존 방에 새로운 멤버 추가 (Body: `[memberId, ...]`) |
| 파일 전송 | `POST` | `/chat/room/{roomId}/file` | 채팅 중 이미지/파일 업로드 (S3 URL 반환) |
| 읽음 처리 | `PATCH` | `/chat/room/{roomId}/read` | 해당 방의 안 읽은 메시지 카운트 초기화 |

**채팅방 생성 요청 예시 (POST /chat/room)**:
```json
{
  "title": "테스트 채팅방",
  "type": "GROUP",
  "memberIds": [1, 2] 
}
```
*주의: `memberIds`에 포함된 유저 ID가 DB에 실제로 존재해야 생성에 성공하며, 존재하지 않을 경우 에러가 발생합니다.*

### 13.4 Message Types
- `ENTER`: 채팅방 입장 (시스템 메시지 처리용)
- `TALK`: 일반 텍스트 메시지
- `LEAVE`: 채팅방 퇴장
- `FILE`: 파일/이미지 전송 (message 필드에 S3 URL 담아 전송)

### 13.5 Troubleshooting (에러 해결)
1. **400 Bad Request (WebSocket 연결 실패)**:
  - 주소 끝에 `/websocket`이 붙었는지 확인하세요. (예: `ws://localhost:8080/ws/chat/websocket`)
  - STOMP 프로토콜 설정이 되어 있는지 확인하세요.
2. **500 INTERNAL_SERVER_ERROR (채팅방 생성 실패)**:
  - 요청 본문의 `memberIds`가 유효한지 확인하세요. (`GET /members/{id}`로 확인 가능)
  - 서버 환경에 Redis(포트 6379)가 정상 실행 중인지 확인하세요.
3. **403 Forbidden**:
  - WebSocket 연결 시 `Authorization` 헤더(Bearer 토큰)가 올바른지 확인하세요.

### 13.6 Frontend Tip
- **SockJS + StompJS** 라이브러리 사용 권장.
- 채팅방 진입 시 `PATCH /chat/room/{roomId}/read`를 호출하여 안 읽음 카운트를 초기화할 것.
- 새로운 메시지 수신 시 리스트의 `lastMessage`를 갱신하고 본인이 해당 방에 없다면 토스트 알림 처리를 권장.
