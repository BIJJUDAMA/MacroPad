# MacroPad Architecture Overview

MacroPad's architecture is built on the principle of **Process Isolation for Timing-Critical Operations**. By separating the low-level event interception and playback from the user interface, the system achieves a degree of precision typically reserved for specialized hardware.

---

## Process Separation

MacroPad is split into two independent processes to guarantee that timing-critical operations are never interrupted by UI rendering or system load.

### 1. The Rust Daemon (`macropad-daemon`)
This is the core engine. It runs as a standalone binary in the background and handles everything timing-sensitive.

- **OS-Level Hardware Interception**: Hooks directly into the OS input stack at the lowest user-space layer. On Windows this uses `SetWindowsHookEx` with `WH_KEYBOARD_LL`. On macOS it uses `CGEventTap`. This ensures events are never missed by a polling cycle.
- **Async Runtime**: Uses `tokio` to manage global hotkey listening, IPC message polling, and macro execution state machines as concurrent tasks on separate threads. Nothing blocks.
- **State Machine**: Manages the transitions between Idle, Recording, and Playback modes with sub-millisecond precision.

### 2. The GUI Interface (`macropad-gui`)
The GUI is a visual representation of the daemon's state, not a controller of it.

- **Native Webview**: Renders using the host's native webview (WebView2 on Windows, WebKit on macOS/Linux), ensuring UI work stays off the daemon's threads.
- **Resource Isolation**: If the GUI crashes or hangs, the daemon continues executing the current macro safely.
- **Serialised Control**: Issues commands (Record, Stop, Play, Abort) that serialize over the local IPC socket to the daemon.

---

## Execution Engine Mechanics

Most automation tools operate at the application layer. They simulate input by asking the OS to inject events, but they start from above the point where hardware signals actually land. MacroPad starts lower.

### Low-Level Hardware Interception
By hooking into the lowest available user-space layer, MacroPad ensures that playback is indistinguishable from physical input. Privileged environments that reject simulated input at the application layer still accept it here.

### Visual Node Editor
Recordings are stored as structured event trees, not flat logs. The React GUI lets you edit that tree directly:
- **DelayNode**: Adjust timing in milliseconds.
- **MouseNode**: Absolute coordinates, buttons, and scroll deltas.
- **KeyNode**: Virtual Key Codes or Scancodes with state (Press, Hold, Release).

---

## Advanced Features

### 1. Intelligent Display Scaling
Record a macro on a 4K desktop, play it back on a 1080p laptop. MacroPad embeds the native display resolution into the recording and dynamically scales absolute mouse coordinates at runtime via ratio matrices.

### 2. Input Consolidation
Raw OS recording generates thousands of micro-movement events per second. The recording engine merges adjacent, functionally identical path segments into optimized vectors in real time, reducing file size and ensuring smooth playback without micro-jitter.

### 3. Global Hotkey Routing (Coming Soon)
The daemon maintains a dedicated listening thread for hotkey chords. When a chord fires, playback starts immediately regardless of which application has focus or whether the GUI is running at all.

### 4. Playback Overrides
Speed, loop count, and coordinate offsets can be set globally at runtime, applied uniformly across all nodes in a recording without editing the file itself.

---

## Inter-Process Communication (IPC)

MacroPad bypasses the network stack for security and performance. It uses native OS channels:
- **Windows**: Named Pipes (`\\.\pipe\macropad-ipc`)
- **macOS/Linux**: Unix Domain Sockets

The protocol uses a customized JSON-based schema for command serialization, ensuring robust synchronization between the C++ based OS hooks, the Rust middle-ware, and the JavaScript-based frontend.

---

## Low-Level Implementation

| Layer | Technology | Responsibility | Status |
| :--- | :--- | :--- | :--- |
| **User Space** | React / Tailwind | Interface, configuration, and library visualizer. | Stable |
| **Middle-ware** | Rust / Tokio | Async task scheduling, IPC server, and script runner. | **In Dev** |
| **OS Hooks** | C / Win32 / Quartz | Low-level hardware signal interception and injection. | Stable |

---

## Design Philosophy

- **Stability**: If the GUI crashes or hangs, the daemon continues executing the current macro safely.
- **Persistence**: Hotkey triggers are handled directly by the daemon, allowing macros to fire even when the GUI is completely closed.
- **Efficiency**: The daemon's memory footprint is kept under 20MB, making it suitable for long-term background operation on any modern hardware.
