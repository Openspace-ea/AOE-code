# AOECode.md

This file provides guidance to AOE Code when working with code in this repository.

## Tech Stack
- Language: Go {{GO_VERSION}}
- Framework: {{FRAMEWORK}}
- Database: {{DATABASE}}
- Testing: Go testing + {{TEST_TOOLS}}

## Common Commands
```bash
go build ./...           # Build all packages
go test ./...            # Run all tests
go test -run TestName    # Run specific test
go vet ./...             # Static analysis
{{CUSTOM_COMMANDS}}
```

## Project Structure
```
cmd/            # Application entrypoints
internal/       # Private packages
pkg/            # Public packages
api/            # API definitions
```

## Coding Conventions
- Follow Effective Go guidelines
- Small interfaces (1-3 methods)
- Error wrapping with `fmt.Errorf("context: %w", err)`
- Context as first parameter
- Table-driven tests
{{CUSTOM_CONVENTIONS}}

## Error Handling
- Always check errors explicitly
- Custom error types for domain errors
- `errors.Is` / `errors.As` for error inspection
- Wrap errors with context

## Testing Guidelines
- Table-driven tests
- Testify assertions (if used)
- Test files alongside source files
{{TESTING_NOTES}}
