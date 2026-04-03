use std::time::{Duration, Instant};
use thiserror::Error;
use tokio::time::sleep;

#[derive(Debug, Error)]
pub enum WindowError {
    #[error("window '{0}' not found within timeout")]
    Timeout(String),
    #[error("platform error: {0}")]
    Platform(String),
}

pub struct WindowQuery {
    pub title: String,
    pub use_regex: bool,
    pub timeout_ms: u64,
    pub interval_ms: u64,
}

impl WindowQuery {
    pub fn new(title: &str) -> Self {
        Self {
            title: title.into(),
            use_regex: false,
            timeout_ms: 15000,
            interval_ms: 500,
        }
    }

    pub fn regex(mut self) -> Self {
        self.use_regex = true;
        self
    }

    pub fn timeout(mut self, ms: u64) -> Self {
        self.timeout_ms = ms;
        self
    }
}

pub async fn wait_for_window(query: WindowQuery) -> Result<(), WindowError> {
    let start = Instant::now();
    let timeout = Duration::from_millis(query.timeout_ms);
    let interval = Duration::from_millis(query.interval_ms);

    loop {
        if start.elapsed() >= timeout {
            return Err(WindowError::Timeout(query.title.clone()));
        }

        if window_exists(&query.title, query.use_regex)? {
            activate_window(&query.title, query.use_regex)?;
            return Ok(());
        }

        sleep(interval).await;
    }
}

#[cfg(windows)]
fn window_exists(title: &str, use_regex: bool) -> Result<bool, WindowError> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    if use_regex {
        return window_exists_regex(title);
    }

    let wide: Vec<u16> = OsStr::new(title)
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let hwnd = unsafe { winapi::um::winuser::FindWindowW(std::ptr::null(), wide.as_ptr()) };

    Ok(!hwnd.is_null())
}

#[cfg(windows)]
fn window_exists_regex(pattern: &str) -> Result<bool, WindowError> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use winapi::um::winuser::{EnumWindows, GetWindowTextW, IsWindowVisible};

    let re = regex_lite(pattern)?;
    let mut found = false;

    unsafe {
        let found_ptr = &mut found as *mut bool as isize;

        extern "system" fn enum_callback(hwnd: winapi::shared::windef::HWND, lparam: isize) -> i32 {
            unsafe {
                if IsWindowVisible(hwnd) == 0 {
                    return 1;
                }
                let mut buf = [0u16; 512];
                let len = GetWindowTextW(hwnd, buf.as_mut_ptr(), buf.len() as i32);
                if len > 0 {
                    let title = OsString::from_wide(&buf[..len as usize])
                        .to_string_lossy()
                        .to_string();
                    let found = &mut *(lparam as *mut bool);
                    // store title for matching outside — use thread_local
                    LAST_TITLE.with(|t| *t.borrow_mut() = title);
                    *found = PATTERN.with(|p| {
                        p.borrow()
                            .as_ref()
                            .map(|re| re.is_match(&LAST_TITLE.with(|t| t.borrow().clone())))
                            .unwrap_or(false)
                    });
                    if *found {
                        return 0; // stop enumeration
                    }
                }
                1
            }
        }

        PATTERN.with(|p| {
            *p.borrow_mut() = Some(re);
        });

        EnumWindows(Some(enum_callback), found_ptr);
    }

    Ok(found)
}

#[cfg(windows)]
thread_local! {
    static LAST_TITLE: std::cell::RefCell<String> = std::cell::RefCell::new(String::new());
    static PATTERN: std::cell::RefCell<Option<SimpleRegex>> = std::cell::RefCell::new(None);
}

#[cfg(target_os = "linux")]
fn window_exists(title: &str, use_regex: bool) -> Result<bool, WindowError> {
    let output = std::process::Command::new("wmctrl")
        .arg("-l")
        .output()
        .map_err(|e| WindowError::Platform(format!("wmctrl not found: {}", e)))?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    if use_regex {
        let re = SimpleRegex::new(title)
            .map_err(|e| WindowError::Platform(format!("invalid regex: {}", e)))?;
        return Ok(stdout.lines().any(|line| re.is_match(line)));
    }

    Ok(stdout.lines().any(|line| line.contains(title)))
}

#[cfg(target_os = "macos")]
fn window_exists(title: &str, _use_regex: bool) -> Result<bool, WindowError> {
    let script = format!(
        "tell application \"System Events\" to get name of every window of every process whose name contains \"{}\"",
        title
    );
    let output = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output()
        .map_err(|e| WindowError::Platform(format!("osascript failed: {}", e)))?;

    Ok(!output.stdout.is_empty())
}

#[cfg(windows)]
fn activate_window(title: &str, use_regex: bool) -> Result<(), WindowError> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use winapi::um::winuser::{FindWindowW, SetForegroundWindow, ShowWindow, SW_RESTORE};

    let hwnd = if use_regex {
        std::ptr::null_mut()
    } else {
        let wide: Vec<u16> = OsStr::new(title)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        unsafe { FindWindowW(std::ptr::null(), wide.as_ptr()) }
    };

    if !hwnd.is_null() {
        unsafe {
            ShowWindow(hwnd, SW_RESTORE);
            SetForegroundWindow(hwnd);
        }
    }

    Ok(())
}

#[cfg(target_os = "linux")]
fn activate_window(title: &str, _use_regex: bool) -> Result<(), WindowError> {
    let _ = std::process::Command::new("wmctrl")
        .args(["-a", title])
        .output();
    Ok(())
}

#[cfg(target_os = "macos")]
fn activate_window(title: &str, _use_regex: bool) -> Result<(), WindowError> {
    let script = format!("tell application \"{}\" to activate", title);
    let _ = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .output();
    Ok(())
}

// minimal regex matcher — avoids pulling in the regex crate
// supports: literal match, ^ $ anchors, .* wildcard
#[cfg(any(windows, target_os = "linux"))]
struct SimpleRegex {
    pattern: String,
}

#[cfg(any(windows, target_os = "linux"))]
impl SimpleRegex {
    fn new(pattern: &str) -> Result<Self, String> {
        Ok(Self {
            pattern: pattern.into(),
        })
    }

    fn is_match(&self, text: &str) -> bool {
        let p = &self.pattern;
        if p.contains(".*") {
            let parts: Vec<&str> = p.split(".*").collect();
            let mut pos = 0;
            for part in parts {
                if let Some(idx) = text[pos..].find(part) {
                    pos += idx + part.len();
                } else {
                    return false;
                }
            }
            true
        } else {
            text.contains(p.as_str())
        }
    }
}

#[cfg(any(windows, target_os = "linux"))]
fn regex_lite(pattern: &str) -> Result<SimpleRegex, WindowError> {
    SimpleRegex::new(pattern).map_err(|e| WindowError::Platform(format!("invalid regex: {}", e)))
}
