# 탄소저감 커뮤니티 - 개선된 프론트엔드

시니어 개발자 관점에서 개선된 React + Vite 기반 커뮤니티 플랫폼입니다.

## 🚀 주요 개선 사항

### 1. **아키텍처 개선**
- ✅ 전역 상태 관리 (React Context API)
- ✅ 커스텀 훅을 통한 로직 재사용
- ✅ API 레이어 분리 (axios interceptor)
- ✅ 파일 구조 체계화

### 2. **UX/UI 개선**
- ✅ 모던하고 직관적인 디자인 (Tailwind CSS)
- ✅ 반응형 레이아웃 (모바일 지원)
- ✅ 로딩/에러 상태 처리
- ✅ Toast 알림 (react-hot-toast)
- ✅ 애니메이션 효과

### 3. **실전 기능**
- ✅ 검색, 정렬, 필터링
- ✅ 페이지네이션
- ✅ 파일 업로드 (멀티파트)
- ✅ 이미지 미리보기
- ✅ 댓글 시스템
- ✅ 좋아요 기능

### 4. **코드 품질**
- ✅ 재사용 가능한 컴포넌트
- ✅ 유틸리티 함수 분리
- ✅ 에러 핸들링
- ✅ 타입 안전성 (PropTypes 대신 명확한 구조)

## 📦 기술 스택

- **React 19** - UI 라이브러리
- **Vite** - 빌드 도구
- **React Router v7** - 라우팅
- **Axios** - HTTP 클라이언트
- **Tailwind CSS** - 스타일링
- **Lucide React** - 아이콘
- **React Hot Toast** - 알림
- **date-fns** - 날짜 처리

## 🛠️ 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 개발 서버 실행
```bash
npm run dev
```

서버는 http://localhost:5173 에서 실행됩니다.

### 3. 프로덕션 빌드
```bash
npm run build
npm run preview
```

## 📂 프로젝트 구조

```
src/
├── components/          # 재사용 가능한 UI 컴포넌트
│   ├── Header.jsx       # 네비게이션 헤더
│   ├── LoadingSpinner.jsx
│   ├── ErrorMessage.jsx
│   ├── EmptyState.jsx
│   └── Pagination.jsx
├── contexts/            # React Context (전역 상태)
│   └── AuthContext.jsx  # 인증 상태 관리
├── hooks/               # 커스텀 훅
│   └── useBoards.js     # 게시판 데이터 fetching
├── pages/               # 페이지 컴포넌트
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── Home.jsx
│   ├── BoardList.jsx
│   ├── BoardDetail.jsx
│   └── BoardForm.jsx
├── utils/               # 유틸리티 함수
│   ├── api.js           # Axios 인스턴스 및 인터셉터
│   └── helpers.js       # 공통 헬퍼 함수
├── App.jsx              # 메인 앱 & 라우팅
├── main.jsx             # 진입점
└── index.css            # 글로벌 스타일
```

## 🎯 주요 기능

### 인증
- 로그인 / 회원가입
- JWT 토큰 자동 갱신
- 보호된 라우트

### 게시판
- 게시글 목록 (검색, 정렬, 페이지네이션)
- 게시글 상세 (댓글, 좋아요, 파일 다운로드)
- 게시글 작성/수정 (파일 업로드)
- 게시글 삭제

### 카테고리
- 자유게시판
- 친환경 리뷰
- 녹색활동

## 🔧 환경 설정

### API 프록시
`vite.config.js`에서 백엔드 서버 주소를 설정합니다:

```javascript
proxy: {
  "/api": {
    target: "http://localhost:8080",  // 백엔드 서버 주소
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/api/, ""),
  },
}
```

### 테스트 계정
- 이메일: `codestates1@gmail.com`
- 비밀번호: `abcd1234`

## 📱 반응형 디자인

- 데스크톱: 1280px+
- 태블릿: 768px ~ 1279px
- 모바일: ~ 767px

## 🎨 디자인 시스템

### 색상
- Primary: Green (친환경 컨셉)
- Secondary: Slate
- Accent: Blue, Purple, Orange

### 컴포넌트
- Button: `btn-primary`, `btn-secondary`
- Input: `input-base`
- Card: `card`
- Badge: `badge`

## 🚧 추가 개발 예정

- [ ] 마이페이지 (프로필 수정, 내가 쓴 글)
- [ ] 랭킹 시스템
- [ ] 뉴스 피드
- [ ] 전기요금 계산기
- [ ] 알림 시스템
- [ ] 소셜 로그인 (OAuth)

## 📝 API 엔드포인트

### 회원
- `POST /members/login` - 로그인
- `POST /members` - 회원가입
- `GET /members` - 내 정보

### 게시판
- `GET /boards?kind={kind}&page={page}&size={size}` - 목록
- `GET /boards/{id}` - 상세
- `POST /boards?kind={kind}` - 작성 (multipart)
- `PATCH /boards/{id}` - 수정
- `DELETE /boards/{id}` - 삭제
- `POST /boards/{id}/like` - 좋아요

### 댓글
- `POST /boards/{id}/comments` - 댓글 작성

## 🤝 기여

이 프로젝트는 코드스테이츠 메인 프로젝트를 기반으로 개선한 버전입니다.

## 📄 라이선스

MIT License