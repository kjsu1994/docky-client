# 가상 대기열(The Iron Queue) 프론트엔드 연동 가이드

이 문서는 백엔드 가상 대기열 시스템과 프론트엔드 간의 인터랙션을 위한 개발 가이드입니다.

---

## 1. 개요 (Overview)
대규모 트래픽 발생 시 서버 부하를 방지하기 위해 사용자를 즉시 서비스로 진입시키지 않고, **순서대로 대기시킨 후 입장시키는 시스템**입니다. 프론트엔드는 사용자의 대기 상태를 실시간으로 보여주고, 입장 허가가 떨어지면 실제 페이지로 이동시켜야 합니다.

---

## 2. API 상세 명세 (SNAKE_CASE 기준)

### 2.1 대기열 진입 (Join Queue)
- **Endpoint**: `POST /api/queue/join`
- **Auth**: `Authorization: Bearer {token}` 필요
- **Response**:
```json
{
  "user_id": "user@example.com",
  "rank": 450,
  "total_waiting": 1200,
  "expected_time": 900,
  "status": "WAITING"
}
```

### 2.2 실시간 상태 조회 (Get Status)
- **Endpoint**: `GET /api/queue/status`
- **Auth**: `Authorization: Bearer {token}` 필요
- **Response (대기 중일 때)**:
```json
{
  "user_id": "user@example.com",
  "rank": 12,
  "total_waiting": 1200,
  "expected_time": 24,
  "status": "WAITING"
}
```
- **Response (입장 가능할 때)**:
```json
{
  "user_id": "user@example.com",
  "rank": -1,
  "total_waiting": 1180,
  "expected_time": 0,
  "status": "ALLOWED"
}
```

### 2.3 시스템 퇴장 (Leave Queue)
- **Endpoint**: `DELETE /api/queue/leave`
- **Auth**: `Authorization: Bearer {token}` 필요
- **Description**: 서비스 이용이 완료되었거나 대기를 포기할 때 호출.

---

## 3. 프론트엔드 구현 시나리오 (Flow)

1.  **진입 시도**: 사용자가 '이벤트 참여' 버튼을 누르면 `POST /api/queue/join`을 호출합니다.
2.  **상태 판단**:
    -   `status`가 `ALLOWED`라면: 즉시 이벤트 페이지로 이동합니다.
    -   `status`가 `WAITING`이라면: 대기 화면(Queue Page)을 노출합니다.
3.  **폴링(Polling)**: 대기 화면에서 **3~5초 간격**으로 `GET /api/queue/status`를 호출합니다.
4.  **UI 갱신**: 응답받은 `rank`(내 앞의 인원)와 `expected_time`(예상 시간)을 실시간으로 화면에 업데이트합니다.
5.  **입장 전환**: 폴링 응답 중 `status`가 `ALLOWED`가 되는 순간, 폴링을 중단하고 목표 페이지로 이동합니다.

---

## 4. 연동 예시 (React/Axios 샘플)

```javascript
const checkQueueStatus = async () => {
  try {
    const res = await axios.get('/api/queue/status', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.data.status === 'ALLOWED') {
      alert('입장 가능합니다!');
      window.location.href = '/event-page'; // 목표 페이지 이동
    } else {
      setRank(res.data.rank);
      setExpectedTime(res.data.expected_time);
    }
  } catch (err) {
    console.error('대기열 조회 오류', err);
  }
};

// 3초마다 상태 체크
useEffect(() => {
  const timer = setInterval(checkQueueStatus, 3000);
  return () => clearInterval(timer);
}, []);
```

---

## 5. UI/UX 권장 사항
- **실시간성**: 순번이 줄어드는 것을 시각적으로 강조하세요 (Progress Bar 등).
- **중단 주의**: 대기 중 브라우저를 닫거나 새로고침해도 순번은 유지되지만(Redis 기반), 가급적 페이지 이탈을 방지하는 안내 문구를 띄우는 것이 좋습니다.
- **예상 시간**: `expected_time`이 0초가 되더라도 실제 입장은 서버 스케줄러에 따르므로, '약 잠시 후 입장' 등의 부드러운 문구를 사용하세요.

---

## 6. 테스트 방법 (Self-Test)
1. `/members/login`으로 발급받은 JWT 토큰을 준비합니다.
2. 브라우저 콘솔이나 Postman에서 `/api/queue/join`을 호출합니다.
3. `status`가 `WAITING`으로 나오면, 1초마다 `status` API를 호출하며 `rank`가 줄어드는 것을 확인합니다. (서버 스케줄러가 1초마다 인원을 줄임)
