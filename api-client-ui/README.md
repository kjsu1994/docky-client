# 탄소저감 커뮤니티 클라이언트

최종 업데이트: 2026-02-20

이 프로젝트는 `API 기능명세.md` 기준으로 프론트 기능을 연결한 React + Vite 클라이언트입니다.

## 구현 상태

### 인증/회원
- 로그인: `POST /members/login` (로그인 성공 시 `/api/queue/join`으로 가상 대기열 자동 진입)
- 가상 대기열: `POST /api/queue/join`, `GET /api/queue/status` 연동 및 전용 대기 페이지(`/queue`) 구현
- OAuth2 구글 로그인: `/oauth2/authorization/google` 리다이렉트 방식 (성공 시 가상 대기열 확인 포함)
- 로그아웃: `POST /members/logout`
- 회원가입: `POST /members`
- 내 정보 조회: `GET /members`
- 내 정보 수정: `PATCH /members/{member-id}`
- 회원 탈퇴: `DELETE /members`
- 프로필 업로드: `POST /members/uploadProfile`
- 토큰 자동 첨부 + 401 시 `/api/auth/reissue` 재발급 시도
- OAuth2 콜백에서 `accessToken`, `refreshToken` 쿼리 수신 시 자동 로그인 처리

### 게시글
- 목록: `GET /boards`
- 상세: `GET /boards/{board-id}`
- 작성: `POST /boards/{free|eco|green}`
- 수정: `PATCH /boards/{board-id}` (multipart)
- 삭제: `DELETE /boards/{board-id}`
- 좋아요: `POST /boards/{board-id}/Like`
- 내 게시글: `GET /boards/myBoards`
- 파일 다운로드: `GET /file/{file-id}`
- 게시판별 페이지네이션 상태 분리 (게시판마다 현재 페이지/표시개수 기억)
- 한 화면 표시 개수 선택 지원: `10 / 20 / 50`
- 페이지 인덱스 보정 적용 (UI 1페이지 ↔ API 0페이지)으로 조회 누락 방지
- 게시글 상세에서 수정/삭제 버튼은 작성자 또는 `ROLE_ADMIN`에게만 노출
- 댓글의 수정/삭제 버튼도 작성자 또는 `ROLE_ADMIN`에게만 노출
- 게시글 목록에서 작성자/`ROLE_ADMIN`은 즉시 삭제 버튼 사용 가능
- 게시글 목록에서 작성자/`ROLE_ADMIN`은 즉시 수정 버튼 사용 가능
- `ROLE_ADMIN`은 게시글 목록에서 `전체/공지/일반` 관리자 필터 사용 가능
- 권한 파싱은 문자열/배열/객체(`role`, `name`, `authority`) 형식을 모두 지원
- 관리자 작성 글은 목록 최상단에 공지 카드(절반 크기)로 우선 노출
- 게시글 등록 시 서버별 엔드포인트 차이 대응 폴백 적용
  - 순차 시도: `/boards/free|eco|green` -> `/boards/{KIND}` -> `/boards?kind={KIND}` -> `/boards`
- `ROLE_ADMIN` 사용자가 작성한 게시글은 등록 시 공지 플래그를 함께 전송 (`isNotice`, `notice`, `adminPost`)
- 게시글 수정 페이지 직접 접근 시에도 작성자/`ROLE_ADMIN` 권한 검사 후 미권한자는 상세로 리다이렉트
- `ECO_REVIEW` 게시판의 UI 명칭을 `Q&A 게시판`으로 변경
- 게시글 수정 화면에서 기존 첨부파일 목록 표시
- 게시글 수정 시 기존 첨부파일 삭제 + 새 첨부파일 추가 동시 지원
- 첨부파일 수정 오류 대응:
  - 삭제 파일 ID 추출 필드 다중 대응(`file_id`, `fileId`, `upload_id`, `uploadId`, `id`)
  - 파일 삭제는 명세 API `DELETE /boards/{board-id}/files/{file-id}`로 선처리
  - 게시글 `PATCH /boards/{board-id}`는 본문/신규 첨부만 처리
- 게시글 목록/공지 미리보기에서 에디터 HTML 태그(`<p>`, `<br>` 등) 제거 후 본문 텍스트만 표시
- 게시판 하단 페이지네이션 규칙 변경:
  - `처음` / `이전5` / `페이지번호(최대 5개)` / `다음5` / `마지막`
  - 페이지 번호는 5개 단위로 실제 존재하는 페이지만 노출

