use crate::models::{Event, EventType, MouseButton, NitsRec};
use enigo::{
    Button, Coordinate, Direction, Enigo, Key, Keyboard, Mouse, Settings,
};
use std::thread;
use std::time::Duration;
use thiserror::Error;
use tokio::sync::watch;

#[derive(Debug, Error)]
pub enum PlayerError {
    #[error("enigo init failed: {0}")]
    EnigoInit(String),
    #[error("playback aborted by user")]
    Aborted,
    #[error("unknown key in event: {0}")]
    UnknownKey(String),
}

pub struct Player {
    tx: watch::Sender<bool>,
}

impl Player {
    pub fn new() -> (Self, watch::Receiver<bool>) {
        let (tx, abort_rx) = watch::channel(false);
        (Self { tx }, abort_rx)
    }

    pub fn abort(&self) {
        let _ = self.tx.send(true);
    }
}

pub fn get_screen_resolution() -> (u32, u32) {
    #[cfg(windows)]
    {
        use winapi::um::winuser::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};
        let w = unsafe { GetSystemMetrics(SM_CXSCREEN) } as u32;
        let h = unsafe { GetSystemMetrics(SM_CYSCREEN) } as u32;
        if w > 0 && h > 0 { return (w, h); }
    }
    (1920, 1080)
}

fn scale_coord(val: i32, recorded: u32, current: u32) -> i32 {
    if recorded == 0 { return val; }
    ((val as f64 / recorded as f64) * current as f64) as i32
}

fn catmull_rom_points(p0: [f64; 2], p1: [f64; 2], p2: [f64; 2], p3: [f64; 2], steps: usize) -> Vec<[f64; 2]> {
    let mut pts = Vec::with_capacity(steps);
    for i in 0..steps {
        let t  = i as f64 / steps as f64;
        let t2 = t * t;
        let t3 = t2 * t;
        for dim in 0..2 {
            let v0 = p0[dim];
            let v1 = p1[dim];
            let v2 = p2[dim];
            let v3 = p3[dim];
            let val = 0.5 * (
                (2.0 * v1)
                + (-v0 + v2) * t
                + (2.0 * v0 - 5.0 * v1 + 4.0 * v2 - v3) * t2
                + (-v0 + 3.0 * v1 - 3.0 * v2 + v3) * t3
            );
            if dim == 0 {
                pts.push([val, 0.0]);
            } else if let Some(last) = pts.last_mut() {
                last[1] = val;
            }
        }
    }
    pts
}

pub async fn play(
    rec:      &NitsRec,
    speed:    Option<f64>,
    dry_run:  bool,
    abort_rx: watch::Receiver<bool>,
) -> Result<(), PlayerError> {
    let speed       = speed.unwrap_or(rec.playback.speed).max(0.01);
    let loop_count  = rec.playback.loop_count.max(1);

    let (cur_w, cur_h) = get_screen_resolution();
    let (rec_w, rec_h) = rec.playback.recorded_resolution
        .map(|r| (r[0], r[1]))
        .unwrap_or((cur_w, cur_h));

    let scale = rec.playback.scale_to_current && (rec_w != cur_w || rec_h != cur_h);

    let mut enigo = if !dry_run {
        Some(
            Enigo::new(&Settings::default())
                .map_err(|e| PlayerError::EnigoInit(e.to_string()))?,
        )
    } else {
        None
    };

    for iteration in 0..loop_count {
        if dry_run {
            println!("[dry-run] loop iteration {}/{}", iteration + 1, loop_count);
        }

        let mut prev_time_ms = 0u64;

        for event in &rec.events {
            if *abort_rx.borrow() {
                return Err(PlayerError::Aborted);
            }

            if rec.playback.skip_mouse_move
                && matches!(event.event_type, EventType::MouseMove | EventType::MouseSegment)
            {
                continue;
            }

            let gap_ms       = event.time_ms.saturating_sub(prev_time_ms);
            let actual_delay = (gap_ms as f64 / speed) as u64;

            if actual_delay > 0 {
                if dry_run {
                    println!("[dry-run] wait {}ms", actual_delay);
                } else {
                    tokio::time::sleep(Duration::from_millis(actual_delay)).await;
                }
            }

            prev_time_ms = event.time_ms;

            if dry_run {
                println!("[dry-run] {:?}", event.event_type);
                continue;
            }

            if let Some(ref mut enigo) = enigo {
                execute_event(enigo, event, scale, rec_w, rec_h, cur_w, cur_h, speed).await?;
            }
        }
    }

    Ok(())
}

