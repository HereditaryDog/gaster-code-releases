# Electron 迁移研究

V 1.1.0 将桌面端从 Tauri 2 迁移到 Electron。迁移目标不是改动聊天核心，而是统一桌面运行时，让 macOS、Windows 和 Linux 使用一致的 Chromium 渲染、内置浏览器、Workbench、终端、通知、托盘、菜单和窗口行为。

## 背景

1. 旧 Tauri/WebView 方案在不同系统 WebView 上表现不完全一致，长上下文、内置浏览器、截图和窗口交互更容易出现平台差异。
2. Electron 将 Chromium、main process 和 preload 能力打包到同一运行时，便于复用成熟的 BrowserWindow、WebContentsView、node-pty 和 electron-updater 能力。
3. Gaster Code 必须保留 G-Master API 登录、账号中心、充值订阅、官方默认服务商、GPT Image 2 异步绘图和 H5 访问安全边界。

## 迁移原则

- Renderer 生产代码只依赖 `desktopHost` 抽象，不直接调用 Electron 或旧 Tauri API。
- Electron main process 只负责桌面原生能力；聊天、工具执行、provider、G-Master API 和图片任务仍在现有 server/CLI 层。
- `desktop/src-tauri/` 中的图标、资源和旧元数据暂时保留，作为打包资源和版本同步兼容层。
- 发布链路从 Tauri updater `latest.json` 切换到 electron-updater 标准 `latest*.yml` metadata。

## 当前结论

- Electron 是 1.1.0 之后的桌面发布运行时。
- 本地 macOS 测试包沿用内部命名：`Gaster Code-a <version>.dmg`。
- 正式全平台包由 `.github/workflows/release-desktop.yml` 通过 Electron Builder 构建，并同步到 `HereditaryDog/gaster-code-releases`。
