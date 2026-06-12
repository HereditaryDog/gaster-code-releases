# Gaster Code 前端开发规范

本文档用于前端接手和日常开发，范围聚焦 `desktop/` 下的 React/Tauri 桌面端。它分为两部分：先帮助新人快速读懂项目，再给出开发、测试和 PR 的硬性约定。

## 1. 快速接手

### 1.1 技术栈

- 应用形态：Tauri 2 桌面应用，前端由 Vite 承载。
- UI 框架：React 18 + TypeScript。
- 样式：Tailwind CSS v4 + `desktop/src/theme/globals.css` 中的设计 token。
- 状态管理：Zustand。
- 测试：Vitest + Testing Library，环境为 `jsdom`。
- 图标与字体：项目自托管字体，`globals.css` 内声明 Inter、Manrope、JetBrains Mono、Material Symbols。

### 1.2 推荐本地启动方式

首次拉取后先安装依赖：

```bash
bun install
cd desktop
bun install
```

开发桌面前端时，通常需要两个进程：

```bash
# 终端 1：启动本地 API/WebSocket 服务
SERVER_PORT=3456 bun run src/server/index.ts

# 终端 2：启动 desktop 前端
cd desktop
bun run dev
```

桌面前端默认 Vite 端口是 `1420`，配置见 `desktop/vite.config.ts`。如果需要完整 Tauri 壳，请在 `desktop/` 下使用 Tauri 相关命令。

### 1.3 前端目录地图

`desktop/src` 是前端主目录，主要分工如下：

- `main.tsx`：前端入口，负责全局样式、迁移、主题初始化、诊断捕获和 React 挂载。
- `App.tsx`：应用根组件，挂载通知导航、定时任务通知等全局副作用，并渲染 `AppShell`。
- `components/layout/`：应用框架、侧边栏、标题栏、状态栏、路由容器等布局组件。
- `components/shared/`：通用 UI 组件，例如 `Button`、`Input`、`Modal`、`Dropdown`、`Toast`。
- `components/chat/`：会话输入、消息列表、工具调用展示、代码展示、权限弹窗等聊天核心 UI。
- `components/controls/`：模型选择、权限模式选择等可复用业务控件。
- `pages/`：页面级组件，例如设置页、会话页、任务页、工作区页面。
- `stores/`：Zustand store，维护客户端状态和跨组件动作。
- `api/`：HTTP/WebSocket 客户端与具体 API 模块，统一从服务端取数或提交变更。
- `lib/`：纯逻辑、运行时适配、通知、迁移、格式化等工具。
- `hooks/`：跨组件复用的 React hook。
- `types/`：共享 TypeScript 类型。
- `i18n/`：中英文文案和翻译入口。
- `theme/globals.css`：全局字体、Tailwind theme token、语义色、暗色主题和少量全局样式。

## 2. 开发原则

### 2.1 先跟随现有边界

新增功能时优先放在已有边界内：

- 需要访问后端接口：先在 `desktop/src/api/` 新增或扩展 API 方法。
- 需要跨页面共享状态：放到 `desktop/src/stores/`，由组件订阅必要字段。
- 只属于某个页面的临时 UI 状态：保留在页面或局部组件里。
- 可复用的视觉组件：放到 `components/shared/` 或已有业务组件目录。
- 页面级组合：放到 `pages/`，避免把大量业务逻辑塞进 `App.tsx` 或 `AppShell`。

不要为了一个小功能新建抽象层。只有当同类逻辑已经出现两到三次，或组件职责明显变重时，再提取复用模块。

### 2.2 数据流顺序

推荐的数据流是：

```text
UI 组件 -> Zustand store action -> api 模块 -> 本地服务端
        <- store state update <- api response <-
```

组件不应直接拼接大量 `fetch` 逻辑。跨组件共享的异步行为应放进 store action 或 `api/` 模块，组件只关心调用动作、展示 loading、错误和结果。

### 2.3 错误处理

- API 层统一使用 `desktop/src/api/client.ts` 提供的 `api.get/post/put/patch/delete`。
- 需要识别服务端错误时，捕获 `ApiError`，读取 `status` 和 `body`。
- store action 中做乐观更新时，必须保存旧值，并在失败时回滚。
- UI 不要静默吞掉用户可感知错误。可以写入 toast、错误提示或页面内错误状态。
- 诊断类错误要避免泄漏 token、API key、用户输入中的敏感内容。

## 3. TypeScript 与代码风格

### 3.1 基本格式

