# Gaster Code

<p align="center">
  <strong>面向 G-Master API 用户的本地编程助手桌面端</strong>
</p>

<p align="center">
  <a href="https://github.com/HereditaryDog/gaster-code-releases/releases/latest"><strong>下载最新版</strong></a>
  ·
  <a href="https://github.com/HereditaryDog/gaster-code-releases/releases/latest/download/latest.json">更新元数据</a>
  ·
  <a href="#常见问题">常见问题</a>
</p>

<p align="center">
  <img alt="Latest release" src="https://img.shields.io/github/v/release/HereditaryDog/gaster-code-releases?label=latest&color=2563eb">
  <img alt="Platform" src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-111827?color=111827">
  <img alt="Updater" src="https://img.shields.io/badge/updater-enabled-2563eb">
</p>

Gaster Code 是一个运行在你电脑上的本地编程助手。它把代码编辑、终端执行、项目理解、绘图生成、远程控制和 IM 入口放在同一个桌面工作流里，并通过 G-Master API 接入你配置好的模型服务。

这个仓库是 Gaster Code 的公开下载仓库。主项目代码仓库保持私有，这里只发布安装包、签名文件和自动更新所需的 `latest.json`。

## 立即下载

进入 [最新版 Release 页面](https://github.com/HereditaryDog/gaster-code-releases/releases/latest)，在 Assets 区域选择适合你系统的安装包。

| 系统 | 下载哪个文件 | 适合设备 |
| --- | --- | --- |
| macOS Apple Silicon | `Gaster-Code_*_macos_arm64_dmg.dmg` | M1、M2、M3、M4 等 Apple 芯片 Mac |
| macOS Intel | `Gaster-Code_*_macos_x64_dmg.dmg` | Intel 芯片 Mac |
| Linux x64 | `Gaster-Code_*_linux_x64_deb.deb` | Ubuntu、Debian 及兼容发行版 |

如果你已经安装过 Gaster Code，也可以直接在应用内使用「检查更新」。桌面端会从本仓库公开 release 读取更新信息，不需要访问私有主仓库。

## Gaster Code 能做什么

### 本地编程助手

Gaster Code 可以读取你的项目上下文，帮你解释代码、修改文件、定位 bug、补测试、跑命令和整理实现方案。它面向真实本地项目工作，而不是只做单次问答。

### 桌面端工作流

桌面端提供会话、设置、终端、绘图和本地服务能力。你可以在一个应用里完成从提问、改代码、运行验证到继续追踪任务的完整流程。

### G-Master API 接入

Gaster Code 通过 G-Master API 使用模型。你可以在 G-Master API 中配置可用 provider 和模型，然后在 Gaster Code 中选择对应模型处理不同任务。

### 项目级上下文

它可以围绕当前项目进行连续对话，理解文件结构、命令输出、构建结果和历史会话，让复杂任务不必每次从零开始描述。

### 终端和工具调用

Gaster Code 可以在本地执行开发命令，例如安装依赖、启动服务、运行测试、查看 Git 状态和分析构建错误。你仍然可以控制关键操作，避免盲目执行。

### 绘图与多模态入口

桌面端包含绘图页面，可用于通过模型生成图像。它也会逐步整合更多适合开发、设计和内容生产的本地能力。

### IM 远程入口

Gaster Code 支持通过 IM adapter 连接微信等入口。完成配对后，你可以在移动端发送消息，让本地桌面端继续处理任务。

## 适合谁使用

- 已经在使用 G-Master API，希望有一个桌面端编程助手的用户。
- 想把 AI 助手接入本地项目、终端和文件系统的开发者。
- 经常需要调试、重构、写文档、跑测试或处理多步骤开发任务的人。
- 希望通过微信等 IM 入口远程触发本地编程助手的用户。

## 使用方式

1. 在 [最新版 Release 页面](https://github.com/HereditaryDog/gaster-code-releases/releases/latest) 下载适合你系统的安装包。
2. 安装并启动 Gaster Code。
3. 在设置中配置或确认 G-Master API 服务。
4. 打开项目目录，开始与 Gaster Code 对话。
5. 需要移动端入口时，在桌面端完成 IM 配对后再使用。

## 自动更新

Gaster Code 的桌面端 updater 使用本仓库的公开 release 资产：

```text
https://github.com/HereditaryDog/gaster-code-releases/releases/latest/download/latest.json
```

更新流程只需要读取公开的 `latest.json` 和安装包文件。主代码仓库可以保持私有，不会影响普通用户检查更新。

## 隐私和本地工作

Gaster Code 是本地桌面端应用。它需要访问你选择打开的项目文件，并会根据你的操作执行本地命令。模型请求会通过你配置的 G-Master API 服务发送。请只在你信任的项目目录中使用，并在执行高风险命令前仔细确认。

## 常见问题

### 这个仓库为什么没有源码？

这是公开 release-only 仓库，只用于分发安装包和 updater 元数据。Gaster Code 的主项目仓库目前保持私有。

### 应该下载 `.dmg` 还是 `.app.tar.gz`？

普通用户下载 `.dmg`。`.app.tar.gz` 和对应 `.sig` 主要用于桌面端自动更新。

### macOS 提示无法打开怎么办？

如果 macOS 提示应用无法打开，通常是系统给新下载的应用加了隔离标记。请先把 Gaster Code 拖到「应用程序」文件夹，然后打开「终端」，运行下面的命令：

```bash
sudo xattr -rd com.apple.quarantine "/Applications/Gaster Code.app"
```

运行后重新打开 Gaster Code。如果仍然被拦截，再到「系统设置」的安全与隐私相关位置允许打开。请只从本仓库 Release 页面下载最新安装包。

### 检查更新失败怎么办？

先确认你能访问 GitHub，并检查这个地址是否可打开：

```text
https://github.com/HereditaryDog/gaster-code-releases/releases/latest/download/latest.json
```

如果该地址能打开但应用仍失败，请保留错误提示和当前版本号，再反馈给维护者。

### Windows 支持吗？

当前公开稳定安装包优先提供 macOS 和 Linux x64。Windows 支持会在后续版本按需发布。

## 版本发布

所有公开版本都在 [Releases](https://github.com/HereditaryDog/gaster-code-releases/releases) 页面查看。每个版本会包含：

- 用户安装包，例如 `.dmg`、`.deb`。
- 自动更新包，例如 `.app.tar.gz`。
- 签名文件，例如 `.sig`。
- updater 元数据 `latest.json`。

## 项目关系

- Gaster Code：本地编程助手桌面端。
- G-Master API：模型服务和 provider 配置入口。
- 本仓库：公开安装包和自动更新分发仓库。

主仓库保持私有时，请始终把用户下载链接指向本仓库的 [latest release](https://github.com/HereditaryDog/gaster-code-releases/releases/latest)。
