# Changelog

## 1.0.4 - 2026-05-24

- Improved long conversation switching with measured transcript virtualization, markdown cache reuse, memoized chat blocks, and cache cleanup when tabs close.
- Fixed streaming tool-call and Ask User Question state handling during desktop reconnects.
- Broadcast session stream updates to multiple connected desktop clients while preserving existing Gaster/G-Master session behavior.
- Added H5 LAN diagnostics, stale-host detection, and session branching support.
- Stabilized Computer Use dependency setup with Python version checks, Pillow compatibility pinning, and pip mirror fallback.
- Improved workspace/code rendering reliability, registered filesystem roots, project context display, Telegram adapter streaming output, and markdown table formatting.
- Added configurable AI request timeout and manual proxy settings.
- Aligned root, desktop, Tauri, Rust, lockfile, and About page versions to `1.0.4`.

## 1.0.3 - 2026-05-24

- Aligned release metadata, package metadata, lockfiles, desktop About version, docs, and release notes to `1.0.3`.
- Kept the 1.0.1 Drawing complex-prompt timeout fix and the 1.0.2 long conversation switching improvements.

## 1.0.2 - 2026-05-22

- Improved desktop conversation switching for long transcripts by showing the page first and loading transcript content progressively.

## 1.0.1 - 2026-05-22

- Fixed Drawing complex-prompt async image generation timeout handling.

## 1.0.0 - 2026-05-21

- Published the first public open-source Gaster Code release line with source, docs, release notes, updater metadata, and desktop package metadata aligned.
