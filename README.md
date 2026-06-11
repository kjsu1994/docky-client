# CTFMON Client

CTFMON 웹 클라이언트입니다. React + Vite 기반으로 인증, 커뮤니티, 채팅, 게임, 생활 도구, 투자, 스트리밍, 관리자 화면을 제공합니다.

이 README는 GitHub 메인에 표시되는 화면별 기능 문서입니다. 날짜별 작업 로그, 검증 명령 누적 기록, PR 메모, API 변경 체크리스트, 임시 구현 메모는 이 파일에 남기지 않습니다.

## 실행

```powershell
cd api-client-ui
npm install
npm run dev
```

```powershell
cd api-client-ui
npm run build
```

- 개발 서버 기본 포트: `5173`
- API 프록시: `/api/*` -> 백엔드 `/*`
- WebSocket 프록시: `/ws` -> 백엔드 `/ws`
- 기본 프록시 대상: `http://backend:8080`
- 운영 빌드 출력: `C:/compose/minio-data/client/dist`

## 공통 화면 정책

- 인증 토큰은 `accessToken`, `refreshToken`, `userRoles`를 기준으로 관리합니다.
- API 호출은 `src/adapters/**` 계층을 통해 수행하고, 화면 컴포넌트가 응답 shape를 직접 해석하지 않습니다.
- 주요 화면은 loading, empty, error, forbidden/unauthorized 상태를 가져야 합니다.
- 사용자가 누를 수 있는 버튼과 폼은 실제 동작에 연결되어야 합니다.
- 서버 진실값을 바꾸는 규칙은 백엔드 API를 기준으로 처리하고, 프론트엔드는 표현과 상호작용을 담당합니다.

## 공개 화면

| 경로 | 기능 |
| --- | --- |
| `/login` | 이메일 로그인, OAuth 로그인 진입, 제재 해제 요청, 로그인 성공 후 대기열 또는 앱 진입 처리 |
| `/register` | 회원가입, 이메일 중복 확인, 이메일 인증, 가입 폼 검증 |
| `/queue` | 대기열 참가, 현재 순번/상태 표시, 이탈 처리, 입장 가능 상태에서 앱으로 이동 |

## 앱 홈과 공통 내비게이션

| 경로 | 기능 |
| --- | --- |
| `/app` | 홈 대시보드, 최신 게시글, 통계 요약, 운영 배너, 주요 기능 진입 |
| `/app/all-menu` | 전체 메뉴, 주요 화면 바로가기, 관리자 메뉴 노출 제어 |
| 공통 레이아웃 | 상단 메뉴, 하단 내비게이션, 네트워크 처리 표시, 토스트, 오류 복구 화면 |

## 커뮤니티

| 경로 | 기능 |
| --- | --- |
| `/app/boards/:kind` | 게시판 목록, 검색, 정렬, 페이지네이션, 공지/자유/기타 게시판 구분 |
| `/app/boards/:kind/new` | 게시글 작성, 본문 에디터, 이미지 업로드, 첨부 파일 선택 |
| `/app/boards/:kind/:boardId` | 게시글 상세, 조회, 좋아요, 댓글, 첨부 다운로드, 신고 |
| `/app/boards/:kind/:boardId/edit` | 게시글 수정, 기존 첨부 관리, 본문 재검증 |
| `/app/chat` | 일반 채팅방 목록, 메시지, 멤버, 초대, 파일 첨부, AI 채팅방 |

## 개인 화면

| 경로 | 기능 |
| --- | --- |
| `/app/mypage` | 내 정보, 작성 글, 레벨/경험치, 계정 탈퇴 진입 |
| `/app/mypage/edit` | 프로필 수정, 프로필 이미지 업로드, 계정 정보 검증 |
| `/app/ranks` | 게시글 랭킹, 레벨 랭킹, 기부 랭킹 |
| `/app/statistics` | 방문자/게시글/댓글 통계, 기간별 추세 |
| `/app/todos` | 일정 목록, 생성, 수정, 완료, 삭제 |

## 생활 도구

