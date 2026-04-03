# MacroPad Scripting Guide (`.mps`)

> [!CAUTION]
> **WORK IN PROGRESS**: The scripting engine and `.mps` format are currently under active development. Some features described below may be partially implemented or unavailable in the current release.

MacroPad Script (`.mps`) elevates simple recordings into dynamic automation workflows. The scripting engine is built for reliability, providing Turing-complete logic without the overhead of a full general-purpose runtime.

---

## Language Basics

### Variables
Use the `let` keyword to define or update variables. Variable names MUST start with a `$`.
```mps
let $val = 10
let $status = "initial"
```

### Delay and Timing
The `delay` command pauses execution for a specified duration.
```mps
delay 500ms
delay 2s
```

---

## Macro Composition

The `run` command invokes an `.mpr` recording as a component of the script.

### Sequential Execution (Default)
By default, the `run` command is **blocking**. The script will wait until the macro finishes before moving to the next line. This prevents overlapping commands and ensures predictable timing.
```mps
run "C:\macros\login.mpr"
run "C:\macros\do_work.mpr"
```

### Asynchronous Execution
If you need to fire a macro and continue immediately, use `run_async`.
```mps
run_async "C:\macros\background_task.mpr"
delay 500ms
```

---

## Control Flow

### If / Else
Standard branching based on system state or pixel evaluation.
```mps
if true {
    let $result = "pass"
} else {
    let $result = "fail"
}
```

### Loops
Execute a block of code multiple times.
```mps
loop (5) {
    run "C:\macros\click_item.mpr"
    delay 100ms
}
```

---

## Advanced Features

### Windows Path Handling
The lexer is optimized for Windows file systems, supporting raw strings for robust path handling.
```mps
run r"C:\Users\Name\Documents\Macro.mpr"
```

### Built-in Variables
The following variables are available by default in every script:
- `$date`: Current date (`YYYY-MM-DD`)
- `$time`: Current time (`HH:MM:SS`)
- `$username`: Current OS user.
- `$home`: User's home directory.

---

## Testing and Verification

MacroPad includes a dedicated integration test suite to verify script logic. See the `tests/` directory for examples of automated verification for variable scoping and control flow.
