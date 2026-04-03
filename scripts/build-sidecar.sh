#!/bin/bash
# scripts/build-sidecar.sh
TRIPLE=$(rustc -vV | grep "host:" | cut -d":" -f2 | xargs)
echo "Building daemon for sidecar: $TRIPLE"

cargo build -p daemon --release

# Determine executable suffix
if [[ "$TRIPLE" == *"windows"* ]]; then
    EXT=".exe"
else
    EXT=""
fi

SRC="target/release/daemon$EXT"
DEST="gui/src-tauri/daemon-$TRIPLE$EXT"

if [ -f "$SRC" ]; then
    mkdir -p "gui/src-tauri"
    cp "$SRC" "$DEST"
    echo "Sidecar ready at $DEST"
else
    echo "Error: Failed to find built daemon at $SRC"
    exit 1
fi
