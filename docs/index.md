---
layout: home

hero:
  name: Gaster Code
  text: 公开维护的本地 AI 编码助手
  tagline: v1.0.2 源码补丁优化长对话切换体验，并继续包含 CLI / TUI、桌面端、多会话工作区、MCP、Skills、Agents、远程适配器和自动化任务
  image:
    src: /images/logo-horizontal.png
    alt: Gaster Code
  actions:
    - theme: brand
      text: 查看 Releases
      link: https://github.com/HereditaryDog/gaster-code-releases/releases/latest
    - theme: alt
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: GitHub
      link: https://github.com/HereditaryDog/gaster-code-releases

features:
  - icon: "\U0001F5A5"
    title: CLI / TUI / 桌面端
    details: 终端工作流、无头模式和 Tauri 2 + React 桌面端在同一个公开源码项目里维护
  - icon: "\U0001F9E0"
    title: 记忆系统
    details: 跨会话持久化记忆，自动提取、智能检索、AutoDream 做梦整合
    link: /memory/
  - icon: "\U0001F916"
    title: 多 Agent 系统
    details: 多代理编排、并行任务执行、Teams 协作、Worktree 隔离和用户 Agent 管理
    link: /agent/
  - icon: "\U0001F9E9"
    title: Skills 系统
    details: 可扩展能力插件、自定义工作流、条件激活和斜杠命令包装的外部 Skill
    link: /skills/01-usage-guide
  - icon: "\U0001F310"
    title: 第三方模型支持
    details: 默认接入 G-Master API，也支持 OpenAI、DeepSeek、Ollama 等兼容模型
    link: /guide/third-party-models
  - icon: "\U0001F4AC"
    title: 远程控制
    details: 在桌面端配置 Telegram / 飞书 / 微信 / 钉钉，并通过独立 adapter 进程远程对话 Gaster Code
    link: /im/
  - icon: "\U0001F4BB"
    title: Computer Use
    details: 桌面控制功能，包括截屏、鼠标、键盘操作和 Python Bridge
    link: /features/computer-use
  - icon: "\U0001F4E6"
    title: 公开发布
    details: v1.0.0 起源码、安装包、release notes 和 updater metadata 都在公开仓库维护
    link: https://github.com/HereditaryDog/gaster-code-releases/releases/latest
---

## 来源透明说明

Gaster Code 的代码基础来自 Claude Code 泄露源码的社区整理与研究，产品形态和二次开发灵感来自 `cc-haha` 项目。Gaster Code 不是 Anthropic、Claude Code 或 `cc-haha` 的官方项目，也不与上述项目或组织存在官方关联。

这个仓库从 **v1.0.0** 开始公开维护，目标是让开发者可以审查源码、复现构建、提交修复，并继续改进本地 AI 编码助手的桌面体验、模型接入、自动化任务和扩展系统。

## 当前版本

- 最新源码版本：[Gaster Code v1.0.2](https://github.com/HereditaryDog/gaster-code-releases/releases/tag/v1.0.2)
- 当前可下载安装包：[Gaster Code v1.0.0](https://github.com/HereditaryDog/gaster-code-releases/releases/latest)
- 更新元数据：[latest.json](https://github.com/HereditaryDog/gaster-code-releases/releases/latest/download/latest.json)
- 公开源码：[HereditaryDog/gaster-code-releases](https://github.com/HereditaryDog/gaster-code-releases)
