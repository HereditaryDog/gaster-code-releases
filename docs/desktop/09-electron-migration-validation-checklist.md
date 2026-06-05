# Electron 迁移验证清单

V 1.1.0 发布前需要同时验证 Electron host、Gaster 专属功能、安装包和公开 release 页面。

## 桌面基础能力

- 启动应用后能自动启动 server sidecar，并在状态栏显示可用模型。
- 多标签、多会话、长上下文切换、流式输出、权限请求、AskUser 和工具结果展示正常。
- Workbench/内置浏览器能打开本地预览，截图和元素选择可回填到输入框。
- 终端页能创建 shell、输入命令、resize，并在关闭标签后释放 PTY。
- 文件打开、目录选择、外链跳转、通知、菜单、托盘、窗口隐藏/恢复、全屏和缩放行为正常。

## Gaster 专属能力

- G-Master API 登录、注册、退出、余额、充值、订阅、取消订阅、恢复订阅和交易记录正常。
- 官方默认服务商同步后，聊天请求继续走 G-Master provider。
- GPT Image 2 绘图仍走 G-Master API 异步任务，不改写用户提示词。
- 精选 Skills/Agents、能力开关、H5 LAN 访问和远程 adapter 不被 Electron host 迁移破坏。

## 安装包

- macOS Apple Silicon 本地测试包命名为 `Gaster Code-a 1.1.0.dmg`。
- 正式 release 包包含 macOS dmg/zip、Windows NSIS exe、Linux AppImage/deb、blockmap 和标准 `latest*.yml` metadata。
- package-smoke 能找到 app executable、renderer dist、server sidecar、node-pty 和 app-update metadata。
- macOS 未公证包如果提示“已损坏”或“无法验证开发者”，安装说明中的命令可恢复启动：

```bash
xattr -cr /Applications/Gaster\ Code.app
```

## 发布链路

- `release-notes/v1.1.0.md` 是中文 release 页面正文，包含 Highlight、主要更新、问题修复和安装说明。
- `.github/workflows/release-desktop.yml` 不调用 Tauri action，不依赖 `latest.json`。
- 私有源码仓库 release 和公开 `HereditaryDog/gaster-code-releases` release 的标题、正文、安装包和 updater metadata 一致。
- README、CHANGELOG、安装指南、桌面版本和 Electron package metadata 均指向 `1.1.0`。
