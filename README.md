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
[![Current Version](https://img.shields.io/badge/version-V%201.1.0-blue)](release-notes/v1.1.0.md)
[![中文](https://img.shields.io/badge/中文-当前-blue)](README.md)
[![English](https://img.shields.io/badge/English-Available-green)](README.en.md)

</div>

Gaster Code 是一个面向本地开发场景的 AI 编码助手，提供命令行/TUI、图形化桌面端、多会话工作区、MCP 集成、自动化任务和远程适配能力，适合在真实代码仓库里完成修改、调试、审查和日常开发协作。

> 当前稳定版本：**V 1.1.0**。这个版本将桌面端运行时从 Tauri 2 迁移到 Electron，统一 macOS、Windows 和 Linux 的 Chromium 渲染、内置浏览器、Workbench、终端、通知、托盘、菜单和窗口行为，同时保留 G-Master API 账号中心、充值订阅和 GPT Image 2 异步绘图能力。

<p align="center">
  <a href="#功能">功能</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#桌面端联调">桌面端联调</a> ·
  <a href="#打包与发布">打包与发布</a> ·
  <a href="#文档索引">文档索引</a>
</p>

---

## 功能

- CLI / TUI 交互界面，适合终端内直接完成编码任务
- Electron + React 桌面端，支持多标签、多会话、工作区文件面板和多工作区管理
- Codex 风格深色界面，使用蓝色作为品牌强调色
- G-Master API 账号中心，支持桌面端注册/登录、余额充值、订阅管理和官方默认服务商同步
- 通过 G-Master API 异步图片任务接入 GPT Image 2 绘图，复杂提示词会原样提交
- 自定义模型提供商、鉴权变量、模型上下文窗口和端点映射
- 插件、Skills、Agents 支持刷新后重新扫描用户、项目、外部安装区域
- H5 手机浏览器访问，可通过局域网或自有反向代理连接桌面端服务，并支持 Token 与允许来源控制
- 会话批量整理，支持选择多个历史会话后统一确认删除
- `@` 文件和目录引用，优先使用 Git 感知搜索并遵守 ignore 规则
- 可调整侧边栏宽度，桌面端字体和导航层级针对长期开发使用优化
- Project Memory 可视化管理，支持在设置页查看、编辑和预览项目记忆文件
- 侧边栏可直接用可用 IDE 或文件管理器打开当前项目
- 本地 Token 用量 / 活动统计，便于查看会话、模型和工具使用趋势
- 回复语言设置，可独立于界面语言指定模型回复语言
- MCP、插件、Skills 扩展机制，支持识别斜杠命令包装的外部 Skill
- 多 Agent / Teams 协作能力，支持刷新显示用户安装的 Agent
- 定时任务、桌面通知、自动化执行与任务跟踪
- Computer Use 桌面控制能力，支持自定义 Python 解释器
- Telegram、飞书、微信、钉钉远程控制适配器
- 诊断导出、最近错误、日志目录打开和上下文用量显示

---

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

如果你会使用桌面端或适配器，建议一并安装：

```bash
cd desktop && bun install
cd ../adapters && bun install
cd ..
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

然后按需编辑 `.env`，填入模型服务、鉴权和本地运行需要的配置。

### 4. 启动 CLI

```bash
bun run start
```

无头模式示例：

```bash
bun run start -- -p "summarize this repository"
```

---

## 桌面端联调

桌面端开发时，需要同时启动本地 API 服务和前端。

### 启动本地 API 服务

```bash
SERVER_PORT=3456 bun run src/server/index.ts
```

Windows PowerShell:

```powershell
$env:SERVER_PORT = "3456"
bun run src/server/index.ts
```

健康检查：

```bash
curl http://127.0.0.1:3456/health
```

### 启动桌面前端

```bash
cd desktop
bun run dev --host 127.0.0.1 --port 2024
```

浏览器访问：

```text
http://127.0.0.1:2024
```

---

## 打包与发布

当前桌面版本：`V 1.1.0`。

### Windows

本地脚本：

```powershell
cd desktop
powershell -ExecutionPolicy Bypass -File .\scripts\build-windows-x64.ps1
```

当前仓库也提供 GitHub Actions 开发构建：

- Workflow: `.github/workflows/build-desktop-dev.yml`
- Windows 产物：NSIS `.exe` 安装包

### 公开安装包

下载公开安装包：

- GitHub Releases: https://github.com/HereditaryDog/gaster-code-releases/releases

| 平台 | 安装包 |
|------|--------|
| macOS Apple Silicon | `Gaster-Code-1.1.0-mac-arm64.dmg` |
| macOS Intel | `Gaster-Code-1.1.0-mac-x64.dmg` |
| Windows x64 | `Gaster-Code-1.1.0-win-x64.exe` |
| Linux x64 AppImage | `Gaster-Code-1.1.0-linux-x86_64.AppImage` |
| Linux x64 deb | `Gaster-Code-1.1.0-linux-amd64.deb` |
| Linux ARM64 AppImage | `Gaster-Code-1.1.0-linux-arm64.AppImage` |
| Linux ARM64 deb | `Gaster-Code-1.1.0-linux-arm64.deb` |

### macOS

安装步骤：

1. 双击 `.dmg` 文件，将 `Gaster Code.app` 拖入 `Applications`
2. 首次打开时，进入 `Applications`，右键点击 `Gaster Code.app`，选择「打开」，在弹窗中点击「打开」，仅需操作一次
3. 如果提示「已损坏，无法打开」，在终端执行：

```bash
xattr -cr /Applications/Gaster\ Code.app
```

如果仍然打不开，可以再执行一次带管理员权限的命令：

```bash
sudo xattr -cr /Applications/Gaster\ Code.app
```

> 当前内部测试包暂未进行 Apple Developer ID 公证，macOS 可能会阻止首次运行。右键打开或移除隔离属性后即可正常使用。

本地 Apple Silicon 打包脚本：

```bash
./desktop/scripts/build-macos-arm64.sh
```

该脚本需要在 macOS arm64 主机上运行。

### 正式发布

正式桌面发布走：

```text
.github/workflows/release-desktop.yml
```

它会根据 tag 版本构建 macOS ARM64、macOS x64、Windows x64、Linux x64 和 Linux ARM64 桌面产物，主仓库保持私有，最终安装包、blockmap 和标准 `latest*.yml` updater metadata 会同步到公开的 `HereditaryDog/gaster-code-releases` release-only 仓库，供桌面端 updater 访问。当前版本发布说明见 [release-notes/v1.1.0.md](release-notes/v1.1.0.md)。

---

## 文档索引

- [环境变量](docs/guide/env-vars.md)
- [FAQ](docs/guide/faq.md)
- [全局使用](docs/guide/global-usage.md)
- [桌面端文档](docs/desktop/)
- [前端开发规范](docs/frontend-development-guidelines.md)
- [IM 接入](docs/im/)
- [MCP 与扩展能力](docs/skills/01-usage-guide.md)
- [多 Agent / Teams](docs/agent/01-usage-guide.md)
- [Computer Use](docs/features/computer-use.md)
- [项目结构](docs/reference/project-structure.md)

## 仓库结构

- `src/`: CLI、TUI、服务端、工具与核心逻辑
- `desktop/`: 桌面端前端与 Electron 打包工程
- `adapters/`: 远程适配器
- `docs/`: 使用文档与设计说明
- `scripts/`: 发布和辅助脚本

---

## 说明

本仓库当前以实际可运行、可打包、可继续二次开发为目标维护。若你在使用中发现界面文案、打包元数据或工作流仍有残留不一致，可以直接提 issue 或提交修复。