| 경로 | 기능 |
| --- | --- |
| `/app/news` | Naver 뉴스 검색, 정렬, 외부 링크 안전 처리 |
| `/app/facility` | 주차장, 화장실, 도서관, 의료기관, 대피소 검색과 지도 기반 탐색 |
| `/app/optimizer` | 여러 출발지의 중간 만남 장소 추천 |
| `/app/invest` | 국내/미국 종목 분석, 차트, 뉴스, 포트폴리오 관리 |

## 게임

| 경로 | 기능 |
| --- | --- |
| `/app/games` | 게임 허브, 보드게임/비디오게임 분류, 이어하기, 규칙 안내 |
| `/app/poker` | 포커 룸, 준비/시작, 베팅/드로우/쇼다운, 결과 확인 |
| `/app/games/las-vegas` | Las Vegas 룸, 주사위 굴림, 카지노 배치, 라운드 정산 |
| `/app/games/no-thanks` | No Thanks 룸, 카드 가져오기/거절, 칩/점수 정산 |
| `/app/games/catan` | Catan 룸, 자원, 건설, 교역, 턴 진행 |
| `/app/games/blokus` | Blokus 룸, 조각 선택, 회전/뒤집기, 배치 판정 |
| `/app/games/mahe` | Mahe 룸, 주사위 선택, 이동, 보상 정산 |
| `/app/games/dalmuti` | Dalmuti 룸, 세금, 혁명, 카드 플레이, 패스 |
| `/app/games/six-nimmt` | 6 nimmt! 룸, 카드 선택, 행 선택, 벌점 정산 |
| `/app/games/telestrations` | Telestrations 룸, 제시어, 그림, 추측, 공개 리플레이 |
| `/app/games/mafia` | Mafia 룸, 역할 확인, 밤 행동, 투표, 승패 판정 |
| `/app/games/citadels` | Citadels 룸, 캐릭터 선택, 수입/능력, 건설, 점수 계산 |
| `/app/games/video/:videoGameCode` | Good_ETC 비디오 게임 룸, iframe 실행, 모바일 컨트롤, STOMP 신호 동기화 |

## 스트리밍

| 경로 | 기능 |
| --- | --- |
| `/app/streaming` | 영상 목록, 썸네일, 재생, HLS 플레이어 |

## 관리자 화면

| 경로 | 기능 |
| --- | --- |
| `/app/admin` | 관리자 커맨드 센터, 주요 운영 지표와 관리 화면 진입 |
| `/app/admin/anomalies` | 이상 징후, 신고, 제재, 알림, 감사, 권한 이력 통합 확인 |
| `/app/admin/operations` | 배너, 회원 상세, 게시글/댓글 모더레이션, 운영 조치 |
| `/app/admin/streaming` | 스트리밍 영상 업로드, inbox import, 영상 삭제 |

관리자 메뉴는 사용자 권한에 따라 노출됩니다. `ROLE_ADMIN`과 `ROLE_MASTER` 화면을 분리하고, `ROLE_MASTER` 전용 권한 변경 기능은 일반 관리자에게 노출하지 않습니다.

## 주요 구조

| 경로 | 역할 |
| --- | --- |
| `api-client-ui/src/pages` | 라우트별 화면 |
| `api-client-ui/src/components` | 앱 레이아웃과 공통 UI |
| `api-client-ui/src/common` | 여러 화면에서 공유하는 컴포넌트와 유틸 |
| `api-client-ui/src/adapters` | API 호출, 응답 정규화, payload 생성 |
| `api-client-ui/src/contexts` | 인증 상태 |
| `api-client-ui/src/utils` | axios, 토스트, URL/문자열 처리, 외부 SDK 로더 |
| `api-client-ui/scripts` | 빌드 전후 smoke 검증 스크립트 |

## 검증

```powershell
cd api-client-ui
npm run build
```

변경 범위가 화면 동작에 영향을 주면 관련 smoke script를 함께 실행합니다. 예시는 `package.json`의 `smoke:*` scripts를 기준으로 선택합니다.
