use crate::models::{Event, EventType, MouseButton, RecordingOptions};
use rdev::{listen, EventType as RdevEventType, Key};
use std::thread;
use std::time::{Instant};
use thiserror::Error;
use tokio::sync::mpsc as tokio_mpsc;
use tracing::error;

#[derive(Debug, Error)]
pub enum RecorderError {
    #[error("failed to start rdev listener: {0}")]
    ListenFailed(String),
    #[error("recorder channel closed")]
    ChannelClosed,
}

pub struct Recorder {
    pub rx: tokio_mpsc::Receiver<Event>,
}

impl Recorder {
    pub fn start() -> Result<Self, RecorderError> {
        Self::start_with_options(RecordingOptions::default())
    }

    pub fn start_with_options(opts: RecordingOptions) -> Result<Self, RecorderError> {
        let (event_tx, event_rx) = tokio_mpsc::channel::<Event>(4096);

        thread::spawn(move || {
            let start           = Instant::now();
            let mut last_x      = 0f64;
            let mut last_y      = 0f64;
            let mut last_move_t = 0u64;

            let callback = {
                let event_tx = event_tx.clone();
                move |rdev_event: rdev::Event| {
                    let time_ms = start.elapsed().as_millis() as u64;

                    match &rdev_event.event_type {
                        RdevEventType::MouseMove { x, y } => {
                            if !opts.record_mouse_move {
                                return;
                            }
                            let dx   = x - last_x;
                            let dy   = y - last_y;
                            let dist = (dx * dx + dy * dy).sqrt();
                            let dt   = time_ms.saturating_sub(last_move_t);

                            if dist < opts.min_move_distance_px
                                || dt < opts.min_move_interval_ms
                            {
                                return;
                            }

                            last_x      = *x;
                            last_y      = *y;
                            last_move_t = time_ms;
                        }
                        RdevEventType::ButtonPress(_) | RdevEventType::ButtonRelease(_) => {
                            if !opts.record_clicks {
                                return;
                            }
                        }
                        RdevEventType::Wheel { .. } => {
                            if !opts.record_scroll {
                                return;
                            }
                        }
                        RdevEventType::KeyPress(_) | RdevEventType::KeyRelease(_) => {
                            if !opts.record_keyboard {
                                return;
                            }
                        }
                    }

                    if let Some(event) = convert_event(rdev_event, time_ms) {
                        let _ = event_tx.blocking_send(event);
                    }
                }
            };

            if let Err(e) = listen(callback) {
                error!("rdev listen error: {:?}", e);
            }
        });

        Ok(Self { rx: event_rx })
    }
}

pub fn consolidate_mouse_segments(events: &[Event]) -> Vec<Event> {
    let mut result:      Vec<Event>    = Vec::new();
    let mut move_buffer: Vec<[i32; 2]> = Vec::new();
    let mut seg_start_time = 0u64;
    let mut from_x         = 0i32;
    let mut from_y         = 0i32;

    for event in events {
        if event.event_type == EventType::MouseMove {
            let x = event.x.unwrap_or(0);
            let y = event.y.unwrap_or(0);

            if move_buffer.is_empty() {
                seg_start_time = event.time_ms;
                from_x         = x;
                from_y         = y;
            }

            move_buffer.push([x, y]);
        } else {
            if !move_buffer.is_empty() {
                let last  = move_buffer.last().copied().unwrap_or([from_x, from_y]);
                let to_x  = last[0];
                let to_y  = last[1];
                let dur   = event.time_ms.saturating_sub(seg_start_time);

                let waypoints = if move_buffer.len() > 2 {
                    Some(move_buffer.clone())
                } else {
                    None
                };

                result.push(Event {
                    event_type:  EventType::MouseSegment,
                    time_ms:     seg_start_time,
                    x:           Some(from_x),
                    y:           Some(from_y),
                    delta_x:     Some(to_x as i64),
                    delta_y:     Some(to_y as i64),
                    duration_ms: Some(dur),
                    waypoints,
                    key:         None,
                    button:      None,
                    value:       None,
                });

                move_buffer.clear();
            }

            result.push(event.clone());
        }
    }

    if !move_buffer.is_empty() {
        let last = move_buffer.last().copied().unwrap_or([from_x, from_y]);
        result.push(Event {
            event_type:  EventType::MouseSegment,
            time_ms:     seg_start_time,
            x:           Some(from_x),
            y:           Some(from_y),
            delta_x:     Some(last[0] as i64),
            delta_y:     Some(last[1] as i64),
            duration_ms: Some(0),
            waypoints:   if move_buffer.len() > 2 { Some(move_buffer) } else { None },
            key:         None,
            button:      None,
            value:       None,
        });
    }

    result
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
            waypoints:   None,
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
            waypoints:   None,
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
            waypoints:   None,
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
            waypoints:   None,
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
            waypoints:   None,
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
            waypoints:   None,
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