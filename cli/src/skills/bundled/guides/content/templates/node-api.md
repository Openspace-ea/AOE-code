# AOECode.md

This file provides guidance to AOE Code when working with code in this repository.

## Tech Stack
- Runtime: Node.js {{NODE_VERSION}}
- Framework: {{FRAMEWORK}} (Express / Fastify / Hono)
- Language: TypeScript
- Database: {{DATABASE}}
- ORM: {{ORM}}
- Testing: {{TEST_FRAMEWORK}}

## Common Commands
```bash
{{DEV_COMMAND}}          # Start dev server
{{BUILD_COMMAND}}        # Build
{{TEST_COMMAND}}         # Run tests
{{LINT_COMMAND}}         # Lint
{{DB_COMMAND}}           # Database migrations
```

## API Design
- RESTful conventions
- JSON request/response
- Standard error format: `{ error: { code, message, details } }`
- Pagination: `?page=1&limit=20`
- Versioning: `/api/v1/`

## Project Structure
{{STRUCTURE_NOTES}}

## Coding Conventions
- Controllers handle HTTP, Services handle logic, Repositories handle data
- Input validation with Zod at API boundary
- Async/await everywhere, no callbacks
- Error handling middleware catches all
{{CUSTOM_CONVENTIONS}}

## Testing Guidelines
- Unit tests for services
- Integration tests for API endpoints
- Use supertest for HTTP testing
{{TESTING_NOTES}}
