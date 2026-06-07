# Gaster Code 前端开发规范（v1.1.1）

本文档用于前端接手和日常开发，基于 `v1.1.1` 的真实代码结构编写。当前团队分工是：我们负责前端体验、桌面端 UI、浏览器/H5 运行时兼容和前端测试；后端接口、本地服务、agent loop、provider/MCP/OAuth 等服务端能力由后端同事负责。前端改动应尊重现有接口契约，不在前端绕过或重写后端业务规则。

## 1. 项目定位

### 1.1 前端技术栈

- 应用形态：桌面应用前端，Vite 承载开发页面，Electron 为主要桌面壳；仓库中仍保留 Tauri 配置与兼容依赖。
- UI 框架：React 18 + TypeScript。
- 样式：Tailwind CSS v4 + `desktop/src/theme/globals.css` 中的设计 token。
- 状态管理：Zustand。
- 测试：Vitest + Testing Library，环境为 `jsdom`。
- 桌面能力抽象：`desktop/src/lib/desktopHost/`，通过 Electron host 或浏览器 fallback 暴露统一能力。
- API 通信：`desktop/src/api/client.ts` 统一管理 base URL、token、timeout、错误和诊断上报。

### 1.2 前端负责范围

前端团队主要负责：

- `desktop/src/` 下的 React 页面、组件、stores、hooks、API client、样式、i18n 和前端测试。
- `desktop/vite.config.ts`、`desktop/tsconfig.json` 等前端构建配置。
- `desktop/electron/`、`desktop/src/lib/desktopHost/` 中和 UI/桌面能力桥接强相关的前端契约，改动前需要确认不会影响打包和原生能力。
- `docs/` 中面向前端接手、UI 行为、开发流程的文档。

默认不由前端单独修改：

- `src/server/`、`src/services/`、`src/tools/`、`src/entrypoints/` 等本地服务和 CLI/agent 核心逻辑。
- provider、MCP、OAuth、工具执行、质量门禁、release 脚本等后端或平台能力。
- 原生打包、sidecar、Electron 主进程发布流程，除非本次需求明确涉及 UI 和桌面 host 协议。

如果一个前端需求需要后端新接口或接口字段变化，先写清楚前端期望的数据结构、loading/error/empty 行为，再和后端同事对齐 API 契约。

## 2. 本地启动

### 2.1 版本与依赖

本规范对应 tag `v1.1.1`。推荐在隔离 worktree 中开发，避免影响其他版本现场：

```bash
git fetch origin tag v1.1.1
git worktree add _worktrees/gaster-code-v1.1.1-frontend -b feat/v1.1.1-frontend v1.1.1
```

首次进入工作区后安装依赖：

```bash
bun install
cd desktop
bun install
```

如果本机 `bun` 不在默认 `PATH`，本机已验证可用路径是：

```bash
PATH=/Users/jack/.local/bun-1.3.12/bun-darwin-aarch64:$PATH
```

### 2.2 只启动前端页面

纯前端开发时，通常需要本地后端服务提供 health、settings、sessions 等接口：

```bash
# 终端 1：仓库根目录，启动本地 API/WebSocket 服务
SERVER_PORT=3456 bun run src/server/index.ts

# 终端 2：desktop 目录，启动 Vite 前端
cd desktop
bun run dev
```

Vite 默认端口为 `1420`，配置见 `desktop/vite.config.ts`。浏览器访问：

```text
http://127.0.0.1:1420
```

浏览器运行时会走 `desktop/src/lib/desktopRuntime.ts`：它先检查 `/health`，再根据本地服务是否要求 H5 token 决定展示主界面或 H5 连接页。前端页面空白时，先确认 `http://127.0.0.1:3456/health` 返回 `{"status":"ok"}`。

### 2.3 桌面壳开发

涉及 Electron host、窗口控制、终端、预览 webview、通知、更新等能力时，在 `desktop/` 下使用 Electron 开发脚本：

```bash
cd desktop
bun run electron:dev
```

只改普通页面和组件时，优先使用 `bun run dev` 加浏览器验证；只有涉及 native host 能力时才进入 Electron 壳验证。

## 3. 目录边界

`desktop/src` 是前端主目录，按以下边界维护：

