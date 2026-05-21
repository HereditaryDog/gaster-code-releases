import type { SettingsTab } from '../../stores/uiStore'

const BUILT_IN_SLASH_COMMAND_DESCRIPTIONS = {
  'add-dir': '添加新的工作目录',
  advisor: '配置顾问模型',
  agents: '管理 Agent 配置',
  branch: '从当前节点创建会话分支',
  brief: '切换简洁回复模式',
  buddy: '打开陪伴助手',
  bug: '报告问题',
  chrome: '打开 Chrome 扩展设置',
  clear: '清空对话历史',
  color: '设置本次会话提示栏颜色',
  commit: '创建 Git 提交',
  'commit-push-pr': '提交、推送并创建拉取请求',
  compact: '压缩对话上下文',
  config: '打开配置',
  context: '查看当前上下文用量',
  copy: '复制消息或代码块内容',
  cost: '查看本次会话用量和费用',
  desktop: '在桌面端继续当前会话',
  diff: '查看未提交变更和本轮差异',
  doctor: '诊断安装问题',
  effort: '设置模型推理强度',
  exit: '退出交互会话',
  export: '导出当前对话',
  'extra-usage': '配置额度用尽后的继续工作方式',
  fast: '切换快速模式',
  feedback: '提交反馈',
  files: '查看当前上下文中的文件',
  heapdump: '导出 JS 堆快照到桌面',
  help: '查看桌面端和 Agent 可用命令',
  hooks: '查看工具事件 Hook 配置',
  ide: '管理 IDE 集成并查看状态',
  init: '初始化项目 CLAUDE.md',
  'init-verifiers': '初始化验证器',
  insights: '生成会话分析报告',
  install: '安装原生构建',
  'install-github-app': '为仓库设置 GitHub Actions',
  'install-slack-app': '安装 Slack 应用',
  keybindings: '打开或创建快捷键配置',
  login: '切换 Anthropic 账号',
  logout: '退出当前账号',
  mcp: '查看当前聊天可用的 MCP 工具',
  memory: '编辑 CLAUDE.md 记忆文件',
  mobile: '显示移动端下载二维码',
  model: '切换 AI 模型',
  'output-style': '更改输出风格',
  passes: '查看通行记录',
  permissions: '查看或管理工具权限',
  plan: '开启计划模式或查看当前计划',
  plugin: '打开设置里的插件管理',
  'pr-comments': '获取 GitHub 拉取请求评论',
  pr: '创建拉取请求',
  'privacy-settings': '查看和更新隐私设置',
  'rate-limit-options': '查看达到限额后的可选操作',
  'release-notes': '查看发布说明',
  'reload-plugins': '激活当前会话中的插件变更',
  'remote-control': '连接此终端以进行远程控制',
  'remote-env': '配置远程环境默认值',
  rename: '重命名当前对话',
  resume: '恢复历史对话',
  review: '审查代码变更',
  rewind: '回退代码或对话到之前节点',
  sandbox: '切换沙箱设置',
  'security-review': '审查当前分支的安全风险',
  session: '显示远程会话链接和二维码',
  skills: '浏览当前聊天可调用的技能',
  stats: '查看用量统计和活动记录',
  status: '查看会话状态、用量和上下文',
  statusline: '设置状态栏 UI',
  stickers: '订购贴纸',
  tag: '切换当前会话的可搜索标签',
  tasks: '查看和管理后台任务',
  'terminal-setup': '设置终端集成',
  theme: '切换主题',
  'think-back': '查看年度回顾',
  'thinkback-play': '播放回顾动画',
  ultraplan: '生成可编辑的高级计划',
  upgrade: '升级到更高额度',
  usage: '查看套餐用量限制',
  version: '查看版本信息',
  vim: '切换 Vim 编辑模式',
  voice: '切换语音模式',
  'web-setup': '设置网页端工作流',
} as const satisfies Record<string, string>

