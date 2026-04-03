# scripts/build-sidecar.ps1
$TargetTriple = rustc -vV | Select-String "host:" | ForEach-Object { $_.ToString().Split(":")[1].Trim() }
Write-Host "Building daemon for sidecar: $TargetTriple"

cargo build -p daemon --release

$Src = "target/release/daemon.exe"
$Dest = "gui/src-tauri/daemon-$TargetTriple.exe"

if (Test-Path $Src) {
    if (-not (Test-Path "gui/src-tauri")) {
        New-Item -ItemType Directory -Path "gui/src-tauri" -Force
    }
    Copy-Item -Path $Src -Destination $Dest -Force
    Write-Host "Sidecar ready at $Dest"
} else {
    Write-Error "Failed to find built daemon at $Src"
    exit 1
}
