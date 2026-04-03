use crate::state::SharedState;
use chrono::{Local, Timelike};
use script::run_script;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tokio::time::{sleep, Duration};
use tracing::{debug, error, info, warn};

use macropad_ipc::{Schedule, ScheduledTask};

#[derive(Debug, Default, Serialize, Deserialize)]
struct ScheduleStore {
    tasks: Vec<ScheduledTask>,
}

pub struct Scheduler {
    tasks: Arc<Mutex<HashMap<String, ScheduledTask>>>,
    state: SharedState,
    path: PathBuf,
}

impl Scheduler {
    pub fn new(state: SharedState, path: PathBuf) -> Self {
        let tasks = Arc::new(Mutex::new(HashMap::new()));
        let mut s = Self { tasks, state, path };
        if let Err(e) = s.load() {
            warn!("failed to load schedule: {}", e);
        }
        s
    }

    fn load(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        if !self.path.exists() {
            return Ok(());
        }
        let content = std::fs::read_to_string(&self.path)?;
        let store: ScheduleStore = toml::from_str(&content)?;
        let mut tasks = self.tasks.lock().unwrap();
        for task in store.tasks {
            tasks.insert(task.id.clone(), task);
        }
        info!("loaded {} scheduled tasks", tasks.len());
        Ok(())
    }

    pub fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let tasks = self.tasks.lock().unwrap();
        let store = ScheduleStore {
            tasks: tasks.values().cloned().collect(),
        };
        let content = toml::to_string_pretty(&store)?;
        if let Some(parent) = self.path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(&self.path, content)?;
        debug!("saved schedule to {:?}", self.path);
        Ok(())
    }

    pub fn add_task(&self, task: ScheduledTask) {
        {
            let mut tasks = self.tasks.lock().unwrap();
            tasks.insert(task.id.clone(), task);
        }
        let _ = self.save();
    }

    pub fn remove_task(&self, id: &str) -> bool {
        let removed = {
            let mut tasks = self.tasks.lock().unwrap();
            tasks.remove(id).is_some()
        };
        if removed {
            let _ = self.save();
        }
        removed
    }

    pub fn list_tasks(&self) -> Vec<ScheduledTask> {
        let tasks = self.tasks.lock().unwrap();
        tasks.values().cloned().collect()
    }

    pub async fn run(&self) {
        let tasks = Arc::clone(&self.tasks);
        let state = Arc::clone(&self.state);

        tokio::spawn(async move {
            info!("scheduler service started");
            loop {
                let now = Local::now();
                let current_hour = now.hour();
                let current_minute = now.minute();
                let current_secs = now.timestamp() as u64;

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
                            current_hour == *at_hour
                                && current_minute == *at_minute
                                && now.second() == 0
                        }
                        Schedule::Daily { at_hour, at_minute } => {
                            current_hour == *at_hour
                                && current_minute == *at_minute
                                && now.second() == 0
                        }
                        Schedule::Interval { every_secs } => {
                            current_secs.is_multiple_of(*every_secs)
                        }
                    };

                    if should_run {
                        let path = task.macro_path.clone();
                        let state_clone = Arc::clone(&state);

                        std::thread::spawn(move || {
                            let rt = tokio::runtime::Builder::new_current_thread()
                                .enable_all()
                                .build()
                                .expect("failed to build scheduler runtime");
                            rt.block_on(run_macro_task_background(path, state_clone));
                        });
                    }
                }

                sleep(Duration::from_secs(1)).await;
            }
        });
    }
}

async fn run_macro_task_background(path: PathBuf, state: SharedState) {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    {
        let mut s = state.lock().unwrap();
        if s.is_busy() {
            warn!("skipping scheduled '{}' — daemon is busy", name);
            return;
        }
        s.set_playing(&name);
    }

    info!("running scheduled task: {}", name);

    let is_script = path.extension().is_some_and(|e| e == "mps");

    let result = if is_script {
        run_script(&path, false, None)
            .await
            .map_err(|e| e.to_string())
    } else {
        match macropad_core::load(&path) {
            Ok(rec) => {
                let (_player, abort_rx) = macropad_core::Player::new();
                macropad_core::play(&rec, None, false, abort_rx, None).map_err(|e| e.to_string())
            }
            Err(e) => Err(e.to_string()),
        }
    };

    {
        let mut s = state.lock().unwrap();
        s.last_result = Some(result.is_ok());
        s.set_idle();
    }

    match result {
        Ok(_) => info!("scheduled task '{}' completed successfully", name),
        Err(e) => error!("scheduled task '{}' failed: {}", name, e),
    }
}