function getSlashCommandDisplayDescription(command: SlashCommandOption): string {
  const localizedDescription = BUILT_IN_SLASH_COMMAND_DESCRIPTIONS[
    command.name as keyof typeof BUILT_IN_SLASH_COMMAND_DESCRIPTIONS
  ]
  return localizedDescription ?? command.description?.trim() ?? ''
}

export const PANEL_SLASH_COMMANDS = [
  { name: 'mcp', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.mcp },
  { name: 'skills', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.skills },
  { name: 'help', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.help },
  { name: 'status', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.status },
  { name: 'cost', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.cost },
  { name: 'context', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.context },
] as const

export const SETTINGS_SLASH_COMMANDS = [
  { name: 'plugin', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.plugin, tab: 'plugins' as const },
] as const

export const SLASH_COMMAND_ALIASES = [
  { name: 'plugins', target: 'plugin' },
] as const

export const FALLBACK_SLASH_COMMANDS = [
  ...PANEL_SLASH_COMMANDS,
  ...SETTINGS_SLASH_COMMANDS.map(({ name, description }) => ({ name, description })),
  { name: 'compact', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.compact },
  { name: 'clear', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.clear },
  { name: 'review', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.review },
  { name: 'commit', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.commit },
  { name: 'pr', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.pr },
  { name: 'init', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.init },
  { name: 'bug', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.bug },
  { name: 'config', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.config },
  { name: 'doctor', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.doctor },
  { name: 'login', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.login },
  { name: 'logout', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.logout },
  { name: 'memory', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.memory },
  { name: 'model', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.model },
  { name: 'permissions', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.permissions },
  { name: 'terminal-setup', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS['terminal-setup'] },
  { name: 'vim', description: BUILT_IN_SLASH_COMMAND_DESCRIPTIONS.vim },
]

export type SlashCommandOption = {
  name: string
  description: string
  argumentHint?: string
}

export type SlashUiAction =
  | {
      type: 'panel'
      command: typeof PANEL_SLASH_COMMANDS[number]['name']
    }
  | {
      type: 'settings'
      tab: SettingsTab
    }

export function resolveSlashUiAction(value: string): SlashUiAction | null {
  const normalizedValue = SLASH_COMMAND_ALIASES.find((alias) => alias.name === value)?.target ?? value
  const panelCommand = PANEL_SLASH_COMMANDS.find((command) => command.name === normalizedValue)
  if (panelCommand) {
    return { type: 'panel', command: panelCommand.name }
  }

  const settingsCommand = SETTINGS_SLASH_COMMANDS.find((command) => command.name === normalizedValue)
  if (settingsCommand) {
    return { type: 'settings', tab: settingsCommand.tab }
  }

  return null
}

export function mergeSlashCommands(
  preferred: ReadonlyArray<SlashCommandOption>,
  fallback: ReadonlyArray<SlashCommandOption> = FALLBACK_SLASH_COMMANDS,
): SlashCommandOption[] {
  const merged = new Map<string, SlashCommandOption>()

  for (const command of preferred) {
    if (!command?.name) continue
    merged.set(command.name, {
      name: command.name,
      description: getSlashCommandDisplayDescription(command),
      ...(command.argumentHint?.trim() && { argumentHint: command.argumentHint.trim() }),
    })
  }

  for (const command of fallback) {
    if (!command?.name) continue
    const existing = merged.get(command.name)
    if (existing) {
      if ((!existing.description && command.description) || (!existing.argumentHint && command.argumentHint)) {
        merged.set(command.name, {
          ...existing,
          description: existing.description || getSlashCommandDisplayDescription(command),
          argumentHint: existing.argumentHint || command.argumentHint,
        })
      }
      continue
    }
    merged.set(command.name, {
      name: command.name,
      description: getSlashCommandDisplayDescription(command),
      ...(command.argumentHint?.trim() && { argumentHint: command.argumentHint.trim() }),
    })
  }

  return [...merged.values()]
}

