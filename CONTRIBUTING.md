
## Development Setup

To contribute to MacroPad, you will need the following installed:

- **Rust**: Version 1.75 or higher.
- **Node.js**: Version 20 (LTS).
- **System Dependencies**:
  - **Windows**: No extra dependencies usually required.
  - **Linux**: You will need `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `libxdo-dev`, and `patchelf`.

### Getting Started

1. **Clone the repository**:
   ```bash
   git clone https://github.com/BIJJUDAMA/MacroPad.git
   cd macronits
   ```

2. **Initialize the GUI**:
   ```bash
   cd gui
   npm install
   ```

3. **Build the Daemon**:
   The GUI depends on a background daemon sidecar. You must build this at least once before running the GUI in dev mode.
   ```bash
   # From the root directory
   ./scripts/build-sidecar.sh   # Unix
   # OR
   ./scripts/build-sidecar.ps1  # Windows (PowerShell)
   ```

4. **Run in Development**:
   ```bash
   cd gui
   npm run tauri dev
   ```

---

## Architecture Overview

- **`crates/core`**: Low-level OS hooks, event capture, and playback logic.
- **`crates/script`**: The `.mps` scripting engine (lexer, parser, interpreter).
- **`crates/daemon`**: The background process that orchestrates the core and handles IPC.
- **`gui/`**: The Tauri-based React frontend.
- **`tests/`**: Integration tests that simulate end-to-end automation.

For a deeper dive, see **[Architecture Overview](docs/ARCHITECTURE.md)**.

---

## Testing and Quality

We enforce high standards to ensure microsecond precision remains unbroken.

### Running Tests
Always run the full test suite before submitting a Pull Request:
```bash
cargo test --workspace
```

### Formatting & Linting
We use `rustfmt` and `clippy`. Your code must pass both:
```bash
cargo fmt --all -- --check
cargo clippy --workspace -- -D warnings
```

---

## Pull Request Process

> [!IMPORTANT]
> 1. **Branching**: Create a feature branch from `development`.
> 2. **Commit Messages**: Write clear, descriptive commit messages.
> 3. **CI Pipeline**: Every PR triggers an automated test suite.
>    - If you are only updating documentation or non-code files, you can skip the Rust tests by adding `[skip rust]` or `[skip tests]` to your commit message or PR title.

---

## License

By contributing, you agree that your contributions will be licensed under the **Apache License 2.0**.