| 路径 | 职责 |
| --- | --- |
| `main.tsx` | bootstrap 入口，负责主题、诊断捕获、持久化迁移、React 挂载。 |
| `App.tsx` | 根组件，挂载全局副作用并渲染 `AppShell`。 |
| `components/layout/` | 应用框架、侧边栏、标题栏、状态栏、路由容器。 |
| `components/shared/` | 通用 UI 组件，例如 `Button`、`Input`、`Modal`、`Dropdown`、`Toast`。 |
| `components/chat/` | 会话输入、消息列表、工具调用、权限弹窗、图片展示等聊天核心 UI。 |
| `components/workspace/` | 工作区文件、diff、预览、打开方式等 UI。 |
| `components/browser/` | 预览 webview 和浏览器区域计算相关逻辑。 |
| `components/account/`、`components/settings/`、`components/tasks/` 等 | 业务域组件，服务于对应页面或设置模块。 |
| `pages/` | 页面级组合，例如 `ActiveSession`、`Settings`、`Drawing`、`ScheduledTasks`。 |
| `stores/` | Zustand store，维护跨组件状态和业务动作。 |
| `api/` | HTTP/WebSocket 客户端与接口模块。组件不得绕过这里直接散落请求。 |
| `lib/` | 纯逻辑、运行时适配、迁移、通知、格式化、preview bridge 等工具。 |
| `lib/desktopHost/` | Electron 与浏览器 fallback 的桌面能力抽象。 |
| `preview-agent/` | 预览页面注入脚本和选择器/截图协议。 |
| `hooks/` | 可复用 React hook。 |
| `types/` | 共享 TypeScript 类型。 |
| `i18n/` | 中英文文案和翻译入口。 |
| `theme/globals.css` | 全局字体、Tailwind theme token、语义色、暗色主题和少量全局样式。 |

新增文件前先找同域已有模块。除非功能确实形成新的业务边界，不要新增并列目录。

## 4. 架构与数据流

### 4.1 推荐数据流

```text
UI component
  -> store action or local event handler
  -> desktop/src/api/<domain>.ts
  -> desktop/src/api/client.ts
  -> local backend service
  <- normalized data or ApiError
  <- store state update
  <- UI loading/error/empty/result
```

组件不直接拼接大量 `fetch`。跨组件共享的异步行为放进 store action；仅某个组件私有的一次性请求可以写在局部 hook，但仍应复用 `api/` 模块。

### 4.2 Store 边界

Zustand store 按业务域拆分，例如 `sessionStore`、`chatStore`、`settingsStore`、`providerStore`、`workspacePanelStore`。store 中可以包含：

- 状态字段：data、loading、error、selection、filter。
- action：fetch、create、update、delete、toggle、reset。
- 与该 store 强相关的小型 normalize/helper。

store 中不要包含 JSX、DOM 事件细节、样式判断或跨多个业务域的大流程。跨域流程应拆到 `lib/`，再由 store 调用。

### 4.3 API 契约

- 每类接口放到独立文件，例如 `sessions.ts`、`settings.ts`、`providers.ts`。
- API path 只写在 `api/` 模块内，不在组件中散落字符串。
- 所有请求使用 `api.get/post/put/patch/delete`，需要识别错误时捕获 `ApiError`。
- 长耗时接口要显式设置 timeout。图片生成、诊断导出等操作必须有用户可见的等待和失败状态。
- WebSocket 逻辑走 `desktop/src/api/websocket.ts` 和现有 store，不在组件中重复创建连接。
- 前端不要假设后端字段永远存在；跨版本字段要 normalize，并为缺失值提供兼容 UI。

### 4.4 桌面 host 边界

所有原生能力必须通过 `getDesktopHost()` 或相关适配层进入：

- Electron-only 能力先检查 `host.capabilities.<feature>`。
- 浏览器 fallback 下不可用的能力要降级、隐藏入口或展示明确提示。
- 不在普通组件中直接访问 `window.desktopHost`，除非正在维护 `desktopHost` 适配层本身。
- 改动 `desktopHost/types.ts` 时，同步维护 `browserHost`、Electron preload/main 对应实现和契约测试。

## 5. React 与 TypeScript 规范

### 5.1 代码风格

- TypeScript + ESM imports。
- 2 空格缩进。
- 不写分号，保持仓库现有风格。
- React 组件使用 `PascalCase`。
- 函数、变量、hook、store action 使用 `camelCase`。
- 文件名保持描述性，例如 `SessionTaskBar.tsx`、`providerStore.ts`、`desktopNotifications.ts`。
- 优先使用 `@/` 别名引用 `desktop/src` 内模块；同目录或近邻文件可以保留相对引用。

### 5.2 类型约定

- 共享业务类型放在 `desktop/src/types/`。
- API 私有返回类型可以和对应 `api/` 模块相邻；被多个模块使用时提升到 `types/`。
- 不把 `any` 作为默认逃生口。必须处理未知结构时使用 `unknown`，再做类型收窄。
- `noUncheckedIndexedAccess` 已开启，数组、map、record 读取必须处理 `undefined`。
- 服务端返回对象不要直接散落到组件深处；必要时在 API 层或 store 层 normalize。

### 5.3 组件约定