function getSlashCommandMatchRank(command: SlashCommandOption, filter: string): number {
  const name = command.name.toLowerCase()
  const description = command.description.toLowerCase()
  const argumentHint = command.argumentHint?.toLowerCase() ?? ''
  const nameParts = name.split(/[:/._-]+/).filter(Boolean)

  if (name === filter) return 0
  if (name.startsWith(filter)) return 1
  if (nameParts.some((part) => part.startsWith(filter))) return 2
  if (name.includes(filter)) return 3
  if (description.includes(filter)) return 4
  if (argumentHint.includes(filter)) return 5
  return Number.POSITIVE_INFINITY
}

export function filterSlashCommands(
  commands: ReadonlyArray<SlashCommandOption>,
  filter: string,
): SlashCommandOption[] {
  const normalized = filter.toLowerCase().trim()
  if (!normalized) return [...commands]

  return commands
    .map((command, index) => ({
      command,
      index,
      rank: getSlashCommandMatchRank(command, normalized),
    }))
    .filter((item) => Number.isFinite(item.rank))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.command)
}

export type SlashTrigger = {
  slashPos: number
  filter: string
}

export function findSlashTrigger(value: string, cursorPos: number): SlashTrigger | null {
  const textBeforeCursor = value.slice(0, cursorPos)
  let slashPos = -1

  for (let i = textBeforeCursor.length - 1; i >= 0; i--) {
    const ch = textBeforeCursor[i]!
    if (ch === '/') {
      if (i === 0 || /\s/.test(textBeforeCursor[i - 1]!)) {
        slashPos = i
        break
      }
      break
    }
    if (/\s/.test(ch)) {
      break
    }
  }

  if (slashPos < 0) return null

  const filter = textBeforeCursor.slice(slashPos + 1)
  if (/\s/.test(filter)) return null

  return { slashPos, filter }
}

export function replaceSlashToken(
  input: string,
  cursorPos: number,
  command: string,
  options?: { trailingSpace?: boolean },
): { value: string; cursorPos: number } {
  const trigger = findSlashTrigger(input, cursorPos)
  if (!trigger) {
    const prefix = input && !/\s$/.test(input) ? `${input} ` : input
    const token = `/${command}`
    const suffix = options?.trailingSpace !== false ? ' ' : ''
    const value = `${prefix}${token}${suffix}`
    return { value, cursorPos: value.length }
  }

  const before = input.slice(0, trigger.slashPos)
  const after = input.slice(cursorPos)
  const token = `/${command}`
  const suffix = options?.trailingSpace !== false ? ' ' : ''
  const value = `${before}${token}${suffix}${after}`
  const nextCursorPos = before.length + token.length + suffix.length
  return { value, cursorPos: nextCursorPos }
}

export type SlashToken = {
  start: number
  filter: string
}

export function findSlashToken(value: string, cursorPos: number): SlashToken | null {
  const trigger = findSlashTrigger(value, cursorPos)
  if (!trigger) return null
  return { start: trigger.slashPos, filter: trigger.filter }
}

export function replaceSlashCommand(
  value: string,
  cursorPos: number,
  command: string,
): { value: string; cursorPos: number } | null {
  const trigger = findSlashTrigger(value, cursorPos)
  if (!trigger) return null

  return replaceSlashToken(value, cursorPos, command, { trailingSpace: true })
}

export function insertSlashTrigger(
  value: string,
  cursorPos: number,
): { value: string; cursorPos: number } {
  const before = value.slice(0, cursorPos)
  const after = value.slice(cursorPos)
  const needsLeadingSpace = before.length > 0 && !/\s$/.test(before)
  const token = `${needsLeadingSpace ? ' ' : ''}/`
  return {
    value: `${before}${token}${after}`,
    cursorPos: before.length + token.length,
  }
}
