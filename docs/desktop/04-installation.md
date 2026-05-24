# 安装指南

当前源码补丁版本：**V 1.0.4**。这个版本在 1.0.0 正式公开版本基础上包含复杂提示词绘图超时修复，并优化长对话会话切换性能，让桌面端切换历史会话时更快先显示页面、再渐进加载内容；同时补充会话流式状态、H5 诊断、网络超时/代理设置和远程适配器输出稳定性改进。

> 当前公开可下载安装包版本：**V 1.0.4**。正式安装包由 release workflow 完成签名、打包和公开资产同步；本地 Apple Silicon 测试包使用 `Gaster Code-a 1.0.4.dmg` 命名。

## 下载

前往 [GitHub Releases](https://github.com/HereditaryDog/gaster-code-releases/releases) 下载对应平台的安装包：

| 平台 | 文件 |
|------|------|
| macOS (Apple Silicon) | `Gaster-Code_1.0.4_macos_arm64_dmg.dmg` |
| macOS (Intel) | `Gaster-Code_1.0.4_macos_x64_dmg.dmg` |
| Windows x64 | `Gaster-Code_1.0.4_windows_x64_nsis.exe` |
| Linux x64 | `Gaster-Code_1.0.4_linux_x64_deb.deb` |

> 发布策略：不拆平台代码分支。当前 tag 自动发布默认构建 macOS ARM64、macOS x64、Windows x64 和 Linux x64；Linux ARM64 可以在手动发布工作流中按需启用。

> 不确定 Mac 架构？点击左上角  → 关于本机，芯片为 Apple M 开头选 aarch64，Intel 选 x64。

## macOS 安装

1. 双击 `.dmg` 文件，将 `Gaster Code.app` 拖入 `Applications` 文件夹
2. 首次打开时，进入 `Applications`，右键点击 `Gaster Code.app` → 选择「打开」→ 在弹窗中点击「打开」，仅需操作一次
3. 如果提示**"已损坏，无法打开"**，在终端执行：

```bash
xattr -cr /Applications/Gaster\ Code.app
```

如果仍然打不开，可以再执行一次带管理员权限的命令：

```bash
sudo xattr -cr /Applications/Gaster\ Code.app
```

> 当前内部测试包暂未进行 Apple Developer ID 公证，macOS 可能会阻止首次运行。右键打开或移除隔离属性后即可正常使用。

## Windows 安装

1. 双击 `.exe` 安装程序，按向导完成安装
2. 首次运行如果 SmartScreen 弹出警告，点击 **「更多信息」** → **「仍要运行」**

> 应用暂未进行 Windows 代码签名，仅首次运行需要此操作。

## 首次启动

打开 Gaster Code 后会看到欢迎页：

1. 选择 **使用 G-Master API 账号登录**：跳转到 G-Master API 网页授权，成功后桌面端自动同步官方默认服务商。
2. 选择 **注册 G-Master 账号**：跳转到 G-Master API 注册页，注册完成后继续桌面授权流程。
3. 选择 **使用自定义模型服务商**：进入设置页，自行配置 Anthropic / OpenAI 兼容服务商。

桌面端只负责登录授权和本地 Provider 同步；注册、找回密码、订阅支付、余额充值等操作都在 G-Master API 网页完成。

## Web UI 模式

如果桌面端安装遇到问题，可以直接通过浏览器使用 Web UI。在项目根目录下分别启动服务端和前端：

```bash
# 1. 启动服务端（在项目根目录）
SERVER_PORT=3456 bun run src/server/index.ts

# 2. 启动前端（在 desktop 目录）
cd desktop
bun run dev --host 127.0.0.1 --port 2024
```

启动后浏览器访问 `http://127.0.0.1:2024` 即可。

## 常见问题

**Q: macOS 提示"来自身份不明的开发者"？**

右键点击应用 → 选择「打开」→ 在弹窗中点击「打开」，仅需操作一次。

**Q: Windows 提示缺少 WebView2？**

从 [Microsoft 官方](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) 下载安装 WebView2 运行时。
