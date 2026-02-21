# Feature Ownership Decision Matrix

## Goal
- Decide quickly whether a new requirement should be implemented in frontend, backend, or mixed layers.

## Quick Matrix
- Backend-first:
  - Permission/security validation needed
  - Data consistency/transaction/concurrency needed
  - Shared business rule used by multiple clients
  - External API key/secret handling needed
- Frontend-first:
  - UI flow, interaction, visual state management
  - Client-side formatting/filtering/sorting only
  - No source-of-truth mutation on server
- Mixed:
  - Backend returns validated/calculated result
  - Frontend renders and orchestrates UX flow

## Decision Output Format
- Ownership: FE / BE / Mixed
- Split: FE __% / BE __%
- Reason: security / consistency / UX / ops
- Contract impact: API change Yes/No

## Examples
- "게시글 좋아요 제한(중복 방지)"
  - Ownership: BE-first
  - Reason: 데이터 정합성 + 동시성
- "정렬 버튼 UI와 로딩 스켈레톤 개선"
  - Ownership: FE-first
  - Reason: 화면 표현/UX
- "추천 점수 계산 + 결과 시각화"
  - Ownership: Mixed
  - Reason: 계산은 BE, 표현은 FE
