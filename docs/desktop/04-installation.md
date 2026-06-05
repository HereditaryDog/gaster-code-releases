# 安装指南

当前稳定版本：**V 1.1.1**。

V 1.1.1 修复 Electron 正式安装包在 `file://` 打包环境下可能无法加载前端资源并显示“Gaster Code 启动失败”的问题。1.0.x Tauri 用户和已经安装 V 1.1.0 的用户都可以直接下载并覆盖安装。覆盖安装不会删除本地配置、G-Master 登录状态、会话记录或自定义服务商配置。安装本版本之后，后续更新会通过公开 release-only 仓库中的标准 `latest*.yml` updater metadata 获取。

## 下载

前往 [GitHub Releases](https://github.com/HereditaryDog/gaster-code-releases/releases) 下载对应平台的安装包：

| 平台 | 文件 |
|------|------|
| macOS (Apple Silicon) | `Gaster-Code-1.1.1-mac-arm64.dmg` |
| macOS (Intel) | `Gaster-Code-1.1.1-mac-x64.dmg` |
| Windows x64 | `Gaster-Code-1.1.1-win-x64.exe` |
| Linux x64 AppImage | `Gaster-Code-1.1.1-linux-x86_64.AppImage` |
| Linux x64 deb | `Gaster-Code-1.1.1-linux-amd64.deb` |
| Linux ARM64 AppImage | `Gaster-Code-1.1.1-linux-arm64.AppImage` |
| Linux ARM64 deb | `Gaster-Code-1.1.1-linux-arm64.deb` |

> 不确定 Mac 架构？点击左上角 Apple 菜单 → 关于本机，芯片为 Apple M 开头选 Apple Silicon，Intel 选 x64。

## macOS 安装

1. 双击 `.dmg` 文件，将 `Gaster Code.app` 拖入 `Applications` 文件夹
2. 首次打开时，进入 `Applications`，右键点击 `Gaster Code.app` → 选择「打开」→ 在弹窗中点击「打开」，仅需操作一次
3. 如果提示**“已损坏，无法打开”**、**“此文件已损坏”**或**“无法验证开发者”**，在终端执行：

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

## Linux 安装

- AppImage：下载后添加执行权限，再双击或从终端启动。
- deb：在 Debian/Ubuntu 系发行版中使用系统安装器或 `apt install ./Gaster-Code-1.1.1-linux-amd64.deb` 安装。

```bash
chmod +x Gaster-Code-1.1.1-linux-x86_64.AppImage
./Gaster-Code-1.1.1-linux-x86_64.AppImage
```

## 首次启动

打开 Gaster Code 后会看到欢迎页：

1. 选择 **使用 G-Master API 账号登录**：跳转到 G-Master API 网页授权，成功后桌面端自动同步官方默认服务商。
2. 选择 **注册 G-Master 账号**：跳转到 G-Master API 注册页，注册完成后继续桌面授权流程。
3. 选择 **使用自定义模型服务商**：进入设置页，自行配置 Anthropic / OpenAI 兼容服务商。

桌面端内置 G-Master API 账号中心，可在设置 → **个人设置** 查看余额、订阅状态、账单记录，并从桌面端发起充值或订阅。支付确认仍会打开 G-Master API 的安全收银台页面；桌面端不会保存支付密钥、银行卡信息或支付渠道密钥。

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

**Q: macOS 提示“来自身份不明的开发者”？**

右键点击应用 → 选择「打开」→ 在弹窗中点击「打开」，仅需操作一次。

**Q: Windows 是否还需要单独安装 WebView2？**

不需要。V 1.1.0 开始桌面端使用 Electron 内置 Chromium，Windows 不再依赖系统 WebView2 运行时。

**Q: 从 1.0.x 或 1.1.0 升级到 1.1.1 会清空本地数据吗？**

不会。覆盖安装不会删除本地配置、G-Master 登录状态、会话记录、自定义服务商配置或本地项目文件。
