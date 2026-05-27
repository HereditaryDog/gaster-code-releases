# 更新日志

## 1.0.6 - 2026-05-27

### Highlight

- 桌面渲染性能继续优化：长 Markdown、工作区预览和标签拖拽都减少主线程压力，让长上下文会话之间切换更稳定、更顺滑。

### 主要更新

- Markdown 渲染新增 finalized/streaming 分层解析缓存，并对大型文档启用渐进分块渲染和空闲调度。
- 标签栏拖拽改为缓存标签位置、合并高频 pointer move 到 animation frame，并直接更新拖拽元素 transform，减少布局读取和 React 重渲染。
- 工作区 Markdown 文件预览默认先展示前 800 行，用户需要时再展开全部已加载内容。
- 补充 TabBar、MarkdownRenderer 和 WorkspacePanel 的性能回归测试覆盖。
- 对齐 root package、desktop package、Tauri、Rust、lockfile 和 About 页面显示版本到 `1.0.6`。

### 问题修复

- 修复长 Markdown 文档一次性解析和挂载导致桌面 WebView 卡顿的问题。
- 修复标签拖拽过程中高频布局读取和重渲染导致的交互卡顿。
- 修复大型工作区 Markdown 预览一次性渲染过多内容导致文件面板响应变慢的问题。

### 安装说明

- 无需用户数据迁移。
- 当前公开安装包版本为 `1.0.6`。
- 本地 Apple Silicon 测试包命名为 `Gaster Code-a 1.0.6.dmg`。
- macOS 用户如果首次启动时提示“已损坏，无法打开”或“此文件已损坏”，请先将 `Gaster Code.app` 拖入 `Applications` 文件夹，然后打开终端执行：

  ```bash
  xattr -cr /Applications/Gaster\ Code.app
  ```

- 正式安装包在 GitHub Release 提供 macOS Apple Silicon、macOS Intel、Windows x64 和 Linux x64 版本。

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
- macOS 用户如果首次启动时提示“已损坏，无法打开”或“此文件已损坏”，请先将 `Gaster Code.app` 拖入 `Applications` 文件夹，然后打开终端执行：

  ```bash
  xattr -cr /Applications/Gaster\ Code.app
  ```

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
