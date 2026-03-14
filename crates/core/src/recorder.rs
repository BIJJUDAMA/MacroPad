use crate::models::{Event, EventType, MouseButton};
use rdev::{listen, EventType as RdevEventType, Key};
use std::sync::mpsc as std_mpsc;
use std::thread;
use std::time::Instant;
use thiserror::Error;
use tokio::sync::mpsc as tokio_mpsc;

#[derive(Debug, Error)]
pub enum RecorderError {
    #[error("failed to start rdev listener: {0}")]
    ListenFailed(String),
    #[error("recorder channel closed")]
    ChannelClosed,
}

pub struct Recorder {
    pub rx: tokio_mpsc::Receiver<Event>,
    stop_tx: std_mpsc::Sender<()>,
}

impl Recorder {
    pub fn start() -> Result<Self, RecorderError> {
        let (event_tx, event_rx) = tokio_mpsc::channel::<Event>(1024);
        let (stop_tx, stop_rx) = std_mpsc::channel::<()>();

        thread::spawn(move || {
            let start = Instant::now();

            let callback = {
                let event_tx = event_tx.clone();
                move |rdev_event: rdev::Event| {
                    // check stop signal without blocking
                    if stop_rx.try_recv().is_ok() {
                        return;
                    }

                    let time_ms = start.elapsed().as_millis() as u64;

                    if let Some(event) = convert_event(rdev_event, time_ms) {
                        let _ = event_tx.blocking_send(event);
                    }
                }
            };

            if let Err(e) = listen(callback) {
                eprintln!("[recorder] rdev listen error: {:?}", e);
            }
        });

        Ok(Self {
            rx:      event_rx,
            stop_tx,
        })
    }

    pub fn stop(self) {
        let _ = self.stop_tx.send(());
    }
}

fn convert_event(e: rdev::Event, time_ms: u64) -> Option<Event> {
    match e.event_type {
        RdevEventType::KeyPress(key) => Some(Event {
            event_type:  EventType::KeyDown,
            time_ms,
            key:         Some(key_to_string(key)),
            button:      None,
            x:           None,
            y:           None,
            delta_x:     None,
            delta_y:     None,
            duration_ms: None,
            value:       None,
        }),

        RdevEventType::KeyRelease(key) => Some(Event {
            event_type:  EventType::KeyUp,
            time_ms,
            key:         Some(key_to_string(key)),
            button:      None,
            x:           None,
            y:           None,
            delta_x:     None,
            delta_y:     None,
            duration_ms: None,
            value:       None,
        }),

        RdevEventType::ButtonPress(btn) => Some(Event {
            event_type:  EventType::MouseDown,
            time_ms,
            key:         None,
            button:      Some(convert_button(btn)),
            x:           None,
            y:           None,
            delta_x:     None,
            delta_y:     None,
            duration_ms: None,
            value:       None,
        }),

        RdevEventType::ButtonRelease(btn) => Some(Event {
            event_type:  EventType::MouseUp,
            time_ms,
            key:         None,
            button:      Some(convert_button(btn)),
            x:           None,
            y:           None,
            delta_x:     None,
            delta_y:     None,
            duration_ms: None,
            value:       None,
        }),

        RdevEventType::MouseMove { x, y } => Some(Event {
            event_type:  EventType::MouseMove,
            time_ms,
            key:         None,
            button:      None,
            x:           Some(x as i32),
            y:           Some(y as i32),
            delta_x:     None,
            delta_y:     None,
            duration_ms: None,
            value:       None,
        }),

        RdevEventType::Wheel { delta_x, delta_y } => Some(Event {
            event_type:  EventType::Scroll,
            time_ms,
            key:         None,
            button:      None,
            x:           None,
            y:           None,
            delta_x:     Some(delta_x),
            delta_y:     Some(delta_y),
            duration_ms: None,
            value:       None,
        }),
    }
}

fn convert_button(btn: rdev::Button) -> MouseButton {
    match btn {
        rdev::Button::Left   => MouseButton::Left,
        rdev::Button::Right  => MouseButton::Right,
        rdev::Button::Middle => MouseButton::Middle,
        _                    => MouseButton::Left,
    }
}

fn key_to_string(key: Key) -> String {
    match key {
        Key::Alt          => "alt".into(),
        Key::AltGr        => "altgr".into(),
        Key::Backspace    => "backspace".into(),
        Key::CapsLock     => "capslock".into(),
        Key::ControlLeft  => "ctrl".into(),
        Key::ControlRight => "ctrl_r".into(),
        Key::Delete       => "delete".into(),
        Key::DownArrow    => "down".into(),
        Key::End          => "end".into(),
        Key::Escape       => "escape".into(),
        Key::F1           => "f1".into(),
        Key::F2           => "f2".into(),
        Key::F3           => "f3".into(),
        Key::F4           => "f4".into(),
        Key::F5           => "f5".into(),
        Key::F6           => "f6".into(),
        Key::F7           => "f7".into(),
        Key::F8           => "f8".into(),
        Key::F9           => "f9".into(),
        Key::F10          => "f10".into(),
        Key::F11          => "f11".into(),
        Key::F12          => "f12".into(),
        Key::Home         => "home".into(),
        Key::LeftArrow    => "left".into(),
        Key::MetaLeft     => "meta".into(),
        Key::PageDown     => "pagedown".into(),
        Key::PageUp       => "pageup".into(),
        Key::Return       => "enter".into(),
        Key::RightArrow   => "right".into(),
        Key::ShiftLeft    => "shift".into(),
        Key::ShiftRight   => "shift_r".into(),
        Key::Space        => "space".into(),
        Key::Tab          => "tab".into(),
        Key::UpArrow      => "up".into(),
        Key::KeyA         => "a".into(),
        Key::KeyB         => "b".into(),
        Key::KeyC         => "c".into(),
        Key::KeyD         => "d".into(),
        Key::KeyE         => "e".into(),
        Key::KeyF         => "f".into(),
        Key::KeyG         => "g".into(),
        Key::KeyH         => "h".into(),
        Key::KeyI         => "i".into(),
        Key::KeyJ         => "j".into(),
        Key::KeyK         => "k".into(),
        Key::KeyL         => "l".into(),
        Key::KeyM         => "m".into(),
        Key::KeyN         => "n".into(),
        Key::KeyO         => "o".into(),
        Key::KeyP         => "p".into(),
        Key::KeyQ         => "q".into(),
        Key::KeyR         => "r".into(),
        Key::KeyS         => "s".into(),
        Key::KeyT         => "t".into(),
        Key::KeyU         => "u".into(),
        Key::KeyV         => "v".into(),
        Key::KeyW         => "w".into(),
        Key::KeyX         => "x".into(),
        Key::KeyY         => "y".into(),
        Key::KeyZ         => "z".into(),
        Key::Num0         => "0".into(),
        Key::Num1         => "1".into(),
        Key::Num2         => "2".into(),
        Key::Num3         => "3".into(),
        Key::Num4         => "4".into(),
        Key::Num5         => "5".into(),
        Key::Num6         => "6".into(),
        Key::Num7         => "7".into(),
        Key::Num8         => "8".into(),
        Key::Num9         => "9".into(),
        Key::Unknown(n)   => format!("unknown_{}", n),
        _                 => "unknown".into(),
    }
}