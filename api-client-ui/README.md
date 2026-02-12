# 탄소저감 커뮤니티 - 완전 구현 버전

## 🎉 구현 완료 기능

### ✅ 완성된 기능 목록

#### 1. **인증 시스템**
- ✅ 로그인 / 회원가입
- ✅ JWT 토큰 관리 (AccessToken + RefreshToken)
- ✅ 자동 로그인 / 로그아웃
- ✅ 보호된 라우트

#### 2. **게시판 시스템**
- ✅ 자유게시판 / 친환경 리뷰 / 녹색활동
- ✅ 게시글 목록 (검색, 정렬, 필터링, 페이지네이션)
- ✅ 게시글 상세 조회
- ✅ 게시글 작성 / 수정 / 삭제
- ✅ 파일 업로드 (멀티파트)
- ✅ 이미지 미리보기
- ✅ 좋아요 기능

#### 3. **댓글 시스템** (NEW!)
- ✅ 댓글 작성 / 수정 / 삭제
- ✅ 댓글 좋아요
- ✅ 실시간 댓글 업데이트
- ✅ 작성자 확인 및 권한 관리

#### 4. **랭킹 시스템** (NEW!)
- ✅ 게시판 랭킹 (자유/친환경/녹색활동)
- ✅ 레벨 랭킹 (경험치 기반)
- ✅ 기부 랭킹 (나무 기부 수)
- ✅ TOP 3 하이라이트

#### 5. **뉴스 검색** (NEW!)
- ✅ Naver API 연동
- ✅ 환경 관련 뉴스 검색
- ✅ 정확도순 / 날짜순 정렬
- ✅ 인기 키워드 제공
- ✅ 외부 링크 연동

#### 6. **전기요금 계산기** (NEW!)
- ✅ 소비 전력 + 사용 시간 기반 계산
- ✅ 일일/월간 예상 요금 표시
- ✅ 절약 팁 제공
- ✅ 계산 히스토리
- ✅ 빠른 입력 (예시 값)

#### 7. **마이페이지** (NEW!)
- ✅ 프로필 정보 조회
- ✅ 레벨 및 경험치 표시
- ✅ 내가 작성한 게시글 목록
- ✅ 활동 통계 (포인트, 나무, 게시글 수)
- ✅ 레벨 진행도 바

---

## 📦 설치 및 실행

### 1. 프론트엔드 설정

```bash
cd api-client-ui
npm install
npm run dev
```

서버: http://localhost:5173

### 2. 백엔드 설정

백엔드가 `http://localhost:8080`에서 실행 중이어야 합니다.

---

## 🗂️ 새로 추가된 파일 목록

### Pages (페이지)
```
src/pages/
├── Ranks.jsx          # 랭킹 시스템 (게시판/레벨/기부)
├── News.jsx           # 뉴스 검색 (Naver API)
├── Calculators.jsx    # 전기요금 계산기
├── Mypage.jsx         # 마이페이지 (프로필/통계/작성글)
└── BoardDetail.jsx    # 게시글 상세 (댓글 통합)
```

### Components (컴포넌트)
```
src/components/
└── Comments.jsx       # 댓글 컴포넌트 (작성/수정/삭제/좋아요)
```

---

## 🔌 API 엔드포인트 매핑

### 랭킹 시스템
```
GET /boards/rankFreeBoards      # 자유게시판 랭킹
GET /boards/rankEcoBoards       # 친환경리뷰 랭킹
GET /boards/rankGreenBoards     # 녹색활동 랭킹
GET /members/levelRanks         # 레벨 랭킹
GET /members/donationRanks      # 기부 랭킹
```

### 뉴스 검색
```
GET /news?query={keyword}&sort={sim|date}&display={count}
```

### 전기요금 계산기
```
POST /calculators
Body: {
  "powerConsumption": "1000",
  "hour": "8"
}
```

### 마이페이지
```
GET /members                    # 내 정보 조회
GET /boards/myBoards           # 내가 작성한 게시글
```

### 댓글
```
POST /boards/{boardId}/comments           # 댓글 작성
PATCH /comments/{commentId}                # 댓글 수정
DELETE /comments/{commentId}               # 댓글 삭제
POST /comments/{commentId}/Like            # 댓글 좋아요
```

### 좋아요
```
POST /boards/{boardId}/like                # 게시글 좋아요
```

---

## 🎨 주요 기능 스크린샷 설명

### 1. 랭킹 페이지
- **게시판 랭킹**: 좋아요 수 기준 TOP 게시글
- **레벨 랭킹**: 총 경험치 기준 TOP 회원
- **기부 랭킹**: 나무 기부 수 기준 TOP 회원
- **TOP 3 하이라이트**: 금/은/동 메달 표시

### 2. 뉴스 검색
- Naver 뉴스 API 실시간 검색
- 정확도순 / 날짜순 정렬
- 인기 검색어 원클릭
- 외부 링크로 원문 보기

### 3. 전기요금 계산기
- 소비 전력(W) + 사용 시간(h) 입력
- 일일 사용량(Wh) 및 예상 요금(원) 계산
- 월간 예상 요금 자동 계산
- 절약 팁 제공
- 최근 계산 히스토리 (5개)