- 使用 TypeScript 严格模式，配置见 `desktop/tsconfig.json`。
- 使用 2 空格缩进。
- 使用 ESM import/export。
- 不写分号，保持仓库现有风格。
- React 组件使用 `PascalCase`，函数、变量、hook、store action 使用 `camelCase`。
- 文件名保持描述性，例如 `SessionTaskBar.tsx`、`providerStore.ts`、`desktopNotifications.ts`。
- 优先使用 `@/` 别名引用 `desktop/src` 内模块，避免很长的相对路径；同目录或近邻文件可以保留相对引用。

### 3.2 类型约定

- 业务对象类型放在 `desktop/src/types/`，API 返回类型可与对应 `api/` 模块相邻，但被多处使用时应提升到 `types/`。
- 不使用 `any` 作为默认逃生口。必须处理未知结构时使用 `unknown`，再做类型收窄。
- 避免把服务端返回对象直接散落到组件内使用；必要时在 API 层或 store 层做 normalize。
- `noUncheckedIndexedAccess` 已开启，数组和 map 读取要处理 `undefined`。

### 3.3 React 组件

- 组件应优先是纯渲染：props 输入清晰，副作用放到 hook 或 store action。
- 页面组件可以组合业务逻辑，但超过一个屏幕的复杂表单、列表项、弹窗应拆成局部组件。
- `useEffect` 只用于同步外部系统、订阅、定时器、初始化请求等副作用；不要用它替代可计算的 `useMemo` 或事件处理。
- 事件处理函数命名使用 `handleXxx`，传给子组件的回调用 `onXxx`。
- 列表渲染必须使用稳定 key，不能用数组下标作为可变列表 key。

## 4. 状态管理规范

### 4.1 Store 边界

Zustand store 应按业务域拆分，例如 settings、providers、sessions、tasks、workspace。新增 store 前先确认是否能归入现有业务域。

store 中建议包含：

- 状态字段：当前数据、loading、error、选择态等。
- action：请求、创建、更新、删除、切换等行为。
- normalize/helper：仅限与该 store 强相关的小函数。

store 中不建议包含：

- JSX 或组件渲染逻辑。
- 复杂 DOM 事件。
- 与多个业务域强耦合的大型流程。此类逻辑应拆到 `lib/` 或更明确的服务模块。

### 4.2 更新策略

- 用户交互需要即时反馈时可以乐观更新，但失败必须回滚。
- 多个异步保存可能并发时，要像 `settingsStore` 的通知保存队列一样避免旧请求覆盖新状态。
- store reset 测试时使用 `getInitialState()`，保持测试互不污染。

## 5. API 与服务端交互

- 每类接口放到独立文件，例如 `settings.ts`、`models.ts`、`providers.ts`。
- API path 统一写在 `api/` 模块内，不在组件中散落字符串。
- 请求超时使用 `api` 客户端提供的 options；长耗时接口要明确设置 timeout。
- WebSocket 相关逻辑走 `desktop/src/api/websocket.ts` 和已有 store，不要在组件里重复创建连接。
- 涉及 Tauri runtime 的能力必须通过 `lib/desktopRuntime.ts` 等适配层判断，避免浏览器开发环境直接崩溃。

## 6. UI 与样式规范

### 6.1 设计 token 优先

颜色、边框、阴影、字号族优先使用 `globals.css` 中定义的 CSS 变量，例如：

```tsx
<div className="bg-[var(--color-surface)] text-[var(--color-text-primary)] border border-[var(--color-border)]" />
```

不要在业务组件里随意新增硬编码颜色。确实需要新增语义色时，先在 `globals.css` 定义 token，再在组件里引用。

### 6.2 组件复用

- 按钮优先使用 `components/shared/Button.tsx`。
- 输入框、文本域、弹窗、下拉菜单优先使用 `components/shared/` 现有组件。
- 新增共享组件时要覆盖常用状态：默认、hover、focus、disabled、loading、错误态。
- 图标按钮必须有可访问名称，可以使用 `aria-label` 或可见文本。

### 6.3 布局

- 桌面应用界面应偏工作台风格：信息密度适中、层级清晰、可扫描，不做营销页式大 hero。
- 页面级容器负责滚动边界，局部组件不要随意设置全屏滚动。
- 固定格式 UI，例如侧栏项、工具按钮、输入区、表格行，要设置稳定尺寸，避免加载、hover、文案变化造成布局跳动。
- 文案可能变长的位置必须考虑中文和英文双语长度。

### 6.4 国际化

- 用户可见文案应放到 `desktop/src/i18n/locales/zh.ts` 和 `en.ts`。
- 不在组件内硬编码中英文混合文案，调试日志和开发注释除外。
- 新增文案时同时补齐中英文 key，确保 `useTranslation()` 能稳定读取。

## 7. 测试规范

### 7.1 什么时候必须补测试

以下变更必须补或改测试：

