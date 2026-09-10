# AOECode.md

This file provides guidance to AOE Code when working with code in this repository.

## Monorepo Structure
- Tool: {{MONOREPO_TOOL}} (Turborepo / Nx / pnpm workspaces / Lerna)
- Package Manager: {{PKG_MANAGER}}

## Common Commands
```bash
{{INSTALL_COMMAND}}      # Install all dependencies
{{BUILD_COMMAND}}        # Build all packages
{{TEST_COMMAND}}         # Run all tests
{{LINT_COMMAND}}         # Lint all packages
{{RUN_COMMAND}}          # Run specific package script
```

## Package Layout
```
packages/
  shared/        # Shared utilities
  ui/            # UI component library
  api/           # Backend API
  web/           # Web application
```

## Coding Conventions
- Shared code goes in `packages/shared`
- Each package has its own `package.json` and `tsconfig.json`
- Use workspace protocol for internal dependencies
- Changes to shared packages trigger rebuilds of dependents
{{CUSTOM_CONVENTIONS}}

## Dependency Management
- Hoist common dependencies to root
- Keep package versions aligned
- Use `catalog:` protocol if supported

## Testing Guidelines
- Unit tests per package
- Integration tests at the app level
- Shared test utilities in a test package
{{TESTING_NOTES}}
