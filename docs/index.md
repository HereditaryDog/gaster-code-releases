---
layout: home

hero:
  name: Gaster Code
  text: 本地可运行的 AI 编码助手
  tagline: Electron 桌面端包含可信 H5 访问、G-Master API 账号中心、GPT Image 2 绘图和跨平台 Workbench
  image:
    src: /images/logo-horizontal.png
    alt: Gaster Code
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/quick-start
    - theme: alt
      text: 下载
      link: https://github.com/HereditaryDog/gaster-code-releases/releases

features:
  - icon: "\U0001F5A5"
    title: 完整 TUI 交互
    details: Gaster Code Ink 终端界面，支持 --print 无头模式
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
    details: 桌面控制功能 — 截屏、鼠标、键盘操作（Python Bridge 实现）
    link: /features/computer-use
  - icon: "\U0001F5A5"
    title: 桌面端
    details: 基于 Electron + React 的图形化客户端，多标签、多会话、工作区文件面板、H5 访问、批量整理和 GPT Image 2 绘图
    link: /desktop/
---
