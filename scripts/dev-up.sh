#!/usr/bin/env bash
# Quick "what should I do?" entry point for fresh contributors.
set -euo pipefail

echo "Clippy dev quick-start"
echo "======================"
echo ""
echo "Choose a subsystem to bring up:"
echo ""
echo "  1) Desktop app  (Tauri + Svelte)        cd desktop && cargo tauri dev"
echo "  2) GNOME ext    (GJS, install + reload) cd extension && npm run install-and-reload"
echo "  3) Android app  (Flutter)               cd mobile && flutter run"
echo ""
echo "Tests:"
echo "  cd desktop && cargo test"
echo "  cd extension && npm test"
echo "  cd mobile && flutter test"
echo ""
echo "Full release builds:"
echo "  cd desktop && cargo tauri build      → .deb in src-tauri/target/release/bundle/"
echo "  cd extension && npm run package      → ZIP for gnome-extensions install"
echo "  cd mobile && flutter build apk --release"
