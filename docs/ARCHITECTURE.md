# Macropad Architecture Overview

Macropad's architecture is built on the principle of **Process Isolation for Timing-Critical Operations**. By separating the low-level event interception and playback from the user interface, the system achieves a degree of precision typically reserved for specialized hardware.

---

## Process Separation

### 1. The Rust Daemon (`macropad-daemon`)
The daemon is a standalone, always-on Rust application that owns all critical paths:
- **Low-Level Interception**: Directly hooks into OS-level input stacks (`SetWindowsHookEx` on Windows, Quartz on macOS).
- **Playback Engine**: Executes `.mpr` and `.mps` instructions with sub-millisecond precision.
- **State Machine**: Manages the transitions between Idle, Recording, and Playback modes.
- **IPC Server**: Listens on high-speed OS-native pipes/sockets for commands from the interface.

### 2. The GUI Interface (`macropad-gui`)
The GUI is a React-based application wrapped in the Tauri framework:
- **Zero-Latency Impact**: The UI runs in a separate process, ensuring that heavy interface rendering or network activity never interferes with macro timing.
- **Visualization**: Renders the library, node-based event trees, and real-time execution status.
- **Communication**: Acts as an IPC client, sending commands (Play, Record, Abort) to the daemon.

---

## Inter-Process Communication (IPC)

Macropad bypasses the network stack for security and performance. It uses native OS channels:
- **Windows**: Named Pipes (`\\.\pipe\macropad-ipc`)
- **macOS/Linux**: Unix Domain Sockets

The protocol uses a customized JSON-based schema for command serialization, ensuring robust synchronization between the C++ based OS hooks, the Rust middle-ware, and the JavaScript-based frontend.

---

## Low-Level Implementation

| Layer | Technology | Responsibility |
| :--- | :--- | :--- |
| **User Space** | React / Tailwind | Interface, configuration, and library visualizer. |
| **Middle-ware** | Rust / Tokio | Async task scheduling, IPC server, and script runner. |
| **OS Hooks** | C / Win32 / Quartz | Low-level hardware signal interception and injection. |

---

## Design Philosophy

- **Stability**: If the GUI crashes or hangs, the daemon continues executing the current macro safely.
- **Persistence**: Hotkey triggers are handled directly by the daemon, allowing macros to fire even when the GUI is completely closed.
- **Efficiency**: The daemon's memory footprint is kept under 20MB, making it suitable for long-term background operation on any modern hardware.
