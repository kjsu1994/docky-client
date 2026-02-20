# Group Time Optimizer (Time Block Tetris) 프론트엔드 연동 가이드

이 문서는 백엔드의 최적 약속 장소 산출 엔진과 프론트엔드 지도를 연동하기 위한 가이드입니다.

---

## 1. 개요 (Overview)
사용자가 여러 개의 주소를 입력하면, 백엔드는 각 참여자의 실제 이동 시간을 분석하여 가장 공평하고(Fair) 빠른(Fast) 중간 지점을 추천합니다. 프론트엔드는 이 데이터를 받아 **네이버 지도 위에 시각화**해야 합니다.

---

## 2. API 호출 및 데이터 구조

### 2.1 최적지 추천 요청
- **Endpoint**: `POST /api/optimizer/optimize`
- **Request Body**:
```json
[
  "서울특별시 강남구 역삼동 858",
  "서울특별시 마포구 양화로 160"
]
```

### 2.2 응답 데이터 (Sample)
```json
{
  "candidates": [
    {
      "name": "서울역",
      "address": "서울특별시 중구 남대문로5가",
      "latitude": 37.5547,
      "longitude": 126.9707
    }
  ],
  "avg_travel_time": 21.0,
  "travel_time_std_dev": 6.0,
  "recommended_reason": "모두가 평균 21.0분 내외로 도착 가능하며, 시간 편차가 적어 공평한 장소입니다.",
  "user_results": [
    { "name": "참여자 1", "travel_time": 27, "summary": "출발지: 서울특별시 강남구..." },
    { "name": "참여자 2", "travel_time": 15, "summary": "출발지: 서울특별시 마포구..." }
  ]
}
```

---

## 3. 네이버 지도 SDK 연동 시나리오

1.  **SDK 로드**: 네이버 콘솔에서 발급받은 `Client ID`를 사용하여 스크립트를 로드합니다.
    ```html
    <script type="text/javascript" src="https://oapi.map.naver.com/openapi/v3/maps.js?ncpClientId=YOUR_CLIENT_ID"></script>
    ```
2.  **마커 표시 (Markers)**:
    -   `candidates` 배열의 좌표를 사용하여 추천 장소에 **금색 핀**을 꽂습니다.
    -   `user_results` 내의 좌표(필요 시 추가 요청)를 사용하여 참여자들의 위치에 **파란색 핀**을 꽂습니다.
3.  **정보창 (InfoWindow)**: 핀을 클릭했을 때 해당 장소의 이름과 "이동 시간"을 팝업으로 보여줍니다.
4.  **리포트 대시보드**: 지도의 옆이나 아래에 `recommended_reason`과 `travel_time_std_dev`(공정성 지수)를 차트로 시각화하여 신뢰도를 높입니다.

---

## 4. UI/UX 구현 팁

-   **가변형 입력 폼**: 사용자가 '+' 버튼을 눌러 주소 입력창을 무한히 늘릴 수 있게 구현하세요.
-   **로딩 애니메이션**: 백엔드 연산(Directions API 통신)에 2~3초가 소요될 수 있으므로, "최적의 지점을 계산 중입니다..."라는 긴박감 있는 로딩 화면을 보여주세요.
-   **공정성 지수 시각화**: 표준편차가 낮을수록 '공정함' 뱃지를 달아주어 서비스의 전문성을 강조하세요.

---

## 5. 자바스크립트 샘플 (Marker 렌더링)

```javascript
// 추천 장소 지도에 표시
const map = new naver.maps.Map('map', { center: new naver.maps.LatLng(res.candidates[0].latitude, res.candidates[0].longitude) });

res.candidates.forEach(cand => {
    new naver.maps.Marker({
        position: new naver.maps.LatLng(cand.latitude, cand.longitude),
        map: map,
        title: cand.name,
        icon: { content: '<div style="background: gold; padding: 5px;">추천!</div>' }
    });
});
```
