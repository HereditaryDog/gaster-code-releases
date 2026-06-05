#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_ROOT="$(cd "${DESKTOP_DIR}/.." && pwd)"

TARGET_TRIPLE="aarch64-apple-darwin"
CANONICAL_OUTPUT_DIR="${DESKTOP_DIR}/build-artifacts/macos-arm64"
ELECTRON_OUTPUT_DIR="${DESKTOP_DIR}/build-artifacts/electron"
APP_BUNDLE_NAME="Gaster Code.app"

usage() {
  cat <<'EOF'
Build Gaster Code desktop for macOS Apple Silicon with Electron Builder.

Usage:
  ./desktop/scripts/build-macos-arm64.sh [extra electron-builder args...]

Environment:
  SKIP_INSTALL=1   Skip `bun install` in the repo root and desktop app.
  SIGN_BUILD=1     Allow electron-builder to auto-discover signing identities.
  REBUILD_NATIVE=1 Run `electron-builder install-app-deps` before packaging.
  MAC_TARGETS      Electron Builder macOS targets. Defaults to "dmg zip".
  SKIP_PACKAGE_SMOKE=1
                   Skip package-smoke verification after copying artifacts.
  REQUIRE_MACOS_GATEKEEPER_SMOKE=1
                   Require Gatekeeper approval during post-build package-smoke.
  OPEN_OUTPUT=1    Open the canonical artifact output directory in Finder after a successful build.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "[build-macos-arm64] This script must run on macOS." >&2
  exit 1
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "[build-macos-arm64] This script is intended for Apple Silicon hosts (arm64)." >&2
  exit 1
fi

for command in bun codesign hdiutil; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "[build-macos-arm64] Missing required command: ${command}" >&2
    exit 1
  fi
done

APP_VERSION="$(
  cd "${DESKTOP_DIR}"
  bun -e 'const pkg = await Bun.file("package.json").json(); if (!pkg.version) throw new Error("desktop/package.json is missing version"); console.log(pkg.version)'
)"
LOCAL_DMG_NAME="Gaster Code-a ${APP_VERSION}.dmg"

read -r -a MAC_TARGET_ARRAY <<< "${MAC_TARGETS:-dmg zip}"
if [[ "${#MAC_TARGET_ARRAY[@]}" -eq 0 ]]; then
  echo "[build-macos-arm64] MAC_TARGETS must contain at least one electron-builder macOS target." >&2
  exit 1
fi

has_mac_target() {
  local target="$1"
  for candidate in "${MAC_TARGET_ARRAY[@]}"; do
    if [[ "${candidate}" == "${target}" ]]; then
      return 0
    fi
  done
  return 1
}

find_latest_file() {
  local search_dir="$1"
  local pattern="$2"
  if [[ -d "${search_dir}" ]]; then
    find "${search_dir}" -maxdepth 1 -type f -name "${pattern}" | sort | tail -n 1
  fi
}

copy_optional_blockmap() {
  local source_file="$1"
  local destination_file="$2"
  if [[ -f "${source_file}.blockmap" ]]; then
    cp -f "${source_file}.blockmap" "${destination_file}.blockmap"
  fi
}

if has_mac_target "dmg"; then
  STALE_DMG_MOUNTS="$(hdiutil info | grep -F "${ELECTRON_OUTPUT_DIR}/.temp" || true)"
  if [[ -n "${STALE_DMG_MOUNTS}" ]]; then
    echo "[build-macos-arm64] Found stale Electron Builder temporary DMG mounts in this worktree:" >&2
    echo "${STALE_DMG_MOUNTS}" >&2
    echo "[build-macos-arm64] Detach the stale disk image or restart DiskImages before building the dmg target." >&2
    echo "[build-macos-arm64] To verify the update zip path without DMG, rerun with MAC_TARGETS=zip." >&2
    exit 1
  fi
fi

if [[ "${SKIP_INSTALL:-0}" != "1" ]]; then
  echo "[build-macos-arm64] Installing root dependencies..."
  (cd "${REPO_ROOT}" && bun install)

  echo "[build-macos-arm64] Installing desktop dependencies..."
  (cd "${DESKTOP_DIR}" && bun install)
fi

echo "[build-macos-arm64] Cleaning stale Electron outputs..."
rm -rf "${DESKTOP_DIR}/dist"
rm -rf "${DESKTOP_DIR}/electron-dist"
rm -rf "${ELECTRON_OUTPUT_DIR}"
rm -rf "${CANONICAL_OUTPUT_DIR}"
rm -f "${DESKTOP_DIR}/tsconfig.tsbuildinfo"
rm -rf "${DESKTOP_DIR}/src-tauri/binaries/"*-sidecar-*

echo "[build-macos-arm64] Building sidecars for ${TARGET_TRIPLE}..."
(cd "${DESKTOP_DIR}" && SIDECAR_TARGET_TRIPLE="${TARGET_TRIPLE}" bun run build:sidecars)

