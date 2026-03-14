mod ipc;
mod scheduler;
mod state;

use ipc::start_ipc_server;
use scheduler::Scheduler;
use state::new_shared_state;

#[tokio::main]
async fn main() {
    println!("[macropad-daemon] starting...");

    let state = new_shared_state();

    // start scheduler
    let scheduler = Scheduler::new(state.clone());
    scheduler.run().await;

    println!("[macropad-daemon] scheduler started");

    // start IPC server — blocks here accepting connections
    println!("[macropad-daemon] ready");
    if let Err(e) = start_ipc_server(state).await {
        eprintln!("[macropad-daemon] ipc error: {}", e);
        std::process::exit(1);
    }
}