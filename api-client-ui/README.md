# 그린 커뮤니티 프론트엔드

최종 업데이트: 2026-02-21

이 프로젝트는 `../API 기능명세.md`를 기준으로 구현된 React + Vite 클라이언트입니다.

## 주요 기능

### 1) 인증/회원
- 로그인: `POST /members/login`
- 로그아웃: `POST /members/logout`
- 회원가입: `POST /members`
- 내 정보 조회: `GET /members`
- 내 정보 수정: `PATCH /members/{member-id}`
- 회원 탈퇴: `DELETE /members`
- 프로필 업로드: `POST /members/uploadProfile`
- 토큰 재발급: `POST /api/auth/reissue` (401 발생 시 재시도)
- OAuth2 Google 로그인: `/oauth2/authorization/google`

### 2) 대기열
- 대기열 입장: `POST /api/queue/join`
- 대기열 상태 조회: `GET /api/queue/status`
- 전용 화면: `/queue`

### 3) 게시판
- 목록: `GET /boards`
- 상세: `GET /boards/{board-id}`
- 작성: `POST /boards/{free|eco|green}`
- 수정: `PATCH /boards/{board-id}` (multipart)
- 삭제: `DELETE /boards/{board-id}`
- 좋아요: `POST /boards/{board-id}/Like`
- 내 게시글: `GET /boards/myBoards`
- 첨부파일 다운로드: `GET /file/{file-id}`

### 4) 댓글
- 작성: `POST /comments`
- 단건 조회: `GET /comments/{comment-id}`
- 목록: `GET /comments?boardId={id}&page={n}&size={n}`
- 수정/삭제: `PATCH`, `DELETE /comments/{comment-id}`
- 좋아요: `POST /comments/{comment-id}/Like`

### 5) 랭킹/통계/기타
- 게시판 랭킹: `GET /boards/rankFreeBoards`, `/rankEcoBoards`, `/rankGreenBoards`
- 레벨 랭킹: `GET /members/levelRanks`
- 기부 랭킹: `GET /members/donationRanks`
- 통계 요약: `GET /stats/summary`
- 이상탐지: `GET /stats/anomalies?limit={1..200}`
- 중간지점 최적화: `POST /api/optimizer/optimize`
- 뉴스 검색: `GET /news`
- 기후기금 계산: `POST /calculators`
- GPT 질문: `POST /gpt/question`

### 6) 럭키 플링코
- 주사위 굴리기: `POST /game/dice/roll`
- 재굴림: `POST /game/dice/reroll`
- 플링코 실행: `POST /game/plinko/play`
- 서버 `landingSlots` 기준으로 최종 슬롯 결과 동기화

## 화면/권한 참고
- 관리자 이상탐지 콘솔: `/app/admin/anomalies` (`ROLE_ADMIN` 전용)
- 일반 사용자는 보호 라우트(`ProtectedRoute`)를 통해 `/app/*` 접근

## 실행 방법
```bash
cd api-client-ui
npm install
npm run dev
```

- 백엔드 기본 URL: `http://localhost:8080`
- 프론트 기본 URL: `http://localhost:5173`

## 문서
- API 명세: `../API 기능명세.md`
- 프론트 문서 인덱스: `./docs/README.md`
- 공통 API 클라이언트: `src/utils/api.js`

## 최근 작업 로그

### 2026-02-21
- Admin Anomalies 콘솔 확장
  - Incident Inbox, Timeline, Rule Editor, KPI, CSV 리포트
  - 조치 액션 연동: `BLOCK_QUEUE_USER`, `WARN_MEMBER`, `CLEAR_QUEUE_BLOCK`
- Lucky Plinko 동기화/물리 보정
  - 슬롯 시각 피드백 개선
  - 화면 크기 대응 좌표 동기화
  - 최종 결과 슬롯 일치 안정화

