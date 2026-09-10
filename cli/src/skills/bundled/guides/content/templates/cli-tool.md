# AOECode.md

This file provides guidance to AOE Code when working with code in this repository.

## CLI Tool
- Language: {{LANGUAGE}}
- CLI Framework: {{CLI_FRAMEWORK}}
- Distribution: {{DISTRIBUTION}}

## Common Commands
```bash
{{BUILD_COMMAND}}        # Build
{{TEST_COMMAND}}         # Run tests
{{INSTALL_COMMAND}}      # Install locally
{{RELEASE_COMMAND}}      # Release
```

## CLI Design
- Subcommands: `tool <command> [args] [flags]`
- Help: `--help` on every command
- Version: `--version`
- Exit codes: 0 success, 1 user error, 2 system error
- Stdout for data, stderr for messages

## Project Structure
{{STRUCTURE_NOTES}}

## Coding Conventions
- Input validation at the boundary
- Graceful error messages (no stack traces for users)
- Support `--json` flag for machine-readable output
- Support `--quiet` / `--verbose` flags
{{CUSTOM_CONVENTIONS}}

## Testing Guidelines
- Unit tests for core logic
- Integration tests using subprocess
- Test help output and exit codes
{{TESTING_NOTES}}