async fn execute_event(
    enigo:  &mut Enigo,
    event:  &Event,
    scale:  bool,
    rec_w:  u32,
    rec_h:  u32,
    cur_w:  u32,
    cur_h:  u32,
    speed:  f64,
) -> Result<(), PlayerError> {
    let sx = |v: i32| if scale { scale_coord(v, rec_w, cur_w) } else { v };
    let sy = |v: i32| if scale { scale_coord(v, rec_h, cur_h) } else { v };

    match event.event_type {
        EventType::KeyDown => {
            let key = parse_key(event.key.as_deref().unwrap_or(""))?;
            let _ = enigo.key(key, Direction::Press);
        }

        EventType::KeyUp => {
            let key = parse_key(event.key.as_deref().unwrap_or(""))?;
            let _ = enigo.key(key, Direction::Release);
        }

        EventType::MouseDown => {
            let btn = map_button(event.button.as_ref());
            let _   = enigo.button(btn, Direction::Press);
        }

        EventType::MouseUp => {
            let btn = map_button(event.button.as_ref());
            let _   = enigo.button(btn, Direction::Release);
        }

        EventType::MouseMove => {
            let x = sx(event.x.unwrap_or(0));
            let y = sy(event.y.unwrap_or(0));
            let _ = enigo.move_mouse(x, y, Coordinate::Abs);
        }

        EventType::MouseSegment => {
            let from_x = sx(event.x.unwrap_or(0));
            let from_y = sy(event.y.unwrap_or(0));
            let to_x   = sx(event.delta_x.unwrap_or(0) as i32);
            let to_y   = sy(event.delta_y.unwrap_or(0) as i32);
            let dur_ms = (event.duration_ms.unwrap_or(100) as f64 / speed) as u64;

            if let Some(ref waypoints) = event.waypoints {
                if waypoints.len() >= 2 {
                    let pts: Vec<[f64; 2]> = waypoints
                        .iter()
                        .map(|p| [sx(p[0]) as f64, sy(p[1]) as f64])
                        .collect();

                    let total_pts = pts.len();
                    let step_ms   = if total_pts > 1 { dur_ms / (total_pts as u64) } else { dur_ms };

                    for i in 0..total_pts {
                        let p0 = pts[i.saturating_sub(1)];
                        let p1 = pts[i];
                        let p2 = pts[(i + 1).min(total_pts - 1)];
                        let p3 = pts[(i + 2).min(total_pts - 1)];

                        let interp = catmull_rom_points(p0, p1, p2, p3, 5);
                        for pt in interp {
                            let _ = enigo.move_mouse(pt[0] as i32, pt[1] as i32, Coordinate::Abs);
                        }

                        if step_ms > 0 {
                            tokio::time::sleep(Duration::from_millis(step_ms)).await;
                        }
                    }
                } else {
                    let _ = enigo.move_mouse(to_x, to_y, Coordinate::Abs);
                }
            } else {
                let steps    = 20usize;
                let step_ms  = dur_ms / steps.max(1) as u64;
                for i in 0..=steps {
                    let t = i as f64 / steps as f64;
                    let x = (from_x as f64 + (to_x - from_x) as f64 * t) as i32;
                    let y = (from_y as f64 + (to_y - from_y) as f64 * t) as i32;
                    let _ = enigo.move_mouse(x, y, Coordinate::Abs);
                    if step_ms > 0 {
                        tokio::time::sleep(Duration::from_millis(step_ms)).await;
                    }
                }
            }
        }

        EventType::Scroll => {
            let dx = event.delta_x.unwrap_or(0) as i32;
            let dy = event.delta_y.unwrap_or(0) as i32;
            if dx != 0 { let _ = enigo.scroll(dx, enigo::Axis::Horizontal); }
            if dy != 0 { let _ = enigo.scroll(dy, enigo::Axis::Vertical); }
        }

        EventType::Delay => {
            let ms = event.duration_ms.unwrap_or(0);
            thread::sleep(Duration::from_millis(ms));
        }

        EventType::TypeText => {
            if let Some(ref text) = event.value {
                let _ = enigo.text(text);
            }
        }

        EventType::ClipboardPaste => {
            let _ = enigo.key(Key::Control, Direction::Press);
            let _ = enigo.key(Key::Unicode('v'), Direction::Click);
            let _ = enigo.key(Key::Control, Direction::Release);
        }
    }

    Ok(())
}

fn map_button(btn: Option<&MouseButton>) -> Button {
    match btn {
        Some(MouseButton::Right)  => Button::Right,
        Some(MouseButton::Middle) => Button::Middle,
        _                         => Button::Left,
    }
}

fn parse_key(s: &str) -> Result<Key, PlayerError> {
    let key = match s {
        "alt"       => Key::Alt,
        "backspace" => Key::Backspace,
        "capslock"  => Key::CapsLock,
        "ctrl"      => Key::Control,
        "delete"    => Key::Delete,
        "down"      => Key::DownArrow,
        "end"       => Key::End,
        "enter"     => Key::Return,
        "escape"    => Key::Escape,
        "f1"        => Key::F1,
        "f2"        => Key::F2,
        "f3"        => Key::F3,
        "f4"        => Key::F4,
        "f5"        => Key::F5,
        "f6"        => Key::F6,
        "f7"        => Key::F7,
        "f8"        => Key::F8,
        "f9"        => Key::F9,
        "f10"       => Key::F10,
        "f11"       => Key::F11,
        "f12"       => Key::F12,
        "home"      => Key::Home,
        "left"      => Key::LeftArrow,
        "meta"      => Key::Meta,
        "pagedown"  => Key::PageDown,
        "pageup"    => Key::PageUp,
        "right"     => Key::RightArrow,
        "shift"     => Key::Shift,
        "space"     => Key::Space,
        "tab"       => Key::Tab,
        "up"        => Key::UpArrow,
        s if s.len() == 1 => Key::Unicode(s.chars().next().unwrap()),
        other => return Err(PlayerError::UnknownKey(other.into())),
    };
    Ok(key)
}