### 댓글
- 작성: `POST /comments`
- 단건 조회: `GET /comments/{comment-id}`
- 목록: `GET /comments?boardId={id}&page={n}&size={n}`
- 수정/삭제: `PATCH`, `DELETE /comments/{comment-id}`
- 좋아요: `POST /comments/{comment-id}/Like`

### 랭킹/기타
- 게시판 랭킹: `GET /boards/rankFreeBoards`, `/rankEcoBoards`, `/rankGreenBoards`
- 레벨 랭킹: `GET /members/levelRanks`
- 기부 랭킹: `GET /members/donationRanks`
- 중간장소 최적화: `POST /api/optimizer/optimize` 연동 및 네이버 지도 시각화
  - 주소 검색(Geocoding) 및 내 위치 찾기(Geolocation) 기능 구현
  - 지도 클릭 시 해당 지점 주소 자동 입력 기능 추가
- 뉴스 검색: `GET /news`
- 전기요금 계산: `POST /calculators`
- GPT 질문: `POST /gpt/question`

## 주요 UI/UX 개선
- 랭킹 페이지 안정성 개선:
  - `/boards/rank*`, `/members/levelRanks`, `/members/donationRanks` 응답 정규화 추가
  - 배열 직접 반환, `content/items/ranks` 래핑 구조 모두 대응
  - 비정형 응답으로 인한 `map is not a function` 런타임 오류 방지
  - 리스트 컴포넌트에서 `Array.isArray` 방어 처리로 렌더링 안정성 추가
  - 레벨 랭킹 `500` 대응 개선:
    - 에러 메시지에 HTTP 상태/서버 메시지 노출
    - 레벨 랭킹 엔드포인트 폴백 시도
      (`/members/levelRanks` -> `/members/level-ranks` -> `/members/ranks/level`)
    - 에러 카드 `다시 시도` 버튼으로 실제 재요청 수행(`retryKey` 기반)
- 마이페이지 회원상태 표시 보정:
  - `ACTIVE` 뿐 아니라 `MEMBER_ACTIVE`도 활성으로 인식하도록 수정
  - 프로필 헤더 배지/프로필 탭의 상태 텍스트 규칙을 동일 로직으로 통일
- 홈 통계 대시보드 API 연동:
  - `GET /stats/summary`로 회원/게시글/댓글/방문자 요약 카드 표시
  - `GET /stats/visitors/compare`로 전일 대비 방문자 증감률 표시
  - `GET /stats/trend?days={n}`로 기간 추이(7/14/30일) 렌더링
  - 기존 하드코딩 통계값 제거, 응답 파싱(`data.data`/`data`) 다중 대응
- 마이페이지에 회원탈퇴 동작 연결
- 마이페이지 편집 페이지 추가 (프로필 업로드 + 회원정보 수정)
- 마이페이지 동작 안정화:
  - 회원 정보 조회 실패 시 재시도 버튼 제공
  - `GET /boards/myBoards` 응답 파싱 다중 대응 및 페이지 인덱스 `0` 기준 적용
  - 게시글 본문 미리보기 HTML 제거, 날짜 파싱 실패 방어 처리
  - 레벨 진행도 계산식(0~100%) 안전화 및 음수 경험치 표시 방지
  - 프로필 수정 시 변경사항 없으면 PATCH 요청 생략
  - 프로필 업로드 시 파일 형식/크기(5MB) 사전 검증
  - 회원 수정 실패 시 `fieldErrors`/`violationErrors` 메시지 노출
- 요청 반영: 마이페이지 `내 댓글` 탭 기능 제거
- GPT 질문 페이지 추가
- 홈 대시보드에서 상세 라우팅/빠른링크 정합성 개선
- 랭킹/뉴스/댓글 응답 파싱 안정화
- 글로벌 스타일 개선(배경 레이어, 카드/버튼 인터랙션, 타이포그래피)

## 최근 작업 로그 (2026-02-20)
- 변경 파일:
  - `src/pages/MeetingOptimizer.jsx` (주소 검색, 내 위치, 지도 클릭 기능 추가)
  - `index.html` (Naver Maps SDK 파라미터 최신화: ncpKeyId)
  - `src/pages/Home.jsx` (화면 하얗게 나오는 버그 수정 및 통계 대시보드 복구)
  - `src/components/Header.jsx` (MapPin 아이콘 import 누락 수정)

## 실행
```bash
cd api-client-ui
npm install
npm run dev
```

백엔드 기본 URL: `http://localhost:8080`
프론트 기본 URL: `http://localhost:5173`

## 참고
- 공통 API 클라이언트: `src/utils/api.js`
- 명세 문서: `../API 기능명세.md`