- 组件优先是纯渲染：props 输入清晰，副作用放到 hook 或 store action。
- 页面组件负责组合，不承载过多细节。复杂表单、列表项、弹窗、工具栏应拆成局部组件。
- `useEffect` 只用于同步外部系统、订阅、定时器、初始化请求等副作用。
- 能由 props/state 直接计算的内容用普通变量或 `useMemo`，不要用 `useEffect + setState` 绕一圈。
- 事件处理函数命名为 `handleXxx`，传给子组件的回调用 `onXxx`。
- 列表使用稳定 key，不用数组下标作为可变列表 key。
- 异步按钮必须覆盖 loading、disabled、失败恢复。

## 6. UI 与样式

### 6.1 设计 token 优先

颜色、边框、阴影、字号族优先使用 `globals.css` 中的 CSS 变量：

```tsx
<div className="bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)]" />
```

不要在业务组件里随意新增硬编码颜色。确实需要新增语义色时，先在 `globals.css` 定义 token，并同时考虑浅色和深色主题。

### 6.2 共享组件优先

- 按钮优先使用 `components/shared/Button.tsx`。
- 输入框、文本域、弹窗、下拉菜单、toast 优先使用 `components/shared/`。
- 新增共享组件时覆盖默认、hover、focus、disabled、loading、错误态。
- 图标按钮必须有可访问名称，可以使用 `aria-label` 或可见文本。
- 工具按钮优先使用已有图标体系；不要用文字按钮代替常见图标操作。

### 6.3 布局原则

- 桌面应用是工作台，不做营销页式 hero 和大装饰卡片。
- 页面级容器负责滚动边界，局部组件不要随意设置全屏滚动。
- 固定格式 UI，例如侧栏项、工具按钮、输入区、表格行，要设置稳定尺寸，避免 loading、hover、文案变化造成布局跳动。
- 文案可能变长的位置必须考虑中文和英文双语长度。
- 不要嵌套卡片。重复项目、弹窗和真正需要框定的工具面板可以使用 card。
- 新增 UI 时必须检查浅色/深色主题、移动浏览器宽度和桌面宽度。

### 6.4 国际化

- 用户可见文案放到 `desktop/src/i18n/locales/zh.ts` 和 `en.ts`。
- 新增文案时同时补齐中英文 key。
- 组件中使用 `useTranslation()`，React 外使用 `t()`。
- 不在组件中硬编码中英文混合文案，调试日志和开发注释除外。

## 7. 错误、loading 与空状态

- 用户触发的异步操作必须有 loading 或 pending 反馈。
- 数据为空时展示 empty state，不留空白区域让用户猜。
- 用户可恢复的失败使用页面内错误、toast 或表单错误提示。
- store action 做乐观更新时，必须保存旧值并在失败时回滚。
- 诊断、错误上报和日志必须脱敏，不能泄漏 token、API key、checkout URL 或用户敏感输入。
- 对后端不可达、health 失败、H5 token 缺失等启动问题，优先复用 `H5ConnectionView` 和 `StartupErrorView`。

## 8. 测试规范

### 8.1 必须补测试的情况

以下变更必须补或更新测试：

- store action、API normalize、持久化迁移、权限逻辑。
- 聊天输入、消息渲染、工具调用、任务调度、设置保存等核心交互。
- `desktopHost`、Electron/browser fallback、preview bridge、terminal runtime。
- 主题、i18n、通知、H5 连接、启动错误等条件分支。
- 修复已知 bug 时，必须添加能复现该 bug 的回归测试。

纯样式微调可以不新增测试，但 PR 描述里要说明浏览器或桌面壳验证方式。

### 8.2 测试写法

- 组件测试使用 Testing Library，从用户行为出发：`render`、`screen.getByRole`、`fireEvent`、`waitFor`。
- mock API、WebSocket、desktop host 时 mock 模块边界，不 mock 组件内部实现。
- 每个测试前清理 mock，并 reset 相关 Zustand store。
- 测试文件命名为 `*.test.ts` 或 `*.test.tsx`。
- 单文件强相关测试可与被测文件放在同目录；跨页面或综合场景放在 `desktop/src/__tests__/`。

### 8.3 常用验证命令

开发中先跑窄范围：

```bash
cd desktop
bun run lint
bun run test -- --run
bun run build
```

准备交付前，从仓库根目录跑桌面检查：

```bash
bun run check:desktop
```

如果改动影响核心聊天、agent loop、工具执行、provider routing 或桌面端会话流程，还应按 `AGENTS.md` 的质量门禁要求运行对应 quality gate。没有可用 provider/key 时，运行非 live gate，并在交付说明中写清 live baseline 阻塞原因。

## 9. 前后端协作

前端和后端对齐接口时，至少确认：

- endpoint、method、request body、response body。
- loading、empty、error、permission denied、not found 的 UI 行为。
- 是否需要分页、轮询、WebSocket 事件或长 timeout。
- 字段是否可选，旧版本或失败情况下前端如何降级。
- 错误 body 是否包含稳定的 `message` 或错误码。

