# 安装指南

当前稳定版本：**V 1.0.9**。这个版本修复 G-Master OAuth 授权页和管理页显示旧客户端版本的问题，并增强 GPT Image 2 异步绘图轮询的临时中断/524 超时恢复能力。

> 本版本使用公开 release-only 仓库提供 updater 元数据和安装包下载。`0.2.1-gastercode.1` 及更早安装包仍内置私有主仓库 endpoint，无法自动发现本版本，需要手动下载安装一次；安装本版本之后，后续更新会从公开 release-only 仓库获取。

## 下载

前往 [GitHub Releases](https://github.com/HereditaryDog/gaster-code-releases/releases) 下载对应平台的安装包：

| 平台 | 文件 |
|------|------|
| macOS (Apple Silicon) | `Gaster-Code_1.0.9_macos_arm64_dmg.dmg` |
| macOS (Intel) | `Gaster-Code_1.0.9_macos_x64_dmg.dmg` |
| Windows x64 | `Gaster-Code_1.0.9_windows_x64_nsis.exe` |
| Linux x64 | `Gaster-Code_1.0.9_linux_x64_deb.deb` |

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

桌面端现在内置 G-Master API 账号中心，可在设置 → **个人设置** 查看余额、订阅状态、账单记录，并从桌面端发起充值或订阅。支付确认仍会打开 G-Master API 的安全收银台页面；桌面端不会保存支付密钥、银行卡信息或支付渠道密钥。

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
