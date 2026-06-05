# 架构设计

> 从 Electron 窗口到 CLI 子进程，桌面端的三层通信架构。

---

## 技术栈

### 前端

| 技术 | 版本 | 职责 |
|------|------|------|
| React | 18 | UI 框架 |
| Zustand | 5 | 状态管理 |
| Vite | 6 | 构建工具 |
| Tailwind CSS | 4 | 样式 |
| Shiki | 4 | 代码高亮 |
| Mermaid | 11 | 图表渲染 |
| marked + DOMPurify | - | Markdown 渲染 |
| react-diff-viewer | 4 | Diff 展示 |
| Lucide React | - | 图标 |

### 桌面层

| 技术 | 版本 | 职责 |
|------|------|------|
| Electron | 42 | 跨平台桌面框架与 Chromium 运行时 |
| electron-updater | 6 | 自动更新与 `latest*.yml` metadata |
| node-pty | 1 | 窗口内终端 PTY |
| Electron IPC | - | 原生能力桥接、窗口、菜单、托盘、通知、对话框 |

### 服务端

| 技术 | 职责 |
|------|------|
| Bun | 运行时 + 构建工具 |
| Bun.serve | HTTP/WebSocket 服务器 |

### 字体

- **Inter** — 正文
- **Manrope** — 标题
- **JetBrains Mono** — 代码
- **Material Symbols Outlined** — 图标

---

## 三层架构

