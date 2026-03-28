use crate::state::SharedState;
use chrono::{Local, Timelike};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::time::{sleep, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledTask {
    pub id:          String,
    pub macro_path:  PathBuf,
    pub schedule:    Schedule,
    pub enabled:     bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Schedule {
    Once {
        at_hour:   u32,
        at_minute: u32,
    },
    Interval {
        every_secs: u64,
    },
    Daily {
        at_hour:   u32,
        at_minute: u32,
    },
}

pub struct Scheduler {
    tasks:  Arc<Mutex<HashMap<String, ScheduledTask>>>,
    state:  SharedState,
}

impl Scheduler {
    pub fn new(state: SharedState) -> Self {
        Self {
            tasks: Arc::new(Mutex::new(HashMap::new())),
            state,
        }
    }

    pub fn add_task(&self, task: ScheduledTask) {
        let mut tasks = self.tasks.lock().unwrap();
        tasks.insert(task.id.clone(), task);
    }

    pub fn remove_task(&self, id: &str) -> bool {
        let mut tasks = self.tasks.lock().unwrap();
        tasks.remove(id).is_some()
    }

    pub fn list_tasks(&self) -> Vec<ScheduledTask> {
        let tasks = self.tasks.lock().unwrap();
        tasks.values().cloned().collect()
    }

    pub async fn run(self) {
        let tasks = Arc::clone(&self.tasks);
        let state = Arc::clone(&self.state);

        tokio::spawn(async move {
            loop {
                let now = Local::now();
                let current_hour   = now.hour();
                let current_minute = now.minute();
                let current_secs   = now.timestamp() as u64;

                let task_list: Vec<ScheduledTask> = {
                    let locked = tasks.lock().unwrap();
                    locked.values().cloned().collect()
                };

                for task in task_list {
                    if !task.enabled {
                        continue;
                    }

                    let should_run = match &task.schedule {
                        Schedule::Once { at_hour, at_minute } => {
                            current_hour   == *at_hour
                            && current_minute == *at_minute
                            && now.second() == 0
                        }
                        Schedule::Daily { at_hour, at_minute } => {
                            current_hour   == *at_hour
                            && current_minute == *at_minute
                            && now.second() == 0
                        }
                        Schedule::Interval { every_secs } => {
                            current_secs % every_secs == 0
                        }
                    };

                    if should_run {
                        let path = task.macro_path.clone();
                        let state_clone = Arc::clone(&state);

                        tokio::spawn(async move {
                            run_macro_task(path, state_clone).await;
                        });
                    }
                }

                sleep(Duration::from_secs(1)).await;
            }
        });
    }
}

async fn run_macro_task(path: PathBuf, state: SharedState) {
    let rec = match macropad_core::load(&path) {
        Ok(r)  => r,
        Err(e) => {
            eprintln!("[scheduler] failed to load {:?}: {}", path, e);
            return;
        }
    };

    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    {
        let mut s = state.lock().unwrap();
        if s.is_busy() {
            eprintln!("[scheduler] skipping '{}' — daemon is busy", name);
            return;
        }
        s.set_playing(&name);
    }

    let (_player, abort_rx) = macropad_core::Player::new();
    let result = macropad_core::play(&rec, None, false, abort_rx, None).await;

    {
        let mut s = state.lock().unwrap();
        s.last_result = Some(result.is_ok());
        s.set_idle();
    }

    if let Err(e) = result {
        eprintln!("[scheduler] playback error for '{}': {}", name, e);
    }
}