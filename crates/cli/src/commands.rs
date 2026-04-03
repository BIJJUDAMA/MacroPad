use crate::ipc_client::{send_command, ClientError};
use macropad_core::load;
use macropad_ipc::{IpcCommand, IpcResponse};
use std::path::PathBuf;

pub async fn cmd_ping() -> Result<(), ClientError> {
    match send_command(IpcCommand::Ping).await? {
        IpcResponse::Pong => {
            println!("[macropad] daemon is running");
            Ok(())
        }
        other => {
            println!("[macropad] unexpected response: {:?}", other);
            Ok(())
        }
    }
}

pub async fn cmd_status() -> Result<(), ClientError> {
    match send_command(IpcCommand::Status).await? {
        IpcResponse::Status {
            status,
            last_result,
        } => {
            println!("[macropad] status: {}", status);
            match last_result {
                Some(true) => println!("[macropad] last run: ok"),
                Some(false) => println!("[macropad] last run: failed"),
                None => println!("[macropad] last run: none"),
            }
            Ok(())
        }
        IpcResponse::Error { message } => {
            eprintln!("[macropad] error: {}", message);
            Ok(())
        }
        other => {
            println!("[macropad] unexpected: {:?}", other);
            Ok(())
        }
    }
}

pub async fn cmd_play(
    path: PathBuf,
    speed: Option<f64>,
    dry_run: bool,
    var: Vec<(String, String)>,
) -> Result<(), ClientError> {
    if !path.exists() {
        eprintln!(
            "[macropad] error: file not found\n           resolved to: {}",
            path.display()
        );
        return Ok(());
    }

    println!("[macropad] playing: {}", path.display());

    let vars: std::collections::HashMap<String, String> = var.into_iter().collect();

    match send_command(IpcCommand::Play {
        path,
        speed,
        dry_run: Some(dry_run),
        vars: Some(vars),
        overrides: None, // We can add flag support for specific overrides later if needed
    })
    .await?
    {
        IpcResponse::Ok => {
            println!("[macropad] playback started");
            Ok(())
        }
        IpcResponse::Error { message } => {
            eprintln!("[macropad] error: {}", message);
            Ok(())
        }
        other => {
            println!("[macropad] unexpected: {:?}", other);
            Ok(())
        }
    }
}

pub async fn cmd_record(output: PathBuf) -> Result<(), ClientError> {
    println!("[macropad] recording — press Ctrl+C to stop");
    println!("[macropad] output: {}", output.display());

    match send_command(IpcCommand::Record {
        output_path: output,
        options: None,
    })
    .await?
    {
        IpcResponse::Ok => {
            println!("[macropad] recording started");
            Ok(())
        }
        IpcResponse::Error { message } => {
            eprintln!("[macropad] error: {}", message);
            Ok(())
        }
        other => {
            println!("[macropad] unexpected: {:?}", other);
            Ok(())
        }
    }
}

pub async fn cmd_stop_record() -> Result<(), ClientError> {
    match send_command(IpcCommand::StopRecord).await? {
        IpcResponse::Ok => {
            println!("[macropad] recording stopped and saved");
            Ok(())
        }
        IpcResponse::Error { message } => {
            eprintln!("[macropad] error: {}", message);
            Ok(())
        }
        other => {
            println!("[macropad] unexpected: {:?}", other);
            Ok(())
        }
    }
}

pub async fn cmd_stop_playback() -> Result<(), ClientError> {
    match send_command(IpcCommand::StopPlayback).await? {
        IpcResponse::Ok => {
            println!("[macropad] playback stopped");
            Ok(())
        }
        IpcResponse::Error { message } => {
            eprintln!("[macropad] error: {}", message);
            Ok(())
        }
        other => {
            println!("[macropad] unexpected: {:?}", other);
            Ok(())
        }
    }
}

pub async fn cmd_list() -> Result<(), ClientError> {
    match send_command(IpcCommand::ListMacros {
        mpr_paths: vec![],
        mps_paths: vec![],
    })
    .await?
    {
        IpcResponse::Macros { items } => {
            if items.is_empty() {
                println!("[macropad] no macros loaded");
            } else {
                println!("[macropad] loaded macros:");
                for item in items {
                    println!(
                        "  - {} ({})",
                        item.path.display(),
                        item.meta.name
                    );
                }
            }
            Ok(())
        }
        IpcResponse::Error { message } => {
            eprintln!("[macropad] error: {}", message);
            Ok(())
        }
        other => {
            println!("[macropad] unexpected: {:?}", other);
            Ok(())
        }
    }
}

pub async fn cmd_info(path: PathBuf) -> Result<(), ClientError> {
    if !path.exists() {
        eprintln!(
            "[macropad] error: file not found\n           resolved to: {}",
            path.display()
        );
        return Ok(());
    }

    match load(&path) {
        Ok(rec) => {
            println!("[macropad] name:    {}", rec.meta.name);
            println!("[macropad] version: {}", rec.meta.version);
            println!("[macropad] created: {}", rec.meta.created);
            println!("[macropad] tags:    {}", rec.meta.tags.join(", "));
            println!("[macropad] events:  {}", rec.events.len());
            println!("[macropad] speed:   {}x", rec.playback.speed);
            println!("[macropad] loops:   {}", rec.playback.loop_count);
            if let Some(w) = &rec.playback.wait_for_window {
                println!("[macropad] wait for window: {}", w);
            }
        }
        Err(e) => {
            eprintln!("[macropad] failed to read file: {}", e);
        }
    }

    Ok(())
}

pub async fn cmd_history(path: PathBuf) -> Result<(), ClientError> {
    match macropad_core::list_history(&path) {
        Ok(entries) => {
            if entries.is_empty() {
                println!("[macropad] no history found for {}", path.display());
            } else {
                println!("[macropad] history for {}:", path.display());
                for entry in entries {
                    println!(
                        "  {}",
                        entry
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("unknown")
                    );
                }
            }
            Ok(())
        }
        Err(e) => {
            eprintln!("[macropad] error reading history: {}", e);
            Ok(())
        }
    }
}

pub async fn cmd_run(
    path: PathBuf,
    dry_run: bool,
    var: Vec<(String, String)>,
) -> Result<(), ClientError> {
    if !path.exists() {
        eprintln!(
            "[macropad] error: file not found\n           resolved to: {}",
            path.display()
        );
        return Ok(());
    }

    if !path.to_string_lossy().ends_with(".mps") {
        eprintln!("[macropad] warning: file does not have .mps extension");
    }

    println!("[macropad] running script: {}", path.display());
    if dry_run {
        println!("[macropad] (dry-run mode)");
    }

    let vars = if var.is_empty() {
        None
    } else {
        let map: std::collections::HashMap<String, String> = var.into_iter().collect();
        println!("[macropad] injecting {} variable(s)", map.len());
        Some(map)
    };

    match script::run_script(&path, dry_run, vars).await {
        Ok(()) => {
            println!("[macropad] script completed successfully");
            Ok(())
        }
        Err(e) => {
            eprintln!("[macropad] script error: {}", e);
            Ok(())
        }
    }
}