```
┌─────────────────────────────────────┐
│       Electron Main Process          │
│  ┌─────────────────────────────┐    │
│  │   Chromium (React App)      │    │  ← 用户界面
│  └───────────┬─────────────────┘    │
│              │ HTTP + WebSocket      │
│  ┌───────────▼─────────────────┐    │
│  │   Server Sidecar (Bun)      │    │  ← API 服务 + 会话管理
│  │   Port: 动态分配             │    │
│  └───────────┬─────────────────┘    │
│              │ 子进程 spawn          │
│  ┌───────────▼─────────────────┐    │
│  │   CLI 子进程                 │    │  ← AI 对话 + 工具执行
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   Adapter Sidecar (可选)    │    │  ← Telegram/飞书接入
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### 第一层：Electron Main Process

**职责**：窗口管理、Sidecar 进程编排、原生 API 桥接、终端 PTY、内置浏览器预览、菜单、托盘、通知和更新。

核心文件位于 `desktop/electron/`：

| 文件 | 说明 |
|------|------|
| `main.ts` | Electron 应用入口，注册窗口、IPC、sidecar、updater、terminal、preview |
| `preload.ts` | 主窗口安全 preload，暴露 `desktopHost` 所需 IPC 能力 |
| `preview-preload.ts` | Workbench/内置浏览器预览 preload |
| `services/serverRuntime.ts` | Server sidecar 启停、端口和代理环境 |
| `services/terminal.ts` | node-pty 终端会话管理 |
| `services/preview.ts` | `WebContentsView` 预览和截图/元素选择通道 |
| `services/updater.ts` | electron-updater 检查、下载和安装准备 |

前端生产代码通过 `desktop/src/lib/desktopHost/` 调用这些能力，不直接依赖 Electron 或旧 Tauri API。

**状态管理**：

| 服务 | 说明 |
|------|------|
| `ElectronServerRuntime` | 管理 server sidecar、adapter sidecar、H5 dist、代理环境和退出清理 |
| `ElectronTerminalService` | 管理窗口内 PTY 会话、resize、输入、输出和退出事件 |
| `ElectronPreviewService` | 管理 Workbench 预览视图、截图、元素选择和消息转发 |
| `ElectronUpdaterService` | 管理更新检查、代理、下载、安装准备和 app-update metadata |

**启动流程**：

1. `ElectronServerRuntime` 预留本地端口并启动 `claude-sidecar server --app-root ...`
2. sidecar 注入 `CLAUDE_CONFIG_DIR`、`GASTER_CODE_H5_DIST_DIR`、`GASTER_CODE_H5_AUTO_PUBLIC_URL` 等桌面运行环境
3. Electron 主窗口加载打包后的 React 应用或开发环境 Vite 地址
4. React renderer 通过 `desktopHost` 获取 server URL 并建立 HTTP/WebSocket 通信
5. Adapter sidecar 按配置启动，并注入 `ADAPTER_SERVER_URL`
6. 退出或更新安装前，main process 统一停止 server、adapter、terminal 和 preview 资源

**退出处理**：Electron `before-quit`、窗口生命周期和更新安装准备阶段会统一清理 sidecar、终端和预览视图。

**平台差异**：
- **macOS**：原生菜单、Dock/窗口生命周期、可选托盘、Developer ID 签名/公证时 Gatekeeper 检查
- **Windows**：自定义标题栏、AppUserModelId、NSIS 安装包、SmartScreen 由签名状态决定
- **Linux**：AppImage/deb 安装包、系统托盘和通知能力按桌面环境可用性启用

### 第二层：Server Sidecar

**职责**：HTTP REST API + WebSocket 网关 + 会话管理 + 协议代理

核心文件 `src/server/`（项目根目录），分层结构：

```
src/server/
├── index.ts              # 入口
├── server.ts             # HTTP 服务器
├── router.ts             # 路由注册
├── sessionManager.ts     # 会话管理器
├── api/                  # REST 路由层 (14 个模块)
├── services/             # 业务服务层 (14 个模块)
├── ws/                   # WebSocket 处理
├── proxy/                # API 代理（Anthropic/OpenAI 协议转换）
├── middleware/            # auth、cors、errorHandler
└── config/               # Provider 预设
```

### 第三层：CLI 子进程

**职责**：AI 对话核心、工具执行、Agent 编排

Server 为每个 Session spawn 一个 CLI 子进程，通过 stdin/stdout JSON 通信。

### Sidecar 构建

使用 Bun 编译为独立二进制（`desktop/scripts/build-sidecars.ts`）：

三种模式共用一个入口 `desktop/sidecars/claude-sidecar.ts`：
- `server` — 启动 HTTP/WS 服务
- `cli` — 启动 CLI 子进程
- `adapters` — 启动远程控制适配器（解析 `--feishu`/`--telegram` 参数，检查凭据后按需加载）

编译产物放置在 `desktop/src-tauri/binaries/`。该目录名为兼容历史打包结构保留，Electron Builder 通过 `asarUnpack` 将其打入安装包。

---

## WebSocket 通信协议

### 连接地址

```
ws://127.0.0.1:{port}/ws/{sessionId}
```

前端通过 `WebSocketManager`（per-session 连接）管理，支持自动重连、消息队列缓冲、ping 心跳保活。

### 客户端 → 服务端

| type | 说明 |
|------|------|
| `user_message` | 用户消息（含 content, attachments） |
| `permission_response` | 权限审批（requestId, allowed, rule） |
| `set_permission_mode` | 切换权限模式 |
| `stop_generation` | 停止生成 |
| `ping` | 心跳 |

### 服务端 → 客户端

| type | 说明 |
|------|------|
| `connected` | 连接成功 |
| `status` | 状态变更（thinking/generating） |
| `content_start` / `content_delta` | 流式文本 |
| `thinking` | Extended Thinking |
| `tool_use_complete` | 工具调用就绪 |
| `tool_result` | 工具执行结果 |
| `permission_request` | 权限请求 |
| `message_complete` | 消息完成（含 Token 统计） |
| `error` | 错误通知 |
| `session_title_updated` | 标题更新 |
| `team_update` / `team_created` / `team_deleted` | 团队事件 |
| `task_update` | 任务变更 |
| `pong` | 心跳响应 |

### 连接管理

- **心跳**：30s 间隔 ping/pong
- **重连**：指数退避 `min(1000ms × 2^n, 30000ms)`，最多 10 次
- **缓冲**：未连接时消息暂存队列，恢复后自动发送

---

## HTTP API

### 会话

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/sessions` | 列表（支持 project/limit/offset 筛选） |
| `POST` | `/api/sessions` | 创建 |
| `GET` | `/api/sessions/:id/messages` | 历史消息 |
| `PATCH` | `/api/sessions/:id` | 重命名 |
| `DELETE` | `/api/sessions/:id` | 删除 |
| `GET` | `/api/sessions/:id/git-info` | Git 信息 |
| `GET` | `/api/sessions/:id/slash-commands` | 可用斜杠命令 |
| `GET` | `/api/sessions/recent-projects` | 最近项目 |

