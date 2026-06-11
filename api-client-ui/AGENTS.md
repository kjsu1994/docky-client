# Client Agent Playbook

## 경로

- 클라이언트 저장소: `C:\Users\honeybadger\Desktop\ctfmon_project\client`
- 앱 루트: `client\api-client-ui`
- 서버 저장소: `C:\Users\honeybadger\Desktop\ctfmon_project\CommunityServer`
- 운영 compose: `C:\compose`
- 운영 도메인: `https://ctfmon.shop`

## 작업 원칙

- React + Vite 프론트엔드다.
- 브라우저 API base는 `/api`, WebSocket은 `/ws`를 사용한다.
- 백엔드 API 계약은 OpenAPI 기준으로 확인한다.
- API 호출과 응답 정규화는 `src/adapters/**`에 둔다.
- page component에서 raw response shape를 직접 해석하지 않는다.
- 요청 범위 밖의 UI 개편, 리팩터링, 문서 추가를 하지 않는다.

## README 규칙

저장소 루트 `README.md`는 클라이언트 화면별 기능 문서로만 관리한다.

- 포함: 화면 경로별 기능, 사용자에게 보이는 동작, 공통 UI/인증/상태 원칙, 실행/빌드/검증 명령, 앱 구조
- 제외: 날짜별 작업 로그, PR 요약, 회고, 인수인계, API 체크리스트 이력, 검증 이력 누적, 구현 과정 설명, 서버 API 상세 스키마
- 화면 경로, 사용자 기능, 공통 UX 정책이 바뀐 경우에만 README를 갱신한다.
- API 상세 계약은 서버 OpenAPI와 서버 README를 기준으로 한다.

## 구현 기준

- 인증 토큰 key는 `accessToken`, `refreshToken`, `userRoles`를 유지한다.
- 요청/응답 필드는 백엔드 `SNAKE_CASE` 기준에 맞춘다.
- public auth endpoint나 외부 URL에는 bearer token을 붙이지 않는다.
- 공통 UI는 기존 역할에 맞춰 `src/common/**` 또는 `src/components/**`에 둔다.
- 버튼, 폼, CTA는 실제 handler와 사용자 피드백을 가져야 한다.
- 완료 상태에서 mock-only, TODO-only, hollow UI를 남기지 않는다.
- 주요 화면은 loading, empty, error, forbidden/unauthorized 상태를 처리한다.

## 화면 기준

- 기존 화면 밀도와 스타일을 우선한다.
- 관리자/운영 화면은 스캔, 비교, 반복 작업 효율을 우선한다.
- 게임 화면은 실제 조작과 상태 이해가 먼저 보이게 구성한다.
- 텍스트, floating chat, toast, modal, 하단 내비게이션이 서로 겹치지 않게 확인한다.

## 검증

```powershell
cd api-client-ui
npm run build
```

- 변경 범위에 맞춰 `package.json`의 `smoke:*` script를 선택한다.
- 한글 포함 파일은 UTF-8로 저장하고, 깨진 문자열이 보이면 즉시 복구한다.

## 완료 보고

- 변경 파일
- 사용자 영향
- 검증 결과
- API/data shape/권한/문서 영향: 있음/없음
