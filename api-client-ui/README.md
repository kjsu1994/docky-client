# 탄소저감 커뮤니티 클라이언트

최종 업데이트: 2026-02-17

이 프로젝트는 `API 기능명세.md` 기준으로 프론트 기능을 연결한 React + Vite 클라이언트입니다.

## 구현 상태

### 인증/회원
- 로그인: `POST /members/login`
- 로그아웃: `POST /members/logout`
- 회원가입: `POST /members`
- 내 정보 조회: `GET /members`
- 내 정보 수정: `PATCH /members/{member-id}`
- 회원 탈퇴: `DELETE /members`
- 프로필 업로드: `POST /members/uploadProfile`
- 토큰 자동 첨부 + 401 시 `/auth/reissue` 재발급 시도

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
- 관리자 작성 글은 목록 최상단에 공지 카드(절반 크기)로 우선 노출
- 게시글 등록 시 서버별 엔드포인트 차이 대응 폴백 적용
  - 순차 시도: `/boards/free|eco|green` -> `/boards/{KIND}` -> `/boards?kind={KIND}` -> `/boards`
- `ROLE_ADMIN` 사용자가 작성한 게시글은 등록 시 공지 플래그를 함께 전송 (`isNotice`, `notice`, `adminPost`)
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
- 뉴스 검색: `GET /news`
- 전기요금 계산: `POST /calculators`
- GPT 질문: `POST /gpt/question`

## 주요 UI/UX 개선
- 마이페이지에 회원탈퇴 동작 연결
- 마이페이지 편집 페이지 추가 (프로필 업로드 + 회원정보 수정)
- GPT 질문 페이지 추가
- API 콘솔 페이지를 앱 라우트에 연결
- 홈 대시보드에서 상세 라우팅/빠른링크 정합성 개선
- 랭킹/뉴스/댓글 응답 파싱 안정화
- 글로벌 스타일 개선(배경 레이어, 카드/버튼 인터랙션, 타이포그래피)

## 라우트
- `/login`
- `/register`
- `/app`
- `/app/boards/:kind`
- `/app/boards/:kind/new`
- `/app/boards/:kind/:boardId`
- `/app/boards/:kind/:boardId/edit`
- `/app/mypage`
- `/app/mypage/edit`
- `/app/ranks`
- `/app/news`
- `/app/calculators`
- `/app/gpt`
- `/app/api-console`

## 실행
```bash
cd api-client-ui
npm install
npm run dev
```

백엔드 기본 URL: `http://localhost:8080`
프론트 기본 URL: `http://localhost:5173`

## 참고
- API 콘솔 카탈로그 파일: `src/api/apiCatalog.js`
- 공통 API 클라이언트: `src/utils/api.js`
- 명세 문서: `../API 기능명세.md`
