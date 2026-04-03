use std::env;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::thread;
use std::time::Duration;

fn main() {
    let args: Vec<String> = env::args().collect();

    // expected args:
    // launcher.exe <new_binary> <target_binary> <relaunch_binary>
    if args.len() < 4 {
        eprintln!("[launcher] usage: launcher <new> <target> <relaunch>");
        std::process::exit(1);
    }

    let new_binary = PathBuf::from(&args[1]);
    let target_binary = PathBuf::from(&args[2]);
    let relaunch = PathBuf::from(&args[3]);

    // wait for the main process to release the file lock
    println!("[launcher] waiting for process to exit...");
    thread::sleep(Duration::from_millis(500));

    // retry the swap up to 10 times in case the lock takes a moment to release
    let mut attempts = 0;
    loop {
        match fs::copy(&new_binary, &target_binary) {
            Ok(_) => {
                println!("[launcher] swap successful");
                break;
            }
            Err(e) => {
                attempts += 1;
                if attempts >= 10 {
                    eprintln!("[launcher] swap failed after 10 attempts: {}", e);
                    std::process::exit(1);
                }
                eprintln!(
                    "[launcher] swap attempt {} failed: {} — retrying",
                    attempts, e
                );
                thread::sleep(Duration::from_millis(500));
            }
        }
    }

    // clean up the temp new binary
    let _ = fs::remove_file(&new_binary);

    // relaunch the updated binary
    println!("[launcher] relaunching: {}", relaunch.display());
    match Command::new(&relaunch).spawn() {
        Ok(_) => println!("[launcher] relaunch ok"),
        Err(e) => eprintln!("[launcher] relaunch failed: {}", e),
    }
}
