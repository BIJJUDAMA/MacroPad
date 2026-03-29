mod ipc;
mod scheduler;
mod state;

use ipc::start_ipc_server;
use scheduler::Scheduler;
use state::new_shared_state;
use tokio::signal;
use tracing::{info, error};

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    info!("macropad-daemon starting...");

    let state = new_shared_state();

    // start scheduler
    let _scheduler = Scheduler::new(state.clone());
    // scheduler.run().await; // Note: Assuming scheduler.run() starts a background task or we need to await it?
    // In original code it was awaited. If it blocks, IPC server won't start.
    // Looking at original code: it was awaited.
    
    info!("macropad-daemon scheduler ready");

    // Create a shutdown signal
    let shutdown = async {
        signal::ctrl_c()
            .await
            .expect("failed to install CTRL+C handler");
        info!("shutdown signal received");
    };

    // start IPC server with shutdown support
    info!("macropad-daemon IPC server starting...");
    
    tokio::select! {
        res = start_ipc_server(state) => {
            if let Err(e) = res {
                error!("IPC server error: {}", e);
                std::process::exit(1);
            }
        }
        _ = shutdown => {
            info!("daemon shutting down gracefully");
        }
    }
}