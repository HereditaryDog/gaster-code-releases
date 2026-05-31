# Changelog

本文件汇总公开版本线的主要变化。每个正式发布版本的完整说明保存在
[`release-notes/`](release-notes/) 目录中。

## V 1.0.8

- 修复根项目、桌面端和适配器依赖审计发现的问题，并同步更新锁文件。
- 将 Markdown 代码块与 Mermaid 渲染器改为真实懒加载，降低桌面端首屏包体和长上下文会话切换时的主线程压力。
- 调整可信 H5 启动 Token 传递方式，将新链接中的敏感 Token 放入 URL hash，同时保留旧 query 链接兼容。
- 更新桌面测试断言以适配新版 Vite/Vitest 与懒加载渲染行为。
- 推进桌面版本、Tauri 版本、README、安装指南和发布说明到 `1.0.8`。
- 完整说明：[release-notes/v1.0.8.md](release-notes/v1.0.8.md)

## V 1.0.7

- 合并桌面端长上下文会话切换的渲染性能优化，减少标签栏、Markdown 和工作区面板的重复渲染。
- 集成 G-Master API 账号中心与计费能力，覆盖注册、登录、充值、订阅、取消/恢复订阅和交易记录。
- 保留 GPT Image 2 异步绘图路径和原始提示词提交行为。
- 修复 release hygiene 相关文档、依赖锁文件和 docs 构建配置不一致问题。
- 推进桌面版本、Tauri 版本、README、安装指南和发布说明到 `1.0.7`。
- 完整说明：[release-notes/v1.0.7.md](release-notes/v1.0.7.md)

## V 1.0.6

- 优化长 Markdown、工作区预览和标签拖拽在桌面端 WebView 中的主线程占用。
- Markdown 渲染新增 finalized/streaming 分层解析缓存，并对大型文档启用渐进分块渲染和空闲调度。
- 标签栏拖拽缓存标签位置并合并高频 pointer move，减少布局读取和 React 重渲染。
- 工作区 Markdown 文件预览默认先展示前 800 行，按需展开全部内容。
- 对齐 root package、desktop package、Tauri、Rust、lockfile 和 About 页面显示版本到 `1.0.6`。
- 完整说明：[release-notes/v1.0.6.md](release-notes/v1.0.6.md)

## V 1.0.5

- `1.0.5` 是本地 Apple Silicon 测试包验证线，没有作为公开 GitHub Release 发布。
- 该版本用于验证 release hygiene 修复、本地 macOS DMG 打包、签名检查和安装流程。
- 后续公开版本线直接推进到 `1.0.6`。

## V 1.0.4

- 改善长上下文对话切换体验：切换会话时优先显示对话页面，再渐进加载长上下文内容。
- 引入 measured transcript virtualization、Markdown 渲染缓存复用、聊天块 memo 化和标签页缓存清理。
- 会话 stream 更新支持广播给多个桌面客户端，并保留 Gaster/G-Master 特定会话行为。
- 新增 H5 局域网诊断、过期 host 检测、桌面对话分支、AI 请求超时和手动代理设置。
- 修复 release workflow 签名密钥传递、macOS x64 runner 选择和公开发布资产同步问题。
- 完整说明：[release-notes/v1.0.4.md](release-notes/v1.0.4.md)

## V 1.0.0

- Gaster Code 项目公开后的第一个正式开源版本。
- 统一包名、桌面端、发布页、Release 身份和公开仓库元数据。
- 保留桌面端、本地服务、模型服务商配置、IM 适配器、定时任务、Drawing、Skills、Agents 和诊断导出等核心能力。
- 加入发布前品牌扫描，避免旧项目标识重新进入用户可见代码、文档或发布资产。
- 完整说明：[release-notes/v1.0.0.md](release-notes/v1.0.0.md)

## 历史版本索引

