mod commands;
mod ipc_client;

use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(
    name = "macropad",
    about = "macropad — keyboard and mouse macro tool",
    version = "0.1.0"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Check if the daemon is running
    Ping,

    /// Show daemon status and last run result
    Status,

    /// Play a .mpr file
    Play {
        /// Path to the .mpr file
        path: PathBuf,

        /// Playback speed multiplier (default 1.0)
        #[arg(short, long)]
        speed: Option<f64>,

        /// Print steps without executing
        #[arg(long)]
        dry_run: bool,

        /// Inject runtime variables as key=value pairs
        #[arg(short, long, value_parser = parse_var)]
        var: Vec<(String, String)>,
    },

    /// Start recording to a .mpr file
    Record {
        /// Output path for the recording
        output: PathBuf,
    },

    /// Stop an active recording
    StopRecord,

    /// Stop active playback
    Stop,

    /// List all loaded macros
    List,

    /// Show info about a .mpr file
    Info {
        /// Path to the .mpr file
        path: PathBuf,
    },

    /// Show version history of a .mpr file
    History {
        /// Path to the .mpr file
        path: PathBuf,
    },

    /// Run a .mps file
    Run {
        /// Path to the .mps file
        path: PathBuf,

        /// Print steps without executing
        #[arg(long)]
        dry_run: bool,

        /// Inject runtime variables as key=value pairs
        #[arg(short, long, value_parser = parse_var)]
        var: Vec<(String, String)>,
    },
}

fn parse_var(s: &str) -> Result<(String, String), String> {
    let (k, v) = s
        .split_once('=')
        .ok_or_else(|| format!("expected KEY=VALUE, got: {}", s))?;
    Ok((k.to_string(), v.to_string()))
}

#[tokio::main]
async fn main() {
    let cli = Cli::parse();

    let result = match cli.command {
        Command::Ping => commands::cmd_ping().await,
        Command::Status => commands::cmd_status().await,
        Command::Play {
            path,
            speed,
            dry_run,
            var,
        } => commands::cmd_play(path, speed, dry_run, var).await,
        Command::Record { output } => commands::cmd_record(output).await,
        Command::StopRecord => commands::cmd_stop_record().await,
        Command::Stop => commands::cmd_stop_playback().await,
        Command::List => commands::cmd_list().await,
        Command::Info { path } => commands::cmd_info(path).await,
        Command::History { path } => commands::cmd_history(path).await,
        Command::Run { path, dry_run, var } => commands::cmd_run(path, dry_run, var).await,
    };

    if let Err(e) = result {
        eprintln!("[macropad] fatal: {}", e);
        std::process::exit(1);
    }
}
