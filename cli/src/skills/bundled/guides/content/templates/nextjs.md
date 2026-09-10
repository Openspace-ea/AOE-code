# AOECode.md

This file provides guidance to AOE Code when working with code in this repository.

## Tech Stack
- Framework: Next.js {{VERSION}} with TypeScript
- Rendering: {{RENDERING_MODE}} (SSR / SSG / App Router)
- Package Manager: {{PKG_MANAGER}}
- Styling: {{CSS_APPROACH}}
- Database: {{DATABASE}}
- Auth: {{AUTH_SOLUTION}}

## Common Commands
```bash
{{DEV_COMMAND}}          # Start dev server
{{BUILD_COMMAND}}        # Production build
{{TEST_COMMAND}}         # Run tests
{{LINT_COMMAND}}         # Lint code
```

## App Router Conventions
- `page.tsx` — Route component
- `layout.tsx` — Shared layout
- `loading.tsx` — Loading UI (Suspense)
- `error.tsx` — Error boundary
- `route.ts` — API route handler
- `middleware.ts` — Request middleware

## Project Structure
{{STRUCTURE_NOTES}}

## Coding Conventions
- Server Components by default, add 'use client' only when needed
- Server Actions for mutations
- Keep client components at the leaf of the component tree
{{CUSTOM_CONVENTIONS}}

## Data Fetching
- Server Components: async/await directly in component
- Client: use SWR or React Query
- API Routes: `app/api/` directory
{{DATA_FETCHING_NOTES}}

## Testing Guidelines
- Unit tests for utilities and hooks
- Integration tests for API routes
- E2E tests for critical flows
{{TESTING_NOTES}}
