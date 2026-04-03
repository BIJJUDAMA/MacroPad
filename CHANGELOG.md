# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-30

### Added
- **Auto-Minimize on Record**: App now clears the workspace when a macro begins.
- **Library Synchronization**: Stop Recording now awaits file data before returning.
- **Improved Macro Hook**: Granular event capture for mouse segments and keyboard events.
- **Diagnostic Logging**: Verbose daemon and core diagnostics (events count, OS lifecycle).
- **Professional Branding**: Standardized product name as Macropad.

### Fixed
- **Recording Engine Failure**: Resolved event loss on stop signal.
- **IPC Naming Mismatch**: Sync between frontend and backend arguments.
- **Date Type Compilation**: Fixed Rust cross-crate type mismatch.

### Security
- **IPC Sanitization**: Enhanced path validation for macro storage.

---

[1.0.0]: https://github.com/BIJJUDAMA/macropad/releases/tag/1.0.0