### 2026-02-22
- 관리자 메신저(알림함) UI 추가: `/app/admin/anomalies`
  - 미확인 알림 목록 조회: `GET /admin/notifications?readYn=false&page=1&size=8`
  - 단건 읽음: `PATCH /admin/notifications/{notification-id}/read`
  - 전체 읽음: `POST /admin/notifications/read-all`
- 신고함 UI 추가: `/app/admin/anomalies`
  - 신고 목록 조회/필터: `GET /admin/reports?status={ALL|OPEN|IN_REVIEW|RESOLVED|REJECTED}`
  - 신고 처리: `PATCH /admin/reports/{report-id}`
- 게시글/댓글 신고 버튼 추가
  - 게시글 상세: `POST /reports` (`targetType: "BOARD"`)
  - 댓글 목록: `POST /reports` (`targetType: "COMMENT"`)
- 프론트 빌드 검증: `npm run build` 성공- 권한관리 UI 추가: `/app/admin/anomalies`
  - 회원 권한 조회/검색: `GET /admin/roles/members?keyword=&page=&size=`
  - 관리자 권한 부여/해제: `PATCH /admin/roles/members/{member-id}`
  - 권한 변경 이력 조회: `GET /admin/roles/audits?page=&size=`
  - 안전 규칙 반영: 마지막 관리자/자기 자신의 관리자 권한 제거 방지- ROLE_MASTER 반영
  - `ROLE_MASTER`도 관리자 권한으로 인식하도록 `src/utils/authorization.js` 확장
  - 관리자 화면 접근 판정 시 `ROLE_ADMIN` 또는 `ROLE_MASTER` 허용- 관리자 권한관리 UX 개선
  - 권한 부여/해제 실패 시 토스트로 오류 메시지 표시(예: 403/400)
  - 성공 시 즉시 성공 토스트 표시 및 목록/이력 재조회- 권한관리 패널에 내 권한 배지 추가
  - `내 권한: MASTER` / `내 권한: ADMIN` 표시
  - MASTER가 아닐 때 관리자 부여/해제 버튼 비활성화- 권한관리 member-id 오류 수정
  - 백엔드 응답 `member_id`(snake_case) / `memberId`(camelCase) 모두 처리
  - `/admin/roles/members/{member-id}` 호출 시 undefined 전송 문제 해결- Mypage JSX 경고 수정
  - `src/pages/Mypage.jsx`의 `->` 텍스트를 JSX 안전 표현(`{"->"}`)으로 변경
  - `npm run build` 시 해당 경고 제거 확인- ADMIN 접근 분리 수정
  - `src/pages/AdminAnomalies.jsx`에서 MASTER 전용 API(`/admin/roles/*`)를 MASTER일 때만 호출
  - ADMIN이 이상탐지 화면 진입 시 403으로 전체 로딩 실패하던 문제 해결
  - 권한관리 섹션은 MASTER에게만 노출- 관리자 핵심 운영 패널 추가 (`/app/admin/anomalies`)
  - 사용자 제재: `GET/POST/PATCH /admin/sanctions*`
  - 콘텐츠 모더레이션: `GET/PATCH /admin/moderation/boards*`, `/admin/moderation/comments*`
  - 통합 Audit: `GET /admin/audits?type=...`
  - 정책 반영: ADMIN은 이상탐지/신고/메신저/제재/모더레이션/Audit 사용 가능, 권한부여는 MASTER만 가능- 콘텐츠 모더레이션 ID 호환성 보강
  - `src/pages/AdminAnomalies.jsx`에서 `boardId/board_id`, `commentId/comment_id` 동시 지원
  - 숨김/복구 호출 전 ID 숫자 검증 추가로 `Parameter 'board-id' should be of type 'long'` 재발 방지
- Admin 이상탐지 화면 한글 깨짐 복구
  - `src/pages/AdminAnomalies.jsx` 인코딩을 UTF-8로 정규화(CP949 저장 이슈 수정)
