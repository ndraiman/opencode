#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

echo "==> Building sidecar CLI..."
(cd packages/opencode && bun run build --single)

echo "==> Copying sidecar binary..."
mkdir -p packages/desktop/src-tauri/sidecars
cp packages/opencode/dist/opencode-darwin-arm64/bin/opencode \
   packages/desktop/src-tauri/sidecars/opencode-cli-aarch64-apple-darwin

echo "==> Building Tauri app..."
bun --cwd packages/desktop tauri build

echo "==> Installing to /Applications..."
cp -R "packages/desktop/src-tauri/target/release/bundle/macos/OpenCode Dev.app" "/Applications/OpenCode Dev.app"

echo "==> Done! Launch 'OpenCode Dev' from /Applications."
