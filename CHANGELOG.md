# 更新日志

## 1.0.4 - 2026-05-24

### Highlight

- 长对话切换更顺滑：切换会话时优先显示对话页面，再渐进加载长上下文内容，降低历史会话内容很多时的卡顿感。

### 主要更新

- 引入 measured transcript virtualization、Markdown 渲染缓存复用、聊天块 memo 化，以及标签页关闭后的缓存清理。
- 会话 stream 更新支持广播给多个桌面客户端，同时保留 Gaster/G-Master 特定会话行为。
- 新增 H5 局域网诊断、过期 host 检测和桌面对话分支支持。
- 新增 AI 请求超时时间配置和手动代理设置。
- 对齐 root package、desktop package、Tauri、Rust、lockfile 和 About 页面显示版本到 `1.0.4`。

### 问题修复

- 修复桌面端重连后 streaming tool-call 和 Ask User Question 状态不可见的问题。
- 修复 Computer Use 依赖安装流程中的 Python 版本检查、Pillow 兼容固定和 pip 镜像回退稳定性问题。
- 修复 workspace/code 渲染、registered filesystem roots、project context chip、Telegram 适配器流式输出和 Markdown 表格格式问题。
- 修复 release workflow 的签名密钥传递、macOS x64 runner 选择和同仓库公开发布资产同步问题。

### 安装说明

- 无需用户数据迁移。
- 当前公开安装包版本为 `1.0.4`。
- 本地 Apple Silicon 测试包命名为 `Gaster Code-a 1.0.4.dmg`。
- 正式安装包在 GitHub Release 提供 macOS Apple Silicon、macOS Intel、Windows x64 和 Linux x64 版本。

## 1.0.3 - 2026-05-24

- 对齐 release metadata、package metadata、lockfile、桌面端 About 版本、文档和 release notes 到 `1.0.3`。
- 保留 1.0.1 的 Drawing 复杂提示词超时修复，以及 1.0.2 的长对话切换优化。

## 1.0.2 - 2026-05-22

- 优化桌面端长 transcript 会话切换：先显示页面，再渐进加载对话内容。

## 1.0.1 - 2026-05-22

- 修复 Drawing 复杂提示词异步图像生成超时处理。

## 1.0.0 - 2026-05-21

- 发布第一条公开开源的 Gaster Code release line，并对齐源码、文档、release notes、updater metadata 和桌面端 package metadata。
