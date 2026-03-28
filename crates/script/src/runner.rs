use crate::ast::*;
use crate::variables::Scope;
use macropad_ipc::{IpcCommand, IpcResponse, PlaybackOverrides};
use macropad_ipc::client::{send_command, ClientError};
use platform::screenshot::{PixelChecker, Rgba};
use platform::window::{wait_for_window, WindowQuery};
use std::path::{Path, PathBuf};
use std::time::Duration;
use thiserror::Error;
use tokio::time::sleep;

#[derive(Debug, Error)]
pub enum RunnerError {
    #[error("macro file not found: {path}")]
    MacroNotFound { line: usize, path: String },
    #[error("ipc error: {0}")]
    Ipc(String),
    #[error("platform error: {0}")]
    Platform(String),
    #[error("loop_while exceeded max iterations ({0})")]
    LoopCapHit(u32),
    #[error("script error: {0}")]
    Generic(String),
}

impl From<ClientError> for RunnerError {
    fn from(e: ClientError) -> Self {
        RunnerError::Ipc(e.to_string())
    }
}

pub struct Runner {
    pub script_dir: PathBuf,
    pub dry_run:    bool,
    pub loop_cap:   u32,
}

impl Runner {
    pub fn new(script_path: &Path, dry_run: bool) -> Self {
        Self {
            script_dir: script_path
                .parent()
                .unwrap_or(Path::new("."))
                .to_path_buf(),
            dry_run,
            loop_cap: 1000,
        }
    }

    pub async fn run(
        &self,
        script: &Script,
        scope: &mut Scope,
    ) -> Result<(), RunnerError> {
        for stmt in &script.statements {
            self.exec(stmt, scope).await?;
        }
        Ok(())
    }

    fn exec<'a>(
        &'a self,
        stmt: &'a Statement,
        scope: &'a mut Scope,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), RunnerError>> + Send + 'a>>
    {
        Box::pin(async move {
            match stmt {
                Statement::Let { name, value } => {
                    let resolved = scope.resolve_expr(value);
                    scope.set(name, &resolved);
                }

                Statement::Delay { ms } => {
                    if self.dry_run {
                        println!("[dry-run] delay {}ms", ms);
                    } else {
                        sleep(Duration::from_millis(*ms)).await;
                    }
                }

                Statement::Run { path, args, is_async } => {
                    let resolved   = scope.resolve_expr(path);
                    let macro_path = self.resolve_path(&resolved);

                    if !macro_path.exists() {
                        return Err(RunnerError::MacroNotFound {
                            line: 0,
                            path: macro_path.display().to_string(),
                        });
                    }

                    // Collect RunArgs into overrides and vars
                    let mut overrides = PlaybackOverrides::default();
                    let mut vars = std::collections::HashMap::<String, String>::new();

                    for arg in args {
                        let val = scope.resolve_expr(&arg.value);
                        match arg.key.as_str() {
                            "speed"            => overrides.speed = val.parse().ok(),
                            "loop_count"       => overrides.loop_count = val.parse().ok(),
                            "skip_mouse_move"  => overrides.skip_mouse_move = val.parse().ok(),
                            "scale_to_current" => overrides.scale_to_current = val.parse().ok(),
                            "wait_for_window"  => overrides.wait_for_window = Some(val),
                            "wait_timeout_ms"  => overrides.wait_timeout_ms = val.parse().ok(),
                            // Anything else is treated as a runtime variable injection
                            other => { vars.insert(other.to_string(), val); }
                        }
                    }

                    if self.dry_run {
                        println!("[dry-run] run {:?} (overrides: {:?}, vars: {:?})", macro_path, overrides, vars);
                        scope.set_last_result(true);
                        return Ok(());
                    }

                    let cmd = IpcCommand::Play {
                        path:      macro_path,
                        speed:     overrides.speed,
                        dry_run:   Some(false),
                        vars:      if vars.is_empty() { None } else { Some(vars) },
                        overrides: Some(overrides),
                    };

                    if *is_async {
                        // Fire and forget — don't wait for completion
                        tokio::spawn(async move {
                            let _ = send_command(cmd).await;
                        });
                        scope.set_last_result(true);
                    } else {
                        let result = send_command(cmd).await;
                        match result {
                            Ok(IpcResponse::Ok) => scope.set_last_result(true),
                            Ok(IpcResponse::Error { message }) => {
                                eprintln!("[script] run error: {}", message);
                                scope.set_last_result(false);
                            }
                            Ok(_)   => scope.set_last_result(true),
                            Err(e)  => {
                                eprintln!("[script] ipc error: {}", e);
                                scope.set_last_result(false);
                            }
                        }
                    }
                }

                Statement::If {
                    condition,
                    body,
                    elif_branches,
                    else_body,
                } => {
                    if self.eval_condition(condition, scope).await? {
                        self.exec_block(body, scope).await?;
                    } else {
                        let mut matched = false;
                        for branch in elif_branches {
                            if self.eval_condition(&branch.condition, scope).await? {
                                self.exec_block(&branch.body, scope).await?;
                                matched = true;
                                break;
                            }
                        }
                        if !matched {
                            if let Some(else_stmts) = else_body {
                                self.exec_block(else_stmts, scope).await?;
                            }
                        }
                    }
                }

                Statement::Loop { count, body } => {
                    for _ in 0..*count {
                        self.exec_block(body, scope).await?;
                    }
                }

                Statement::LoopWhile {
                    condition,
                    body,
                    max_iter,
                } => {
                    let cap       = max_iter.unwrap_or(self.loop_cap);
                    let mut count = 0u32;

                    while self.eval_condition(condition, scope).await? {
                        if count >= cap {
                            return Err(RunnerError::LoopCapHit(cap));
                        }
                        self.exec_block(body, scope).await?;
                        count += 1;
                    }
                }

                Statement::WaitFor {
                    condition,
                    timeout_ms,
                } => {
                    if let Condition::Window { title, use_regex } = condition {
                        let resolved = scope.resolve_expr(title);
                        let query    = WindowQuery::new(&resolved).timeout(*timeout_ms);
                        let query    = if *use_regex { query.regex() } else { query };
                        wait_for_window(query)
                            .await
                            .map_err(|e| RunnerError::Platform(e.to_string()))?;
                    } else {
                        let start   = std::time::Instant::now();
                        let timeout = Duration::from_millis(*timeout_ms);
                        loop {
                            if start.elapsed() >= timeout {
                                return Err(RunnerError::Generic(
                                    "wait_for condition timed out".into(),
                                ));
                            }
                            if self.eval_condition(condition, scope).await? {
                                break;
                            }
                            sleep(Duration::from_millis(500)).await;
                        }
                    }
                }
            }

            Ok(())
        })
    }