### 4. 마이페이지
- 프로필 정보 (이름, 이메일, 전화번호)
- 레벨 및 경험치 진행도 바
- 내가 작성한 게시글 목록
- 활동 통계 (포인트, 나무, 게시글 수)

### 5. 댓글 시스템
- 실시간 댓글 작성/수정/삭제
- 댓글 좋아요
- 작성자 확인 (본인만 수정/삭제 가능)
- 프로필 이미지 및 레벨 표시

---

## 🛠️ 기술 스택

### Frontend
- React 19
- Vite
- React Router v7
- Axios (API 통신)
- Tailwind CSS (스타일링)
- Lucide React (아이콘)
- React Hot Toast (알림)
- date-fns (날짜 처리)

### Backend APIs
- Members API (회원 관리)
- Boards API (게시판)
- Comments API (댓글)
- Calculator API (전기요금 계산)
- Naver Search API (뉴스 검색)

---

## 🚀 주요 개선 사항

### 1. 사용자 경험 (UX)
- ✅ 직관적인 UI/UX 디자인
- ✅ 반응형 레이아웃 (모바일 지원)
- ✅ 로딩 상태 및 에러 처리
- ✅ Toast 알림으로 즉각적인 피드백
- ✅ 애니메이션 효과

### 2. 코드 품질
- ✅ 컴포넌트 재사용성
- ✅ API 레이어 분리
- ✅ 에러 핸들링
- ✅ snake_case / camelCase 혼용 대응

### 3. 성능
- ✅ 효율적인 데이터 fetching
- ✅ 페이지네이션
- ✅ 이미지 최적화

---

## 📝 파일 구조

```
api-client-ui/
├── src/
│   ├── components/
│   │   ├── Header.jsx
│   │   ├── LoadingSpinner.jsx
│   │   ├── ErrorMessage.jsx
│   │   ├── EmptyState.jsx
│   │   ├── Pagination.jsx
│   │   └── Comments.jsx          # NEW!
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── Home.jsx
│   │   ├── BoardList.jsx
│   │   ├── BoardDetail.jsx       # UPDATED!
│   │   ├── BoardForm.jsx
│   │   ├── Ranks.jsx             # NEW!
│   │   ├── News.jsx              # NEW!
│   │   ├── Calculators.jsx       # NEW!
│   │   └── Mypage.jsx            # NEW!
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── hooks/
│   │   └── useBoards.js
│   ├── utils/
│   │   ├── api.js
│   │   └── helpers.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── package.json
└── README.md
```

---

## 🎯 테스트 시나리오

### 1. 랭킹 시스템
1. 랭킹 페이지 접속
2. 게시판 랭킹 탭 확인
3. 레벨 랭킹 탭 확인
4. 기부 랭킹 탭 확인

### 2. 뉴스 검색
1. 뉴스 페이지 접속
2. 검색어 입력 (예: "탄소중립")
3. 정렬 변경 (정확도순/날짜순)
4. 인기 키워드 클릭
5. 뉴스 원문 링크 클릭

### 3. 전기요금 계산기
1. 계산기 페이지 접속
2. 소비 전력 입력 (예: 1000W)
3. 사용 시간 입력 (예: 8시간)
4. 계산 버튼 클릭
5. 결과 확인 (일일/월간 요금)

### 4. 마이페이지
1. 마이페이지 접속
2. 프로필 정보 확인
3. 작성한 글 탭 클릭
4. 활동 통계 탭 클릭

### 5. 댓글 기능
1. 게시글 상세 페이지 접속
2. 댓글 작성
3. 댓글 수정
4. 댓글 좋아요
5. 댓글 삭제

---

## 🔧 환경 변수

### Backend URL
`vite.config.js`에서 프록시 설정:

```javascript
proxy: {
  "/api": {
    target: "http://localhost:8080",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ""),
  },
}
```

---

## 📞 문제 해결

### 1. API 호출 실패
- 백엔드 서버가 실행 중인지 확인
- CORS 설정 확인
- 네트워크 탭에서 요청/응답 확인

### 2. 로그인 안됨
- 토큰이 헤더에 제대로 전달되는지 확인
- localStorage에 토큰이 저장되었는지 확인

### 3. 댓글/좋아요 안됨
- API 엔드포인트 확인
- 로그인 상태 확인
- 권한 확인

---

## 🎓 학습 포인트

1. **React Hooks**: useState, useEffect, useContext, 커스텀 훅
2. **API 통신**: Axios, 인터셉터, 에러 핸들링
3. **상태 관리**: Context API
4. **라우팅**: React Router v7, Protected Routes
5. **UI/UX**: Tailwind CSS, 반응형 디자인
6. **파일 업로드**: FormData, Multipart

---

## 📚 참고 자료

- [React 공식 문서](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Axios](https://axios-http.com/)
- [React Router](https://reactrouter.com/)

---

## 🤝 기여

이 프로젝트는 코드스테이츠 메인 프로젝트를 기반으로 시니어 개발자 수준으로 개선한 버전입니다.

---

## ⭐ 추가 개발 가능 기능

- [ ] 알림 시스템 (웹소켓)
- [ ] 소셜 로그인 (OAuth)
- [ ] 다크 모드
- [ ] PWA (Progressive Web App)
- [ ] 무한 스크롤
- [ ] 이미지 편집기
- [ ] 실시간 채팅

---

## 📄 라이선스

MIT License