前端不在组件中写临时 mock 假装后端已完成。确实需要并行开发时，把 mock 放在测试或 `desktop/src/mocks/`，并确保生产路径仍走真实 API client。

## 10. Git 与 PR 规范

- 分支名使用 `feat/xxx`、`fix/xxx`、`docs/xxx` 等产品前缀。
- 本仓库不要使用 `codex/` 前缀。
- 提交信息使用 Conventional Commit，例如 `feat: add provider settings form`、`fix: restore chat input mention chip`。
- 一次提交只表达一个可 review 的变化。
- PR 描述包含用户可见变化、主要实现点、验证命令和结果、UI 截图或录屏、已知风险。
- 不提交 `artifacts/quality-runs/`、`.omx/`、`node_modules/`、`desktop/node_modules/`、adapter dependency folders。
- 未运行对应检查时，不写“已完成”“可合并”“可发布”；要写明阻塞原因。

## 11. 新功能落地检查清单

开发前：

- [ ] 确认功能属于哪个页面、store、API 域。
- [ ] 查找是否已有共享组件、hook、store action 可复用。
- [ ] 明确用户可见文案是否需要 i18n。
- [ ] 如果需要后端变化，先写清接口契约并同步后端同事。

开发中：

- [ ] 组件只处理展示和局部交互。
- [ ] API 请求集中在 `api/` 与 store action。
- [ ] 样式使用现有 token 和共享组件。
- [ ] loading、empty、error、disabled 状态完整。
- [ ] 中英文文案长度都不会破坏布局。
- [ ] 浏览器 fallback 与 Electron 能力差异已处理。

提交前：

- [ ] 新增或修改必要测试。
- [ ] `cd desktop && bun run lint` 通过。
- [ ] `cd desktop && bun run test -- --run` 通过。
- [ ] `cd desktop && bun run build` 通过。
- [ ] 桌面核心路径变更已运行 `bun run check:desktop` 或说明无法运行原因。
- [ ] PR 中附上截图、验证命令和风险说明。

## 12. 常见开发场景放置建议

| 场景 | 推荐位置 |
| --- | --- |
| 新增设置页 tab | `desktop/src/pages/Settings.tsx` 拆局部组件，必要时扩展 `stores/settingsStore.ts` |
| 新增后端接口调用 | `desktop/src/api/<domain>.ts`，共享类型放 `desktop/src/types/` |
| 新增聊天消息展示块 | `desktop/src/components/chat/` |
| 新增全局弹窗或基础控件 | `desktop/src/components/shared/` |
| 新增页面级功能 | `desktop/src/pages/`，再按需要拆到 `components/<domain>/` |
| 新增工作区文件操作 UI | `desktop/src/components/workspace/` 与 `stores/workspacePanelStore.ts` |
| 新增 desktop host 能力 | `desktop/src/lib/desktopHost/types.ts`、browser fallback、Electron host 实现和测试一起改 |
| 新增 preview webview 交互 | `desktop/src/preview-agent/`、`desktop/src/lib/previewBridge.ts`、相关 browser 组件 |
| 新增持久化迁移 | `desktop/src/lib/persistenceMigrations.ts` 并补测试 |
| 新增主题 token | `desktop/src/theme/globals.css`，同时考虑 light/dark |
| 新增中英文文案 | `desktop/src/i18n/locales/zh.ts` 和 `desktop/src/i18n/locales/en.ts` |

## 13. 接手优先阅读顺序

建议按下面顺序读代码：

1. `AGENTS.md`：仓库级约定和质量门禁。
2. `desktop/package.json`：前端脚本、Electron 脚本和依赖。
3. `desktop/vite.config.ts`：Vite 端口、别名和开发配置。
4. `desktop/src/main.tsx`、`desktop/src/App.tsx`：入口和全局副作用。
5. `desktop/src/components/layout/AppShell.tsx`、`ContentRouter.tsx`：启动流程、主布局和页面路由。
6. `desktop/src/lib/desktopRuntime.ts`：浏览器/H5/本地服务初始化逻辑。
7. `desktop/src/lib/desktopHost/`：Electron 与浏览器 fallback 能力边界。
8. `desktop/src/api/client.ts`：请求封装、timeout、错误处理和诊断脱敏。
9. `desktop/src/stores/settingsStore.ts`、`sessionStore.ts`、`chatStore.ts`：核心状态流。
10. `desktop/src/components/shared/Button.tsx`、`Modal.tsx`、`Input.tsx`：共享组件风格。
11. `desktop/src/theme/globals.css`：设计 token、字体和主题。
12. `desktop/src/__tests__/` 与同目录 `*.test.tsx`：学习项目测试写法。
