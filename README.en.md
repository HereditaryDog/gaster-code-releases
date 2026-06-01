# Gaster Code

<p align="center">
  <img src="docs/images/gaster-code-readme-logo.svg" alt="Gaster Code" width="220">
</p>

<div align="center">

[![GitHub Stars](https://img.shields.io/badge/stars-public%20repo-24292f?logo=github)](https://github.com/HereditaryDog/gaster-code-releases/stargazers)
[![GitHub Forks](https://img.shields.io/badge/forks-welcome-24292f?logo=github)](https://github.com/HereditaryDog/gaster-code-releases/network/members)
[![GitHub Issues](https://img.shields.io/badge/issues-public%20repo-blue?logo=github)](https://github.com/HereditaryDog/gaster-code-releases/issues)
[![GitHub Pull Requests](https://img.shields.io/badge/pull%20requests-welcome-brightgreen?logo=github)](https://github.com/HereditaryDog/gaster-code-releases/pulls)
[![License](https://img.shields.io/badge/license-research%20only-red)](LICENSE)
[![Current Version](https://img.shields.io/badge/version-V%201.0.9-blue)](release-notes/v1.0.9.md)
[![中文](https://img.shields.io/badge/中文-Available-green)](README.md)
[![English](https://img.shields.io/badge/English-Current-blue)](README.en.md)

</div>

Gaster Code is an AI coding assistant for local development workflows. It provides a CLI/TUI, a desktop app, multi-session workspaces, MCP integrations, task automation, and remote adapter capabilities for real software projects.

> Current stable version: **V 1.0.9**. This release fixes stale client-version reporting on the G-Master OAuth and admin pages, and makes GPT Image 2 async drawing job polling recover from transient interruptions and 524 timeouts.

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#desktop-development">Desktop Development</a> ·
  <a href="#packaging-and-release">Packaging and Release</a> ·
  <a href="#documentation">Documentation</a>
</p>

---

## Features

- CLI / TUI workflow for coding directly from the terminal
- Tauri 2 + React desktop app with multi-tab, multi-session, workspace file panel, and multi-workspace support
- Codex-style dark interface with blue brand accents
- G-Master API account center with desktop sign-up/sign-in, balance top-up, subscription management, and official provider sync
- GPT Image 2 drawing through G-Master API async image jobs, preserving complex prompts as entered
- Custom model providers, auth-variable strategy, model context windows, and endpoint mapping
- Plugins, Skills, and Agents can rescan user, project, and external install locations after refresh
- H5 mobile browser access over a trusted LAN or your own reverse proxy, with token and allowed-origin controls
- Batch session cleanup with explicit multi-select and one confirmation step
- `@` file and directory references backed by Git-aware search that respects ignore rules
- Resizable sidebar width with desktop typography and navigation hierarchy tuned for long development sessions
- Project Memory management for viewing, editing, and previewing project memory files
- Sidebar open-project controls for available IDEs and file managers
- Local token usage / activity stats for sessions, models, and tool calls
- Response language settings independent from the UI language
- MCP, plugins, and Skills extensions, including slash-command wrapped external Skills
- Multi-agent / Teams collaboration support, including refreshed visibility for user-installed Agents
- Scheduled tasks, desktop notifications, automation workflows, and task tracking
- Computer Use desktop control with a custom Python interpreter option
- Telegram, Feishu, WeChat, and DingTalk remote adapters
- Diagnostics export, recent errors, log directory access, and context usage display

---

## Quick Start

### 1. Install Bun

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# macOS (Homebrew)
brew install bun

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 2. Install Dependencies

```bash
bun install
```

If you plan to use the desktop app or adapters, install those dependencies too:

```bash
cd desktop && bun install
cd ../adapters && bun install
cd ..
```

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` as needed for model providers, auth, and local runtime settings.

### 4. Start The CLI

```bash
bun run start
```

Headless example:

```bash
bun run start -- -p "summarize this repository"
```

---

## Desktop Development

Desktop development needs the local API server and Vite frontend running together.

### Start The Local API Server

```bash
SERVER_PORT=3456 bun run src/server/index.ts
```

Windows PowerShell:

```powershell
$env:SERVER_PORT = "3456"
bun run src/server/index.ts
```

Health check:

```bash
curl http://127.0.0.1:3456/health
```

### Start The Desktop Frontend

```bash
cd desktop
bun run dev --host 127.0.0.1 --port 2024
```

Open:

```text
http://127.0.0.1:2024
```

---

## Packaging And Release

Current desktop version: `V 1.0.9`.

### Windows

Local script:

```powershell
cd desktop
powershell -ExecutionPolicy Bypass -File .\scripts\build-windows-x64.ps1
```

The repository also provides a GitHub Actions development build:

- Workflow: `.github/workflows/build-desktop-dev.yml`
- Windows artifact: MSI installer

### Public Installers

Public installers:

- GitHub Releases: https://github.com/HereditaryDog/gaster-code-releases/releases

| Platform | Installer |
|----------|-----------|
| macOS Apple Silicon | `Gaster-Code_1.0.9_macos_arm64_dmg.dmg` |
| macOS Intel | `Gaster-Code_1.0.9_macos_x64_dmg.dmg` |
| Windows x64 | `Gaster-Code_1.0.9_windows_x64_nsis.exe` |
| Linux x64 | `Gaster-Code_1.0.9_linux_x64_deb.deb` |

### macOS

Install steps:

1. Open the `.dmg` file and drag `Gaster Code.app` into `Applications`
2. On first launch, right-click `Gaster Code.app` in `Applications`, choose Open, then confirm Open once
3. If macOS says the app is damaged, run:

```bash
xattr -cr /Applications/Gaster\ Code.app
```

If it still does not open, run the administrator version once:

```bash
sudo xattr -cr /Applications/Gaster\ Code.app
```

> Current internal test packages are not notarized with Apple Developer ID yet. Right-click Open or removing quarantine allows the app to run.

Local Apple Silicon packaging script:

```bash
./desktop/scripts/build-macos-arm64.sh
```

This script must run on a macOS arm64 host.

### Official Release

Desktop releases run through:

```text
.github/workflows/release-desktop.yml
```

The workflow builds macOS ARM64, macOS x64, Windows x64, and Linux x64 desktop artifacts from version tags. The source repository stays private, while installers and `latest.json` are mirrored to the public `HereditaryDog/gaster-code-releases` release-only repository for the desktop updater. Linux ARM64 can be enabled from manual release workflow dispatch. See [release-notes/v1.0.9.md](release-notes/v1.0.9.md) for the current release notes.

---

## Documentation

- [Environment variables](docs/guide/env-vars.md)
- [FAQ](docs/guide/faq.md)
- [Global usage](docs/guide/global-usage.md)
- [Desktop docs](docs/desktop/)
- [Frontend development guidelines](docs/frontend-development-guidelines.md)
- [IM integration](docs/im/)
- [MCP and Skills](docs/skills/01-usage-guide.md)
- [Multi-agent / Teams](docs/agent/01-usage-guide.md)
- [Computer Use](docs/features/computer-use.md)
- [Project structure](docs/reference/project-structure.md)

## Repository Structure

- `src/`: CLI, TUI, server, tools, and core logic
- `desktop/`: desktop frontend and Tauri packaging project
- `adapters/`: remote adapters
- `docs/`: user docs and design notes
- `scripts/`: release and helper scripts

---

## Notes

This repository is maintained as a runnable, packageable, and extensible Gaster Code distribution. If you find remaining copy, packaging metadata, or workflow inconsistencies, please open an issue or submit a fix.
