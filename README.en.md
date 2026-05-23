# Gaster Code

<p align="center">
  <img src="docs/images/banner.svg" alt="Gaster Code" width="760">
</p>

<div align="center">

[![Latest Release](https://img.shields.io/github/v/release/HereditaryDog/gaster-code-releases?label=release&color=2563eb)](https://github.com/HereditaryDog/gaster-code-releases/releases/latest)
[![Downloads](https://img.shields.io/badge/download-macOS%20%7C%20Windows%20%7C%20Linux-22c55e)](https://github.com/HereditaryDog/gaster-code-releases/releases/latest)
[![License](https://img.shields.io/github/license/HereditaryDog/gaster-code-releases?color=111827)](LICENSE)
[![Issues](https://img.shields.io/github/issues/HereditaryDog/gaster-code-releases?color=f97316)](https://github.com/HereditaryDog/gaster-code-releases/issues)
[![Pull Requests](https://img.shields.io/github/issues-pr/HereditaryDog/gaster-code-releases?color=8b5cf6)](https://github.com/HereditaryDog/gaster-code-releases/pulls)
[![中文](https://img.shields.io/badge/README-中文-blue)](README.md)
[![English](https://img.shields.io/badge/README-English-green)](README.en.md)

</div>

<p align="center">
  <strong>A local AI coding assistant you can run, inspect, package, and extend.</strong><br>
  CLI / TUI, desktop app, multi-session workspaces, MCP, Skills, Agents, remote adapters, and task automation in one public project.
</p>

<p align="center">
  <a href="#download">Download</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#capabilities">Capabilities</a> ·
  <a href="#project-note">Project Note</a> ·
  <a href="#contributing">Contributing</a>
</p>

---

## Project Note

Gaster Code is now maintained as a public open-source project. The current source hotfix version is **v1.0.2** and includes the Drawing complex-prompt timeout fix plus long conversation switching performance improvements; the current downloadable installer release is still **v1.0.0** until the matching GitHub Actions release workflow succeeds.

**Source transparency note:** this project is based on community research and organization of leaked Claude Code source code, with product and development inspiration from the `cc-haha` project. Gaster Code is not an official Anthropic, Claude Code, or `cc-haha` project, and is not affiliated with those projects or organizations.

The repository is public so developers can inspect the code, reproduce the builds, submit fixes, and continue improving local AI coding workflows, model integrations, desktop usability, and automation capabilities.

## Download

Latest source version: **v1.0.2**
Current downloadable installer release: **v1.0.0**

- [GitHub Release](https://github.com/HereditaryDog/gaster-code-releases/releases/latest)
- [latest.json](https://github.com/HereditaryDog/gaster-code-releases/releases/latest/download/latest.json)

| Platform | Installer |
| --- | --- |
| macOS Apple Silicon | `Gaster-Code_1.0.0_macos_arm64_dmg.dmg` |
| macOS Intel | `Gaster-Code_1.0.0_macos_x64_dmg.dmg` |
| Windows x64 | `Gaster-Code_1.0.0_windows_x64_nsis.exe` |
| Linux x64 | `Gaster-Code_1.0.0_linux_x64_deb.deb` |

`v1.0.2` source, docs, and release notes will be pushed to `main` and the `v1.0.2` tag. Installer publication requires the release workflow to finish signing, packaging, and public asset synchronization.

If macOS blocks the first launch, run:

```bash
xattr -cr /Applications/Gaster\ Code.app
```

## Capabilities

| Area | What is included |
| --- | --- |
| Local coding | CLI / TUI, headless mode, tool execution, permission prompts, Git-aware file mentions |
| Desktop app | Tauri 2 + React, tabs, sessions, workspace file panel, batch session cleanup |
| Model access | G-Master API by default, plus OpenAI, DeepSeek, Ollama, and compatible providers |
| Extensions | MCP, plugins, Skills, Agents, slash commands, and installed capability scanning |
| Automation | Scheduled tasks, desktop notifications, task tracking, multi-agent / Teams workflows |
| Remote control | Telegram, Feishu, WeChat, and DingTalk adapters for remote chat and approval flows |
| Multi-device access | Trusted H5 mobile browser access with token and allowed-origin controls |
| Diagnostics | Diagnostic export, recent errors, log directory access, local token usage and activity stats |

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

If you plan to use the desktop app or remote adapters, install those dependencies too:

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

## Desktop Development

Desktop development needs the local API server and Vite frontend running together.

```bash
SERVER_PORT=3456 bun run src/server/index.ts
```

In another terminal:

```bash
cd desktop
bun run dev --host 127.0.0.1 --port 2024
```

Open:

```text
http://127.0.0.1:2024
```

## Repository Structure

```text
src/        CLI, TUI, local server, tools, and core logic
desktop/    Tauri desktop app, React frontend, native packaging config
adapters/   Telegram, Feishu, WeChat, DingTalk, and other remote adapters
docs/       User docs, architecture notes, and feature guides
scripts/    Release, quality-gate, and helper scripts
```

## Release And Updates

Desktop releases are built by `.github/workflows/release-desktop.yml` for macOS ARM64, macOS x64, Windows x64, and Linux x64. Installers are published to this repository's GitHub Releases, and `latest.json` powers the desktop updater. Generating updater metadata requires `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

Local Apple Silicon test packaging:

```bash
./desktop/scripts/build-macos-arm64.sh
```

Local test packages use `Gaster Code-a <version>.dmg`; official release assets are still built by GitHub Actions with the `Gaster-Code_<version>_<platform>_<arch>_<bundle>` naming format.

## Documentation

- [Quick Start](docs/guide/quick-start.md)
- [Environment variables](docs/guide/env-vars.md)
- [FAQ](docs/guide/faq.md)
- [Desktop docs](docs/desktop/)
- [IM integration](docs/im/)
- [MCP and Skills](docs/skills/01-usage-guide.md)
- [Multi-agent / Teams](docs/agent/)
- [Computer Use](docs/features/computer-use.md)
- [Project structure](docs/reference/project-structure.md)

## Contributing

Issues, pull requests, reproduction notes, platform compatibility reports, and documentation fixes are welcome. Good first areas include:

- Public repository docs and installation experience
- Desktop first launch, updates, diagnostics, and error recovery
- Model provider setup and configuration UX
- Skills, Agents, MCP, and remote adapter usability
- Scheduled tasks, Teams collaboration, and multi-workspace workflows

Before submitting changes, prefer running:

```bash
bun run check:brand
bun run quality:pr
```

---

Gaster Code is meant to be a runnable, packageable, and extensible local AI coding assistant, not just a showcase repository.
