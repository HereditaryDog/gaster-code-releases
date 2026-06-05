# Electron 迁移任务清单

本清单记录 V 1.1.0 迁移的主要工程边界，便于后续维护者判断某个问题属于 Electron host、renderer、server sidecar 还是发布链路。

## 已完成任务

- 引入 `desktop/electron/` main process、preload、IPC channel 和 host service。
- 将 renderer 原生能力调用收敛到 `desktop/src/lib/desktopHost/`。
- 将 server sidecar、adapter sidecar、terminal PTY、Workbench preview、文件打开、外链跳转、通知、菜单、托盘、窗口状态和 updater 迁移到 Electron host。
- 保留 G-Master API 账号中心、官方默认服务商、充值订阅、GPT Image 2 异步绘图和精选能力。
- 引入 package-smoke，校验安装包里的 sidecar、node-pty、renderer dist、app-update metadata 和平台安装包结构。
- 将 release workflow 切到 Electron Builder，并同步正式安装包、blockmap 和 `latest*.yml` 到公开 release-only 仓库。
- 合并上游 v0.4.0 中的 runtime 修复，包括 `/agent` 命令、OAuth token refresh、会话标题、图片输入和 provider context window。

## 仍需谨慎维护的边界

- `desktop/src-tauri/` 仍保存图标、preview agent 资源、Tauri 元数据和 Cargo 版本信息，发布脚本会继续同步版本。
- Renderer 中不要重新引入 `@tauri-apps/*` 生产依赖；如需原生能力，应扩展 `desktopHost`。
- Electron Builder artifact 命名是公开 release 页面和 updater metadata 的契约，修改前必须同步 package-smoke 和 release workflow 测试。
- macOS 未公证测试包需要安装说明中的 `xattr -cr /Applications/Gaster\ Code.app` 兜底。
