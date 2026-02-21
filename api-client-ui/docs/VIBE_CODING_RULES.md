# Vibe Coding Rules (바이브 코딩 규칙)

## 1) Core Principle (핵심 원칙)
- 속도는 높게, 품질은 명시적 게이트로 통제한다.
- AI-generated code라도 review + verification 없이 merge 금지.

## 2) Work Unit Rule (작업 단위)
- One PR = one feature or one risk domain.
- 큰 UI 작업은 0.5~1 day 단위로 분할한다.

## 3) Contract-First Rule (계약 우선)
- 화면 코딩 전 OpenAPI (`/v3/api-docs`) 확인.
- contract 변경 시 docs를 같은 PR에서 갱신.

## 4) Adapter Rule (어댑터 규칙)
- API response normalization은 adapter/utils에서 처리.
- page component는 normalized view model만 사용.

## 5) UI Completion Rule (완료 필수 4상태)
- Loading
- Empty
- Error
- Forbidden/Unauthorized

## 6) Validation Gate (검증 게이트)
- Build pass (`npm run build`)
- Auth smoke pass (login -> token -> reissue -> logout)
- Changed route smoke pass

## 7) Communication Rule (커뮤니케이션)
- PR에 impact table(API/data/auth/docs/release note) 포함.
- 사용자 체감 변경이 있으면 짧은 release note 포함.
