# Screen Composition Baseline

## Goal
- Use this as default UI composition when no feature-specific UI contract exists.

## Layout Skeleton
1. Header zone
- Screen title
- One-line intent text
- Primary CTA button (top-right)

2. Control zone
- Search/filter/sort controls in one row
- Optional quick stats chips

3. Content zone
- Main list/grid/card area
- Empty state card when no data
- Inline error block with retry action

4. Detail/Action zone
- Secondary actions grouped below main content
- Destructive actions separated and visually distinct

5. Feedback zone
- Toast for success/error
- Loading skeleton while fetching

## Mandatory UX States
- Loading
- Empty
- Error
- Forbidden/Unauthorized

## Permission Rule
- Owner/Admin actions are hidden or disabled by role check.

## Data Rule
- Display formats and fallback values must be consistent.
- Do not parse mixed API response shapes in component; normalize in adapter.
