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
  <strong>本地可运行的 AI 编码助手。</strong><br>
  CLI / TUI、桌面端、多会话工作区、MCP、Skills、Agents、远程适配器和自动化任务集中在一个公开项目里。
</p>

<p align="center">
  <a href="#下载">下载</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#能力概览">能力概览</a> ·
  <a href="#项目说明">项目说明</a> ·
  <a href="#参与开发">参与开发</a>
</p>

---

## 项目说明

Gaster Code 现在是一个公开维护的开源项目。当前源码和可下载安装包版本为 **v1.0.7**，已包含桌面渲染性能优化、G-Master API 账号中心与计费能力、release hygiene 文档修复、绘图复杂提示词超时修复、长对话切换性能优化、Markdown 渲染缓存和渐进加载、标签拖拽性能优化、H5 诊断增强、网络超时/代理设置和远程适配器输出稳定性改进。

**来源透明说明：** 本项目的代码基础来自 Claude Code 泄露源码的社区整理与研究，产品形态和二次开发灵感来自 `cc-haha` 项目。Gaster Code 不是 Anthropic、Claude Code 或 `cc-haha` 的官方项目，也不与上述项目或组织存在官方关联。

我们公开这个仓库，是为了让更多开发者能够审查代码、复现实验、提交修复，并围绕本地 AI 编码助手继续做可用性、模型接入、桌面体验和自动化能力的改进。

## 下载

最新源码版本：**v1.0.7**
当前可下载安装包：**v1.0.7**

- [GitHub Release](https://github.com/HereditaryDog/gaster-code-releases/releases/latest)
- [latest.json](https://github.com/HereditaryDog/gaster-code-releases/releases/latest/download/latest.json)

| 平台 | 安装包 |
| --- | --- |
| macOS Apple Silicon | `Gaster-Code_1.0.7_macos_arm64_dmg.dmg` |
| macOS Intel | `Gaster-Code_1.0.7_macos_x64_dmg.dmg` |
| Windows x64 | `Gaster-Code_1.0.7_windows_x64_nsis.exe` |
| Linux x64 | `Gaster-Code_1.0.7_linux_x64_deb.deb` |

`v1.0.7` 代码、文档、release notes、updater metadata 和全平台安装包通过 `main`、`v1.0.7` tag 与 GitHub Release 维护。本地 Apple Silicon 测试包使用 `Gaster Code-a 1.0.7.dmg` 命名。

macOS 首次运行如果提示无法打开，可以在终端执行：

```bash
xattr -cr /Applications/Gaster\ Code.app
```

## 能力概览

| 方向 | 能力 |
| --- | --- |
| 本地编码 | CLI / TUI、无头模式、工具调用、权限确认、Git 感知文件引用 |
| 桌面端 | Tauri 2 + React、多标签、多会话、工作区文件面板、会话批量整理 |
| 模型接入 | G-Master API 默认接入，也支持 OpenAI、DeepSeek、Ollama 等兼容模型 |
| 扩展系统 | MCP、插件、Skills、Agents、斜杠命令和用户安装目录扫描 |
| 自动化 | 定时任务、桌面通知、任务跟踪、多 Agent / Teams 协作 |
| 远程控制 | Telegram、飞书、微信、钉钉适配器，支持远程对话和权限处理 |
| 多端访问 | H5 手机浏览器访问，支持 Token 和允许来源控制 |
| 诊断与数据 | 诊断导出、最近错误、日志目录、本地 Token 用量和活动统计 |

## 快速开始

### 1. 安装 Bun

```bash
# macOS / Linux
curl -fsSL https://bun.sh/install | bash

# macOS (Homebrew)
brew install bun

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

### 2. 安装依赖

```bash
bun install
```

如果你要运行桌面端或远程适配器，继续安装对应依赖：

```bash
cd desktop && bun install
cd ../adapters && bun install
cd ..
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

按需填写模型服务、鉴权和本地运行配置。

### 4. 启动 CLI

```bash
bun run start
```

无头模式示例：

```bash
bun run start -- -p "summarize this repository"
```

## 桌面端开发

桌面端开发需要同时启动本地 API 服务和前端。

```bash
SERVER_PORT=3456 bun run src/server/index.ts
```

另开一个终端：

```bash
cd desktop
bun run dev --host 127.0.0.1 --port 2024
```

打开：

```text
http://127.0.0.1:2024
```

## 项目结构

```text
src/        CLI、TUI、本地服务、工具和核心逻辑
desktop/    Tauri 桌面端、React 前端、原生打包配置
adapters/   Telegram、飞书、微信、钉钉等远程适配器
docs/       使用文档、架构说明和功能指南
scripts/    发布、质量检查和辅助脚本
```

## 发布与更新

桌面端发布使用 `.github/workflows/release-desktop.yml` 构建 macOS ARM64、macOS x64、Windows x64 和 Linux x64 安装包。正式安装包会发布到本仓库的 GitHub Releases，并通过 `latest.json` 提供给桌面端 updater。生成 updater metadata 需要 `TAURI_SIGNING_PRIVATE_KEY` 和 `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`。

本地 Apple Silicon 测试打包入口：

```bash
./desktop/scripts/build-macos-arm64.sh
```

本地测试包使用 `Gaster Code-a <version>.dmg` 命名；正式发布资产继续由 GitHub Actions 生成 `Gaster-Code_<version>_<platform>_<arch>_<bundle>` 格式的安装包。

## 文档

- [快速开始](docs/guide/quick-start.md)
- [环境变量](docs/guide/env-vars.md)
- [FAQ](docs/guide/faq.md)
- [桌面端文档](docs/desktop/)
- [IM 接入](docs/im/)
- [MCP 与 Skills](docs/skills/01-usage-guide.md)
- [多 Agent / Teams](docs/agent/)
- [Computer Use](docs/features/computer-use.md)
- [项目结构](docs/reference/project-structure.md)

## 参与开发

欢迎提交 issue、PR、复现步骤、平台兼容性反馈和文档修正。适合优先处理的方向包括：

- 公开仓库文档和安装体验
- 桌面端首次启动、更新、诊断和错误恢复
- 模型提供商接入与配置体验
- Skills、Agents、MCP 和远程适配器的可用性
- 自动化任务、Teams 协作和多工作区流程

提交前建议运行：

```bash
bun run check:brand
bun run quality:pr
```

---

Gaster Code 的目标不是做一个展示页，而是维护一个能真正运行、能打包、能继续二次开发的本地 AI 编码助手。