echo "[build-macos-arm64] Building renderer and Electron main/preload bundles..."
(cd "${DESKTOP_DIR}" && bun run build && bun run build:electron)

if [[ "${REBUILD_NATIVE:-0}" == "1" ]]; then
  echo "[build-macos-arm64] Rebuilding native dependencies for Electron ABI..."
  (cd "${DESKTOP_DIR}" && bunx electron-builder install-app-deps)
  (cd "${DESKTOP_DIR}" && bun run prepare:node-pty)
fi

echo "[build-macos-arm64] Cleaning empty dmg-builder cache directories..."
(cd "${DESKTOP_DIR}" && bash ./scripts/clean-dmg-builder-cache.sh)

BUILDER_ARGS=(
  bunx
  electron-builder
  --mac
  "${MAC_TARGET_ARRAY[@]}"
  --arm64
  --publish
  never
)
if [[ "${SIGN_BUILD:-0}" != "1" ]]; then
  export CSC_IDENTITY_AUTO_DISCOVERY=false
  # package.json keeps notarization enabled for signed CI releases. Local
  # unsigned builds have no Developer ID credentials, so disable notarization.
  BUILDER_ARGS+=(-c.mac.notarize=false)
fi
if [[ "$#" -gt 0 ]]; then
  BUILDER_ARGS+=("$@")
fi

echo "[build-macos-arm64] Packaging Electron app..."
(cd "${DESKTOP_DIR}" && "${BUILDER_ARGS[@]}")

mkdir -p "${CANONICAL_OUTPUT_DIR}"
find "${CANONICAL_OUTPUT_DIR}" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

if [[ -d "${ELECTRON_OUTPUT_DIR}/mac-arm64/${APP_BUNDLE_NAME}" ]]; then
  cp -R "${ELECTRON_OUTPUT_DIR}/mac-arm64/${APP_BUNDLE_NAME}" "${CANONICAL_OUTPUT_DIR}/"
elif [[ -d "${ELECTRON_OUTPUT_DIR}/mac-arm64" ]]; then
  echo "[build-macos-arm64] Warning: ${APP_BUNDLE_NAME} was not found under ${ELECTRON_OUTPUT_DIR}/mac-arm64" >&2
fi

find "${ELECTRON_OUTPUT_DIR}" -maxdepth 1 -type f \( -name '*.dmg' -o -name '*.dmg.blockmap' -o -name '*.zip' -o -name '*.zip.blockmap' -o -name 'latest-mac.yml' \) -exec cp -f {} "${CANONICAL_OUTPUT_DIR}/" \;

LATEST_DMG="$(find_latest_file "${ELECTRON_OUTPUT_DIR}" '*.dmg')"
if [[ -n "${LATEST_DMG}" ]]; then
  cp -f "${LATEST_DMG}" "${CANONICAL_OUTPUT_DIR}/${LOCAL_DMG_NAME}"
  copy_optional_blockmap "${LATEST_DMG}" "${CANONICAL_OUTPUT_DIR}/${LOCAL_DMG_NAME}"
elif has_mac_target "dmg"; then
  echo "[build-macos-arm64] Warning: no DMG found under ${ELECTRON_OUTPUT_DIR}" >&2
fi

cat > "${CANONICAL_OUTPUT_DIR}/BUILD_INFO.txt" <<EOF
App version: ${APP_VERSION}
Target triple: ${TARGET_TRIPLE}
Builder output: ${ELECTRON_OUTPUT_DIR}
Canonical output: ${CANONICAL_OUTPUT_DIR}
Local DMG: ${LOCAL_DMG_NAME}
Built at: $(date '+%Y-%m-%d %H:%M:%S %z')
EOF

if [[ "${SKIP_PACKAGE_SMOKE:-0}" != "1" ]]; then
  PACKAGE_SMOKE_ARGS=(bun run test:package-smoke --platform macos --package-kind release --artifacts-dir desktop/build-artifacts/macos-arm64)
  if [[ "${REQUIRE_MACOS_GATEKEEPER_SMOKE:-0}" == "1" ]]; then
    PACKAGE_SMOKE_ARGS+=(--require-macos-gatekeeper)
  fi
  echo "[build-macos-arm64] Running package smoke..."
  (cd "${REPO_ROOT}" && "${PACKAGE_SMOKE_ARGS[@]}")
fi

echo
echo "[build-macos-arm64] Build finished."
echo "[build-macos-arm64] Canonical output: ${CANONICAL_OUTPUT_DIR}"
if [[ -f "${CANONICAL_OUTPUT_DIR}/${LOCAL_DMG_NAME}" ]]; then
  echo "[build-macos-arm64] Local DMG: ${CANONICAL_OUTPUT_DIR}/${LOCAL_DMG_NAME}"
else
  echo "[build-macos-arm64] Local DMG was not built; include dmg in MAC_TARGETS to create ${LOCAL_DMG_NAME}."
fi

if [[ "${OPEN_OUTPUT:-0}" == "1" ]]; then
  open "${CANONICAL_OUTPUT_DIR}"
fi