| 版本 | 主要变化 | 完整说明 |
| --- | --- | --- |
| V 0.2.8-gastercode.3 | 绘图请求改为 G-Master API 异步图片任务，保留原始提示词并避免长连接超时。 | [release-notes/v0.2.8-gastercode.3.md](release-notes/v0.2.8-gastercode.3.md) |
| V 0.2.8-gastercode.2 | 优化会话切换性能，减少任务列表、checkpoint 和工作区状态重复请求。 | [release-notes/v0.2.8-gastercode.2.md](release-notes/v0.2.8-gastercode.2.md) |
| V 0.2.8-gastercode.1 | 新增 `/goal` 目标跟踪、Agent 进度展示、桌面 shell 环境继承、更新代理和便携模式改进。 | [release-notes/v0.2.8-gastercode.1.md](release-notes/v0.2.8-gastercode.1.md) |
| V 0.2.7-gastercode.1 | 改进插件、Skills、Agents 刷新发现，加入 Project Memory 和打开项目入口，提升 IM 卡片流式稳定性。 | [release-notes/v0.2.7-gastercode.1.md](release-notes/v0.2.7-gastercode.1.md) |
| V 0.2.6-gastercode.1 | 加强 H5 访问、会话整理、文件引用、主题、侧边栏导航和兼容模型返回值稳定性。 | [release-notes/v0.2.6-gastercode.1.md](release-notes/v0.2.6-gastercode.1.md) |
| V 0.2.3-gastercode.3 | 修复第三方 Skills / Agents 安装可见性，并延续 G-Master 认证诊断修复。 | [release-notes/v0.2.3-gastercode.3.md](release-notes/v0.2.3-gastercode.3.md) |
| V 0.2.3-gastercode.2 | 修复 G-Master 登录态失效提示、refresh 并发、历史会话恢复和 CLI code 143 诊断上下文。 | [release-notes/v0.2.3-gastercode.2.md](release-notes/v0.2.3-gastercode.2.md) |
| V 0.2.3-gastercode.1 | 补齐 H5 手机访问、移动端聊天体验、活动统计和多项桌面运行时修复。 | [release-notes/v0.2.3-gastercode.1.md](release-notes/v0.2.3-gastercode.1.md) |
| V 0.2.2-gastercode.1 | 加入 GasterCode 精选能力 MVP，补齐仓库启动、运行时隔离、诊断恢复和内置能力开关。 | [release-notes/v0.2.2-gastercode.1.md](release-notes/v0.2.2-gastercode.1.md) |
| V 0.2.1-gastercode.6 | 补齐 G-Master 统一账号入口，支持桌面端登录与注册分流。 | [release-notes/v0.2.1-gastercode.6.md](release-notes/v0.2.1-gastercode.6.md) |
| V 0.2.1-gastercode.5 | 清理品牌残留并兼容迁移用户可见界面、OAuth 成功页、诊断路径、服务商预设和本地存储命名。 | [release-notes/v0.2.1-gastercode.5.md](release-notes/v0.2.1-gastercode.5.md) |
| V 0.2.1-gastercode.4 | 修复 updater 可用性并调整发布矩阵，避免 GitHub Actions 额度限制阻断公开 release-only 同步。 | [release-notes/v0.2.1-gastercode.4.md](release-notes/v0.2.1-gastercode.4.md) |
| V 0.2.1-gastercode.3 | 修复 IM adapter 品牌展示问题。 | [release-notes/v0.2.1-gastercode.3.md](release-notes/v0.2.1-gastercode.3.md) |
| V 0.2.1-gastercode.2 | 将桌面端 updater 改为读取公开 release-only 仓库中的 `latest.json` 和安装包。 | [release-notes/v0.2.1-gastercode.2.md](release-notes/v0.2.1-gastercode.2.md) |
| V 0.2.1-gastercode.1 | 完善桌面能力，保留 Gaster 产品身份、G-Master API、GPT Image 2 绘图、蓝色主题和独立 updater 链路。 | [release-notes/v0.2.1-gastercode.1.md](release-notes/v0.2.1-gastercode.1.md) |
| V 0.2.1 | 增强 IM 接入、桌面通知、上下文统计和桌面运行稳定性。 | [release-notes/v0.2.1.md](release-notes/v0.2.1.md) |
| V 0.2.0-gastercode.7 | 首个公开预览候选版本，纳入蓝色品牌主题、Gaster Code 文案清理和文档发布修复。 | [release-notes/v0.2.0-gastercode.7.md](release-notes/v0.2.0-gastercode.7.md) |
| V 0.2.0-gastercode.6 | 修复 Gaster Code 品牌与服务商显示，并复验 Windows 安装包。 | [release-notes/v0.2.0-gastercode.6.md](release-notes/v0.2.0-gastercode.6.md) |
| V 0.2.0-gastercode.5 | 修复 updater 发布链路和多平台并发创建 GitHub Release 导致的资产拆分问题。 | [release-notes/v0.2.0-gastercode.5.md](release-notes/v0.2.0-gastercode.5.md) |
| V 0.2.0-gastercode.4 | 轮换 updater 公钥并恢复 CI 中的签名更新产物生成。 | [release-notes/v0.2.0-gastercode.4.md](release-notes/v0.2.0-gastercode.4.md) |
| V 0.2.0-gastercode.3 | 修复 GitHub Release 缺少 Tauri updater manifest 的问题。 | [release-notes/v0.2.0-gastercode.3.md](release-notes/v0.2.0-gastercode.3.md) |
| V 0.2.0-gastercode.2 | 补齐深色模式、品牌展示和关于页信息。 | [release-notes/v0.2.0-gastercode.2.md](release-notes/v0.2.0-gastercode.2.md) |
| V 0.2.0-gastercode.1 | 保留 G-Master API 官方登录、默认服务商、品牌和绘图定制，并带来工作区和桌面体验改进。 | [release-notes/v0.2.0-gastercode.1.md](release-notes/v0.2.0-gastercode.1.md) |
| V 0.2.0 | 整合 Slash Command、终端标签页、Provider 配置、工作区文件管理、变更审查、回滚、诊断导出和发布质量门禁。 | [release-notes/v0.2.0.md](release-notes/v0.2.0.md) |
| V 0.1.9 | 新增右侧工作区文件管理、文件变更审查与回滚，并增强第三方 Provider 兼容性。 | [release-notes/v0.1.9.md](release-notes/v0.1.9.md) |
| V 0.1.8 | 增强桌面 Slash Command、Provider 配置体验和会话稳定性。 | [release-notes/v0.1.8.md](release-notes/v0.1.8.md) |
| V 0.1.7 | 修复 Windows 自动更新稳定性和聊天展示体验。 | [release-notes/v0.1.7.md](release-notes/v0.1.7.md) |
| V 0.1.6 | 补齐桌面扩展管理、MCP 使用体验、命令行安装路径和会话稳定性。 | [release-notes/v0.1.6.md](release-notes/v0.1.6.md) |
| V 0.1.5 | 修复 WebFetch、`@` 文件列表、跨会话 TODO、权限模式切换和桌面端首字返回过慢。 | [release-notes/v0.1.5.md](release-notes/v0.1.5.md) |
| V 0.1.4 | 覆盖 Windows Computer Use、侧边栏交互、macOS 标题栏拖拽和代码块渲染修复。 | [release-notes/v0.1.4.md](release-notes/v0.1.4.md) |
| V 0.1.3 | 修复项目级 Skills、删除会话标签同步、Computer Use 授权和差异预览体验。 | [release-notes/v0.1.3.md](release-notes/v0.1.3.md) |
| V 0.1.2 | 修复 Windows 标签栏布局和会话任务栏交互。 | [release-notes/v0.1.2.md](release-notes/v0.1.2.md) |
| V 0.1.1 | 修复 Windows 桌面端启动异常与窗口控件问题。 | [release-notes/v0.1.1.md](release-notes/v0.1.1.md) |
| V 0.1.0 | 首个桌面正式版，基于 Tauri 2 + React 构建跨平台客户端。 | [release-notes/v0.1.0.md](release-notes/v0.1.0.md) |
