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

pub async fn play(
    rec: &NitsRec,
    speed: Option<f64>,
    dry_run: bool,
   abort_rx: watch::Receiver<bool>,
) -> Result<(), PlayerError> {
    let speed = speed.unwrap_or(rec.playback.speed).max(0.01);
    let loop_count = rec.playback.loop_count.max(1);

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
            // check abort signal
            if *abort_rx.borrow() {
                return Err(PlayerError::Aborted);
            }

            // compute delay from previous event
            let gap_ms = event.time_ms.saturating_sub(prev_time_ms);
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
                execute_event(enigo, event)?;
            }
        }
    }

    Ok(())
}

fn execute_event(enigo: &mut Enigo, event: &Event) -> Result<(), PlayerError> {
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
            let _ = enigo.button(btn, Direction::Press);
        }

        EventType::MouseUp => {
            let btn = map_button(event.button.as_ref());
            let _ = enigo.button(btn, Direction::Release);
        }

        EventType::MouseMove => {
            let x = event.x.unwrap_or(0);
            let y = event.y.unwrap_or(0);
            let _ = enigo.move_mouse(x, y, Coordinate::Abs);
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
        s if s.len() == 1 => {
            Key::Unicode(s.chars().next().unwrap())
        }
        other => return Err(PlayerError::UnknownKey(other.into())),
    };
    Ok(key)
}