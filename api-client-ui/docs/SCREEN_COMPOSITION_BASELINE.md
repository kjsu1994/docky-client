# Screen Composition Baseline (기본 화면 구성)

## Goal
- feature-specific UI contract가 없을 때 default layout 기준으로 사용한다.

## Layout Skeleton
1. Header zone
- Screen title
- One-line intent text
- Primary CTA (top-right)

2. Control zone
- Search/filter/sort controls (one row)
- Optional quick stats chips

3. Content zone
- Main list/grid/card area
- Empty state card
- Inline error block + retry action

4. Detail/Action zone
- Secondary actions grouped below main content
- Destructive actions separated visually

5. Feedback zone
- Toast for success/error
- Loading skeleton while fetching

## Mandatory UX States
- Loading
- Empty
- Error
- Forbidden/Unauthorized

## Permission Rule
- Owner/Admin actions are hidden or disabled by role checks.

## Data Rule
- Display format and fallback values must stay consistent.
- Mixed API response shape parsing is forbidden in page components.
