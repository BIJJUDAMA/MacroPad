<p align="center">
  <img src="docs/assets/banner.svg" width="100%" alt="Macropad Banner">
</p>

<p align="center">

  <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License">
  <img src="https://img.shields.io/badge/rust-1.75%2B-orange.svg" alt="Rust Version">
  <img src="https://img.shields.io/badge/platform-win%20|%20macos%20|%20linux-lightgrey.svg" alt="Platform Support">
</p>

## Technical Documentation

Explore the high-fidelity design and programmable capabilities of Macropad:
- **[Architecture Overview](docs/ARCHITECTURE.md)**: Process isolation, OS-level hooks, and IPC protocol design.
- **[Scripting Guide](docs/SCRIPTING.md)**: Deep dive into the `.mps` language, variables, and execution rules.

---

# MacroPad

MacroPad is a desktop automation tool built around one constraint: the recording and playback must be exact. Not "close enough." Not "works most of the time." Exact.

To get there, the architecture splits into two independent processes: a background daemon written in Rust that owns all event capture and playback, and a React/Tauri interface that handles configuration and state. The daemon runs whether the GUI is open or not. The GUI never touches a timing-critical path. This separation is the reason MacroPad can make guarantees that general-purpose automation tools cannot.

---

## Quick Start

1. **Download**: Grab the latest installer for your OS from the [Releases](../../releases) page.
2. **Launch**: Open MacroPad. The background daemon will initialize automatically in your system tray.
3. **Record**: Click the **Record** button in the GUI, perform your sequence of keyboard/mouse actions, and click **Stop**.
4. **Play**: Assign a Global Hotkey or simply click **Play** to replay your macro with microsecond precision.



---

## Architecture at a Glance

MacroPad's architecture is built on **Process Isolation**. By separating the low-level event interception (Rust Daemon) from the user interface (React GUI), the system achieves hardware-level precision.

For a deep dive into our OS hooks, display scaling, and IPC protocol, see the **[Architecture Overview](docs/ARCHITECTURE.md)**.




---

## File Formats

Both formats are plaintext, human-readable, and work cleanly with version control.

### <img src="docs/assets/mpr_icon.png" width="24" align="center"> The MPR Format (`.mpr`)

An `.mpr` file is a validated JSON document representing a chronological sequence of hardware events.

<details>
<summary><b>View Technical Specification</b></summary>

It consists of three primary sections:

- **Header:** Semantic version for backwards compatibility, ISO 8601 timestamps, author fields, and user-defined tags for organizing large libraries.
- **Config:** The display resolution at recording time, loop thresholds, and playback speed multiplier. If you run an `.mpr` on a different display resolution, the daemon detects the mismatch and scales absolute mouse coordinates via ratio matrices automatically.
- **Event Tree:** The actual sequence of nodes:
  - `DelayNode`: A deliberate pause in milliseconds.
  - `MouseNode`: Absolute X,Y coordinates, button state (`LeftDown`, `RightUp`, `Extra1`), and scroll wheel delta.
  - `KeyNode`: Virtual Key Code or Scancode, with explicit state (`Press`, `Hold`, `Release`) for accurate chord and modifier recreation.

</details>

### <img src="docs/assets/mps_icon.png" width="24" align="center"> The MPS Format (`.mps`) (Coming Soon)

> [!CAUTION]
> **ROADMAP FEATURE**: The `.mps` engine is currently in the late stages of development. Both CLI and GUI-based orchestration and debugging are locked in the current release.

`.mps` is where MacroPad stops being a recorder and becomes a programmable automation engine.

<details>
<summary><b>View Scripting Engine Capabilities</b></summary>

An `.mps` file is a script interpreted directly by the Rust daemon's execution engine. It is Turing-complete. What this unlocks in practice:

- **Control flow:** Standard `for`/`while` loops, `if/else` branching on environment variables, polling loops that wait for a specific pixel color to appear before continuing.
- **Dynamic input:** Variables, arithmetic, and runtime-generated input arguments. You can randomize delay intervals between keystrokes to produce human-level timing variance, or calculate mouse targets relative to the active window's current dimensions rather than against fixed coordinates.
- **Composition:** An `.mps` script can invoke `.mpr` recordings as components. Build a library of small, reusable macros ("Login.mpr", "SubmitForm.mpr") and orchestrate them with logic in a parent script.
- **Sequential Execution:** By default, the `run` command blocks script execution until the daemon finishes playing the target macro. This ensures predictable timing in loops and prevents "daemon is busy" synchronization errors.
- **Platform-native Lexing:** The script lexer is optimized for Windows environments, supporting raw string paths (`r"C:\..."`) and standard file system conventions for robust cross-directory automation.
- **Direct execution:** When the daemon receives an `.mps` execution command via hotkey, it compiles the script to an AST in memory and runs it. The GUI is not involved. This is the fastest execution path.

</details>

---

## Platform Support

Macropad compiles to native machine code for each target. There is no JVM, no Python runtime, no wrapper layer.

The CI pipeline produces native installers for:

- **Windows (x64):** `.msi` and `.exe` (Setup)
- **macOS (Universal):** `.dmg` and `.app.tar.gz` (Apple Silicon & Intel)
- **Linux (x86_64, aarch64):** `.AppImage`, `.deb`, and `.rpm`

The daemon binary ships inside the Tauri installation directory and communicates over OS-native IPC sockets. The behavior is identical across platforms.

---

## Testing & Quality Assurance

Macropad maintains a high standard of reliability through a multi-layered testing architecture and automated verification.

**Centralized Integration Suite**

A dedicated `tests/` package at the workspace root manages complex end-to-end scenarios. These tests bypass the GUI to interact directly with the Rust daemon and IPC layer, simulating real-world automation workflows.

**Core & Scripting Validation**

- **Logic Flow**: Automated tests verify that the scripting engine correctly handles variable scoping, conditional branching, and loop iterations.
- **Data Integrity**: Every hardware event (keyboard, mouse, delay) is validated for serialization correctness across the IPC boundary.
- **Path Handling**: Dedicated lexer tests ensure that Windows-style paths and raw strings are parsed accurately without escaping side effects.

**Continuous Integration**

Every commit and pull request triggers an automated GitHub Actions pipeline on Windows. The CI environment enforces a strict quality gate:
- **Workspace Tests**: Executes the full suite of unit and integration tests.
- **Static Analysis**: Runs Clippy for deep code quality inspections and performance optimization suggestions.
- **Format Enforcement**: Validates that all code adheres to the project's formatting standards via `rustfmt`.

---

## License

Macropad is open source under the Apache License 2.0. See the `LICENSE` file in the repository for full terms.