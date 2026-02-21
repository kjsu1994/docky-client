# Feature Ownership Decision Matrix (FE/BE 판단표)

## Goal
- 신규 요구사항을 FE / BE / Mixed 중 어디에 둘지 빠르게 판단한다.

## Quick Matrix
- Backend-first:
  - permission/security validation 필요
  - data consistency/transaction/concurrency 필요
  - shared business rule across clients
  - external API key/secret handling 필요
- Frontend-first:
  - UI flow/interaction/visual state가 핵심
  - server truth mutation 없음
- Mixed:
  - Backend는 rule/validation/calculation 제공
  - Frontend는 UX flow/presentation 담당

## Decision Output Format
- Ownership: FE / BE / Mixed
- Split: FE __% / BE __%
- Reason: security / consistency / UX / ops
- Contract impact: API change Yes/No

## Examples
- "게시글 좋아요 중복 방지"
  - Ownership: BE-first
  - Reason: 정합성 + 동시성
- "정렬 버튼 UI/스켈레톤 개선"
  - Ownership: FE-first
  - Reason: 표현/UX
- "추천 점수 계산 + 시각화"
  - Ownership: Mixed
  - Reason: 계산=BE, 표현=FE
