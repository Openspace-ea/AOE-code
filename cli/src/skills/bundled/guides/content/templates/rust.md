# AOECode.md

This file provides guidance to AOE Code when working with code in this repository.

## Tech Stack
- Language: Rust {{RUST_VERSION}}
- Framework: {{FRAMEWORK}}
- Async Runtime: Tokio
- Database: {{DATABASE}}
- Testing: Built-in test framework

## Common Commands
```bash
cargo build              # Build
cargo test               # Run tests
cargo clippy             # Lint
cargo fmt                # Format
cargo run                # Run
{{CUSTOM_COMMANDS}}
```

## Project Structure
{{STRUCTURE_NOTES}}

## Coding Conventions
- Use `thiserror` for library errors, `anyhow` for application errors
- Prefer iterators over manual loops
- Use `impl Trait` for function parameters when possible
- Document public items with `///`
{{CUSTOM_CONVENTIONS}}

## Ownership & Borrowing
- Prefer borrowing (`&T`) over ownership transfer
- Use `clone()` sparingly
- `Arc<T>` for shared ownership across threads
- `Rc<T>` for single-threaded shared ownership

## Testing Guidelines
- Unit tests in `#[cfg(test)]` modules
- Integration tests in `tests/` directory
- Use `#[tokio::test]` for async tests
{{TESTING_NOTES}}
