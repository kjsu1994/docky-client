# CTFMON 클라이언트

React + Vite 기반의 커뮤니티/게임/운영 도구 프론트엔드입니다. 운영 배포는 Docker Compose 환경에서 `C:\compose\minio-data\client\dist`를 nginx가 정적 파일로 서빙하는 구조를 기준으로 합니다.

## 실행

```bash
cd client/api-client-ui
npm install
npm run dev
```

- 개발 서버: `http://localhost:5173`
- 기본 API URL: `http://localhost:8080`
- 운영 정적 배포 경로: `C:\compose\minio-data\client\dist`
- 운영 진입 URL 예시: `https://ctfmon.shop/app`

## 검증

```bash
npm run smoke:all
npm run build
```

- `npm run build`는 Vite 운영 번들을 생성합니다.
- `npm run smoke:all`은 문자열 품질, 페이지별 도움말 누락, 게임 허브/보드게임 반응형 흐름을 한 번에 확인합니다.
- `npm run smoke:text-quality`는 한국어 UI/문서의 깨진 문자열과 남은 주요 영어 문구를 검사합니다.
- `npm run smoke:page-guides`는 `src/App.jsx`의 주요 라우트마다 `?` 도움말 데이터가 있는지 검사합니다.
- `npm run smoke:tabletop-ui`는 Chrome 또는 Edge headless 브라우저로 게임 허브와 주요 보드게임 흐름을 데스크톱/태블릿/스마트폰 폭에서 확인합니다.

## 주요 구조

- `src/App.jsx`: 라우팅, 보호 라우트, 앱 레이아웃, 라우트 단위 지연 로딩
- `src/utils/api.js`: 공통 API 클라이언트
- `src/contexts/AuthContext.jsx`: 로그인 사용자와 인증 상태
- `src/common/PageGuideButton.jsx`: 페이지별 `?` 도움말 버튼과 설명 모달
- `src/common/pageGuides.js`: 페이지별 한국어 사용 설명서 데이터
- `src/components/FloatingChat.jsx`: 모바일 대응 플로팅 채팅
- `src/pages/games`: 게임 허브와 보드게임 화면
- `docs/SCREEN_API_MAPPING.md`: 화면별 API 사용 현황

## 2026-05-31 고도화 메모

- 보호된 주요 앱 라우트를 `React.lazy` 기반으로 분리해 초기 번들 크기를 줄였습니다.
- 플로팅 채팅도 별도 청크로 분리해 STOMP/SockJS 의존성이 첫 앱 번들에 즉시 섞이지 않게 했습니다.
- 스트리밍 허브는 실제 영상 재생 시점에만 `hls.js`를 동적 로드해 목록 화면 청크를 줄였습니다.
- 모든 `/app` 화면과 공개 로그인/가입/대기열 화면에 공통 `?` 도움말 버튼을 추가했습니다.
- 도움말 모달은 페이지 목적, 주요 버튼, 주의할 점을 한국어로 안내합니다.
- 게임 허브 카드에는 게임별 설명서 버튼이 있으며, 방 만들기/코드 입장/준비/시작 흐름은 기존 공통 방식을 유지합니다.
- 모바일 플로팅 채팅은 채팅창이 열린 상태에서 우측 하단 런처를 숨겨 전송 버튼과 겹치지 않게 했습니다.
- 관리자 운영/이상징후 화면의 주요 UI, 토스트, 확인 문구를 한국어 중심으로 정리했습니다.
- 관리자 콘텐츠 검토의 숨김/복구 성공 메시지가 실제 boolean 상태를 따르도록 수정했습니다.
- 배너 관리 카드의 활성화 버튼이 카드 선택 이벤트까지 함께 실행되지 않도록 클릭 전파를 막았습니다.
- 전역 배경의 움직이는 blob 장식을 제거해 화면 피로도와 불필요한 페인트 비용을 줄였습니다.

## 운영 배포 참고

운영 Compose 구성은 `C:\compose`를 기준으로 확인해야 합니다. 프론트 정적 파일은 빌드 산출물을 compose의 nginx 정적 서빙 경로에 반영한 뒤 컨테이너를 재기동하거나 nginx가 새 파일을 읽도록 처리합니다. 커밋과 푸시는 사용자가 직접 수행합니다.