    fn exec_block<'a>(
        &'a self,
        stmts: &'a [Statement],
        scope: &'a mut Scope,
    ) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<(), RunnerError>> + Send + 'a>>
    {
        Box::pin(async move {
            for stmt in stmts {
                self.exec(stmt, scope).await?;
            }
            Ok(())
        })
    }

    async fn eval_condition(
        &self,
        condition: &Condition,
        scope: &mut Scope,
    ) -> Result<bool, RunnerError> {
        match condition {
            Condition::True    => Ok(true),
            Condition::False   => Ok(false),

            Condition::MacroOk => {
                Ok(scope.get("last_result") == Some("ok"))
            }

            Condition::MacroFail => {
                Ok(scope.get("last_result") == Some("fail"))
            }

            Condition::Window { title, use_regex } => {
                let resolved = scope.resolve_expr(title);
                let query    = WindowQuery::new(&resolved).timeout(100);
                let query    = if *use_regex { query.regex() } else { query };
                Ok(wait_for_window(query).await.is_ok())
            }

            Condition::Pixel { x, y, hex, tolerance } => {
                let expected = Rgba::from_hex(hex).ok_or_else(|| {
                    RunnerError::Generic(format!("invalid hex color: {}", hex))
                })?;
                PixelChecker::check_pixel(*x, *y, &expected, *tolerance)
                    .map_err(|e| RunnerError::Platform(e.to_string()))
            }
        }
    }

    fn resolve_path(&self, raw: &str) -> PathBuf {
        let p = Path::new(raw);
        if p.is_absolute() {
            return p.to_path_buf();
        }
        if raw.starts_with("~/") || raw.starts_with("~\\") {
            let home = std::env::var("USERPROFILE")
                .or_else(|_| std::env::var("HOME"))
                .unwrap_or_else(|_| ".".into());
            return PathBuf::from(home).join(&raw[2..]);
        }
        self.script_dir.join(p)
    }
}