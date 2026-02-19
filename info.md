# 실시간 채팅 개발 가이드 (Chat Implementation Guide)

이 문서는 백엔드 실시간 채팅 시스템(WebSocket + STOMP + Redis) 연동을 위한 전용 가이드입니다.

---

## 1. WebSocket 접속 및 인증
서버는 **SockJS**를 지원하므로, 순수 WebSocket 주소 끝에 `/websocket`을 붙여야 연결됩니다.

- **Endpoint**: `ws://localhost:8080/ws/chat/websocket`
- **Protocol**: STOMP
- **Connection Header**: `Authorization: Bearer {JWT_TOKEN}`

```javascript
// 연결 예시 (StompJS + SockJS)
const socket = new SockJS('http://localhost:8080/ws/chat/websocket');
const stompClient = Stomp.over(socket);

stompClient.connect({ Authorization: 'Bearer ' + token }, (frame) => {
    console.log('Connected');
});
```

---

## 2. STOMP 메시징 규칙

### 2.1 구독 (Subscribe) - 메시지 수신
특정 채팅방의 메시지를 실시간으로 받으려면 아래 경로를 구독하세요.
- **Path**: `/sub/chat/room/{roomId}`

### 2.2 발행 (Publish) - 메시지 전송
메시지를 보낼 때 아래 경로로 JSON 데이터를 전송하세요.
- **Path**: `/pub/chat/message`
- **Payload**:
```json
{
  "roomId": 1,
  "senderId": 5,
  "message": "안녕하세요!",
  "type": "TALK" // TALK, ENTER, LEAVE, FILE
}
```

---

## 3. 채팅 관리 REST API

| 기능 | Method | Endpoint | 설명 |
| :--- | :--- | :--- | :--- |
| **방 생성** | `POST` | `/chat/room` | `title`, `type`, `memberIds` 전송 (본인 자동 포함) |
| **목록 조회** | `GET` | `/chat/rooms` | 내가 참여 중인 방 목록 (안 읽은 메시지 수 포함) |
| **멤버 조회** | `GET` | `/chat/room/{roomId}/members` | 특정 방의 전체 참여자 목록 조회 |
| **방 나가기** | `DELETE` | `/chat/room/{roomId}/leave` | 채팅방 탈퇴 (참여 정보 삭제 및 퇴장 알림) |
| **내역 조회** | `GET` | `/chat/room/{roomId}/messages` | 과거 대화 내역 조회 (페이징 지원) |
| **멤버 초대** | `POST` | `/chat/room/{roomId}/invite` | 기존 방에 새로운 멤버 추가 (`[memberId, ...]` 형태) |
| **읽음 처리** | `PATCH` | `/chat/room/{roomId}/read` | 해당 방의 안 읽은 메시지 카운트 0으로 초기화 |
| **파일 업로드** | `POST` | `/chat/room/{roomId}/file` | 이미지/파일 업로드 후 S3 URL 반환 |

---

## 4. 핵심 구현 로직 (Flow)

### 4.1 채팅방 생성 및 입장
1.  `POST /chat/room`으로 방을 생성합니다. (본인은 자동으로 멤버에 추가됩니다.)
2.  응답받은 `roomId`로 WebSocket 구독(`Subscribe`)을 시작합니다.
3.  방에 진입하자마자 `PATCH /chat/room/{roomId}/read`를 호출하여 안 읽음 숫자를 지웁니다.

### 4.2 그룹 채팅방 멤버 초대
1.  기존에 만들어진 방(`GROUP` 타입 권장)에 새로운 유저를 넣고 싶을 때 사용합니다.
2.  `POST /chat/room/{roomId}/invite`에 초대할 유저 ID 배열(`[2, 3, 4]`)을 보냅니다.

### 4.3 사진 및 파일 전송
1.  파일을 선택하면 먼저 `POST /chat/room/{roomId}/file`로 업로드합니다.
2.  응답으로 온 `URL`을 `message` 필드에 넣고, `type`을 `FILE`로 설정하여 WebSocket으로 `Publish` 합니다.

---

## 5. 회원 검색 및 초대 흐름 (Invitation Flow)
사용자를 검색하여 기존 채팅방에 초대하거나 새로운 방을 만들 때 활용합니다.

### 5.1 유저 검색 API
- **Endpoint**: `GET /members/list?keyword={이름_또는_이메일}&page=1&size=10`
- **Description**: 닉네임이나 이메일 일부를 입력하여 초대 대상을 찾습니다. 키워드가 없으면 전체 목록을 반환합니다.

### 5.2 초대 시나리오
1.  **검색**: 유저가 초대 모달에서 '홍길동' 검색 -> `GET /members/list?keyword=홍길동` 호출.
2.  **선택**: 검색 결과 목록에서 초대할 유저의 `memberId` 추출.
3.  **초대**:
    -   기존 방에 초대 시: `POST /chat/room/{roomId}/invite` 호출 (Body: `[2, 3]`).
    -   새로운 방 개설 시: `POST /chat/room` 호출 (Body: `memberIds: [2, 3]`).

---

## 6. 트러블슈팅
- **400 에러**: `/websocket` 경로를 확인하세요.
- **500 에러**: 초대하려는 유저 ID가 DB에 존재하는지 확인하세요.
- **빈 목록(`[]`) 반환**: 방을 만들 때 사용자가 정상적으로 참여되었는지 확인하세요. (최신 버전은 생성자 자동 포함)
