# AOECode.md

This file provides guidance to AOE Code when working with code in this repository.

## Tech Stack
- Framework: Vue {{VERSION}} with TypeScript
- Build: {{BUILD_TOOL}}
- Package Manager: {{PKG_MANAGER}}
- State Management: {{STATE_MGMT}}
- Router: Vue Router {{ROUTER_VERSION}}
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
- Use `<script setup>` syntax
- Use Composition API (not Options API)
- Props: `defineProps` with TypeScript types
- Emits: `defineEmits` with TypeScript types
- Reactive: `ref` for primitives, `reactive` for objects
{{CUSTOM_CONVENTIONS}}

## Vue Specific
- Single File Components (.vue)
- Auto-imports for Vue APIs (if configured)
- Use `computed` for derived state
- Use `watch` / `watchEffect` for side effects
{{VUE_NOTES}}

## Testing Guidelines
- Component tests with Vue Test Utils
- Store tests in isolation
{{TESTING_NOTES}}
