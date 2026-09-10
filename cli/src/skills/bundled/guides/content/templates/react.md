# AOECode.md

This file provides guidance to AOE Code when working with code in this repository.

## Tech Stack
- Framework: React {{VERSION}} with TypeScript
- Build: {{BUILD_TOOL}}
- Package Manager: {{PKG_MANAGER}}
- Styling: {{CSS_APPROACH}}
- State: {{STATE_MGMT}}
- Testing: {{TEST_FRAMEWORK}}

## Common Commands
```bash
{{DEV_COMMAND}}          # Start dev server
{{BUILD_COMMAND}}        # Production build
{{TEST_COMMAND}}         # Run tests
{{LINT_COMMAND}}         # Lint code
```

## Project Structure
{{STRUCTURE_NOTES}}

## Coding Conventions
- Use function components with hooks exclusively
- Prefer named exports
- Keep components under 200 lines
- Extract reusable logic into custom hooks
- Use TypeScript strict mode
- Props interfaces use `type` not `interface`
{{CUSTOM_CONVENTIONS}}

## Testing Guidelines
- Unit tests for hooks and utilities
- Component tests with {{TEST_FRAMEWORK}}
- Mock external dependencies only
- Test behavior, not implementation
{{TESTING_NOTES}}

## Performance Notes
- Use React.memo for expensive pure components
- Use useCallback/useMemo for referential stability
- Code split routes with React.lazy
{{PERFORMANCE_NOTES}}
