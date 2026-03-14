use crate::ipc_client::{send_command, ClientError};
use macropad_ipc::{IpcCommand, IpcResponse};
use macropad_core::load;
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
        IpcResponse::Status { status, last_result } => {
            println!("[macropad] status: {}", status);
            match last_result {
                Some(true)  => println!("[macropad] last run: ok"),
                Some(false) => println!("[macropad] last run: failed"),
                None        => println!("[macropad] last run: none"),
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
) -> Result<(), ClientError> {
    if !path.exists() {
        eprintln!(
            "[macropad] error: file not found\n           resolved to: {}",
            path.display()
        );
        return Ok(());
    }

    println!("[macropad] playing: {}", path.display());

    match send_command(IpcCommand::Play {
        path,
        speed,
        dry_run: Some(dry_run),
    }).await? {
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

    match send_command(IpcCommand::Record { output_path: output }).await? {
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
    match send_command(IpcCommand::ListMacros).await? {
        IpcResponse::Macros { names } => {
            if names.is_empty() {
                println!("[macropad] no macros loaded");
            } else {
                println!("[macropad] loaded macros:");
                for name in names {
                    println!("  - {}", name);
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
                        entry.file_name()
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