- store action、API normalize、数据迁移、权限逻辑。
- 聊天输入、消息渲染、工具调用、任务调度、设置保存等核心交互。
- 修复已知 bug，必须添加能复现该 bug 的回归测试。
- 涉及主题、i18n、通知、Tauri runtime 适配的条件分支。

纯样式微调可以不新增测试，但 PR 描述里要说明验证方式。

### 7.2 测试写法

- 组件测试使用 Testing Library，从用户行为出发：`render`、`screen.getByRole`、`fireEvent`、`waitFor`。
- mock API 和 WebSocket 时使用 `vi.mock`，尽量 mock 模块边界，不 mock 组件内部实现。
- 每个测试前清理 mock，并 reset 相关 Zustand store。
- 测试文件命名为 `*.test.ts` 或 `*.test.tsx`。
- 单文件强相关测试可与被测文件放在同目录；跨页面或综合场景放在 `desktop/src/__tests__/`。

### 7.3 常用验证命令

开发中先跑窄范围：

```bash
cd desktop
bun run lint
bun run test -- --run
bun run build
```

准备 PR 或交付前，从仓库根目录跑桌面检查：

```bash
bun run check:desktop
```

如果改动影响核心聊天、agent loop、工具执行、provider routing 或桌面端会话流程，还应按 `AGENTS.md` 的质量门禁要求运行相应 quality gate。

## 8. Git 与 PR 规范

### 8.1 分支和提交

- 分支名使用 `feat/xxx`、`fix/xxx`、`docs/xxx` 等产品前缀。
- 不使用 `codex/` 前缀。
- 提交信息使用 Conventional Commit，例如 `feat: add provider settings form`、`fix: restore chat input mention chip`。
- 一次提交只表达一个可 review 的变化。

### 8.2 PR 内容

PR 描述必须包含：

- 用户可见变化。
- 主要实现点。
- 验证命令和结果。
- UI 变化截图或录屏。
- 已知风险或后续工作。

不要在未运行对应检查时写“已完成”“可合并”“可发布”。如果检查无法运行，要写明阻塞原因。

## 9. 新功能落地检查清单

开发前：

- [ ] 确认功能属于哪个页面、store、API 域。
- [ ] 查找是否已有共享组件、hook、store action 可复用。
- [ ] 明确用户可见文案是否需要 i18n。

开发中：

- [ ] 组件只处理展示和局部交互。
- [ ] API 请求集中在 `api/` 与 store action。
- [ ] 样式使用现有 token 和共享组件。
- [ ] loading、empty、error、disabled 状态完整。
- [ ] 中英文文案长度都不会破坏布局。

提交前：

- [ ] 新增或修改必要测试。
- [ ] `cd desktop && bun run lint` 通过。
- [ ] `cd desktop && bun run test -- --run` 通过。
- [ ] `cd desktop && bun run build` 通过。
- [ ] 桌面核心路径变更已运行 `bun run check:desktop` 或说明无法运行的原因。
- [ ] PR 中附上截图、验证命令和风险说明。

## 10. 常见开发场景放置建议

| 场景 | 推荐位置 |
| --- | --- |
| 新增设置页 tab | `desktop/src/pages/Settings.tsx` 拆局部组件，必要时扩展 `stores/settingsStore.ts` |
| 新增后端接口调用 | `desktop/src/api/<domain>.ts`，共享类型放 `desktop/src/types/` |
| 新增聊天消息展示块 | `desktop/src/components/chat/` |
| 新增全局弹窗或基础控件 | `desktop/src/components/shared/` |
| 新增页面级功能 | `desktop/src/pages/`，再按需要拆到 `components/<domain>/` |
| 新增持久化迁移 | `desktop/src/lib/persistenceMigrations.ts` 并补测试 |
| 新增主题 token | `desktop/src/theme/globals.css`，同时考虑 light/dark |
| 新增中英文文案 | `desktop/src/i18n/locales/zh.ts` 和 `desktop/src/i18n/locales/en.ts` |

## 11. 接手优先阅读顺序

建议按下面顺序读代码：

1. `AGENTS.md`：仓库级约定和质量门禁。
2. `desktop/package.json`：前端脚本和依赖。
3. `desktop/src/main.tsx`、`desktop/src/App.tsx`：入口和全局副作用。
4. `desktop/src/components/layout/AppShell.tsx`：主布局和页面路由入口。
5. `desktop/src/api/client.ts`：请求封装和错误处理。
6. `desktop/src/stores/settingsStore.ts`、`sessionStore.ts`、`chatStore.ts`：核心状态流。
7. `desktop/src/components/shared/Button.tsx`、`Modal.tsx`、`Input.tsx`：共享组件风格。
8. `desktop/src/theme/globals.css`：设计 token 和主题。
9. `desktop/src/components/chat/ChatInput.test.tsx` 等测试：学习项目测试写法。