### 模型与提供商

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET/PUT` | `/api/models/current` | 当前模型 |
| `GET` | `/api/models` | 可用模型列表 |
| `GET/PUT` | `/api/effort` | Effort 级别 |
| `GET/POST/PUT/DELETE` | `/api/providers` | 提供商 CRUD |
| `POST` | `/api/providers/:id/activate` | 激活 |
| `POST` | `/api/providers/:id/test` | 测试连接 |
| `GET` | `/api/providers/presets` | 预设列表 |

### 定时任务

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET/POST/PUT/DELETE` | `/api/scheduled-tasks` | 任务 CRUD |
| `POST` | `/api/scheduled-tasks/:id/run` | 手动运行 |
| `GET` | `/api/scheduled-tasks/runs` | 运行记录 |

### 其他

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/teams` | Agent 团队 |
| `GET` | `/api/teams/:name/members/:agentId/transcript` | 成员转录 |
| `GET` | `/api/agents` | Agent 定义 |
| `GET` | `/api/skills` | 技能列表 |
| `GET/PUT` | `/api/adapters` | 适配器配置 |
| `GET/PUT` | `/api/settings/user` | 用户设置 |
| `GET/PUT` | `/api/permissions/mode` | 权限模式 |
| `GET` | `/api/tasks/lists` | CLI 任务清单 |
| `GET` | `/health` | 健康检查 |

---

## 状态管理

使用 Zustand，按领域拆分为 12 个 Store：

| Store | 核心状态 |
|-------|----------|
| `chatStore` | per-session 消息、流式状态、权限请求、Token 统计 |
| `sessionStore` | 会话列表、activeSessionId、项目筛选 |
| `tabStore` | 标签页顺序（localStorage 持久化） |
| `settingsStore` | 权限模式、当前模型、effort、语言 |
| `providerStore` | Provider 列表、activeId |
| `uiStore` | 主题、侧边栏、activeView、Toast、设置标签页 |
| `taskStore` | 定时任务、运行记录 |
| `teamStore` | 团队列表、成员转录轮询 |
| `agentStore` | Agent 定义列表 |
| `skillStore` | 技能元数据、详情 |
| `adapterStore` | 适配器配置、配对码 |
| `cliTaskStore` | per-session CLI 任务追踪 |

### 数据流

```
用户操作 → Component → Store → API/WebSocket → Server → Store → Component 重渲染
```

### 持久化

| 数据 | 存储 |
|------|------|
| 标签页状态 | `localStorage` |
| 语言偏好 | `localStorage` |
| 会话数据 | Server JSONL (`~/.claude/sessions/`) |
| 设置 | Server API |
| 适配器配置 | `~/.claude/adapters.json` |

---

## 协议代理层

Server 内置代理层（`src/server/proxy/`），统一不同 AI 提供商的 API 格式。

### 支持格式

| 格式 | 典型提供商 |
|------|-----------|
| `anthropic` | Anthropic、OpenRouter、MiniMax |
| `openai_chat` | OpenAI、DeepSeek、Ollama |
| `openai_responses` | OpenAI Responses API |

### 模型映射

每个 Provider 配置 4 个模型槽位：`main`、`haiku`、`sonnet`、`opus`，前端按槽位名调用，代理层自动映射为实际模型名。

---

## 适配器架构

适配器系统让 Telegram/飞书等 IM 平台接入 Gaster Code。

```
IM 平台 → Adapter 进程 → HTTP + WebSocket → Server → CLI
```

### 共享模块 `adapters/common/`

| 模块 | 职责 |
|------|------|
| `config.ts` | 配置加载（env > JSON > 默认值） |
| `ws-bridge.ts` | WebSocket 桥接（心跳、重连、消息路由） |
| `pairing.ts` | 用户配对（6 位安全码、速率限制） |
| `session-store.ts` | Chat → Session 映射持久化 |
| `message-buffer.ts` | 流式缓冲（500ms / 200 字符阈值） |
| `message-dedup.ts` | 消息去重 |
| `chat-queue.ts` | 同一 Chat 消息串行队列 |
| `http-client.ts` | HTTP 客户端 |

### 分片限制

- Telegram: 4000 字符/消息
- 飞书: 30000 字符/消息

---

## 项目目录结构

```
desktop/
├── src/                              # React 前端
│   ├── api/                         #   API 客户端 (15 个模块)
│   ├── components/
│   │   ├── layout/                  #   AppShell, Sidebar, TabBar, TitleBar,
│   │   │                            #   WindowControls, StatusBar, ContentRouter,
│   │   │                            #   ProjectFilter
│   │   ├── chat/                    #   ChatInput, MessageList, AssistantMessage,
│   │   │                            #   ToolCallBlock, ToolCallGroup, ThinkingBlock,
│   │   │                            #   PermissionDialog, CodeViewer, DiffViewer,
│   │   │                            #   ImageGalleryModal, StreamingIndicator ...
│   │   ├── shared/                  #   Button, Modal, Toast, Spinner,
│   │   │                            #   UpdateChecker, DirectoryPicker ...
│   │   ├── controls/                #   ModelSelector, PermissionModeSelector
│   │   ├── markdown/                #   MarkdownRenderer, MermaidRenderer
│   │   ├── skills/                  #   SkillList, SkillDetail
│   │   ├── tasks/                   #   TaskList, TaskRow, NewTaskModal,
│   │   │                            #   DayOfWeekPicker, PromptEditor ...
│   │   └── teams/                   #   TeamStatusBar
│   ├── pages/                       #   ActiveSession, EmptySession, Settings,
│   │                                #   AdapterSettings, AgentTeams, ScheduledTasks,
│   │                                #   ComputerUseSettings, ToolInspection ...
│   ├── stores/                      #   12 个 Zustand store
│   ├── types/                       #   TypeScript 类型 (9 个模块)
│   ├── hooks/                       #   useKeyboardShortcuts
│   ├── i18n/                        #   中/英 国际化
│   ├── config/                      #   providerPresets, spinnerVerbs
│   └── lib/                         #   desktopRuntime, cronDescribe, parseRunOutput
├── src-tauri/
│   ├── src/main.rs                  #   入口
│   ├── src/lib.rs                   #   核心（~415 行）
│   ├── Cargo.toml
│   └── tauri.conf.json
├── sidecars/
│   └── claude-sidecar.ts            #   统一入口 (server/cli/adapters)
└── scripts/
    ├── build-sidecars.ts
    ├── build-macos-arm64.sh
    └── build-windows-x64.ps1

src/server/                           # 服务端（项目根目录）
├── api/                             #   REST 路由 (14 个模块)
├── services/                        #   业务服务 (14 个模块)
├── ws/                              #   WebSocket 处理
├── proxy/                           #   协议代理转换
├── middleware/                      #   auth, cors, errorHandler
└── config/                          #   Provider 预设

adapters/                             # 远程控制适配器
├── common/                          #   共享模块 (8 个)
├── telegram/                        #   Telegram Bot
└── feishu/                          #   飞书 Bot
```
