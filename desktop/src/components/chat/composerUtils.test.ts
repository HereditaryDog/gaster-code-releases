import { describe, expect, it } from 'vitest'
import {
  filterSlashCommands,
  findSlashToken,
  insertSlashTrigger,
  mergeSlashCommands,
  replaceSlashCommand,
  resolveSlashUiAction,
} from './composerUtils'

describe('composerUtils', () => {
  it('finds slash token without trailing space', () => {
    expect(findSlashToken('/rev', 4)).toEqual({ start: 0, filter: 'rev' })
    expect(findSlashToken('hello /rev', 10)).toEqual({ start: 6, filter: 'rev' })
  })

  it('does not treat slash followed by a space as an active token', () => {
    expect(findSlashToken('/ review', 8)).toBeNull()
  })

  it('inserts a slash trigger without appending a trailing space', () => {
    expect(insertSlashTrigger('', 0)).toEqual({ value: '/', cursorPos: 1 })
    expect(insertSlashTrigger('hello', 5)).toEqual({ value: 'hello /', cursorPos: 7 })
  })

  it('replaces the current slash token with a command and one trailing separator', () => {
    expect(replaceSlashCommand('/rev', 4, 'review')).toEqual({
      value: '/review ',
      cursorPos: 8,
    })
  })

  it('merges fallback commands with localized descriptions so built-in entries like /clear remain visible', () => {
    expect(
      mergeSlashCommands([
        { name: 'help', description: '' },
      ]),
    ).toEqual(
      expect.arrayContaining([
        { name: 'help', description: '查看桌面端和 Agent 可用命令' },
        { name: 'clear', description: '清空对话历史' },
        { name: 'context', description: '查看当前上下文用量' },
      ]),
    )
  })

  it('localizes known built-in descriptions returned by the server', () => {
    expect(
      mergeSlashCommands([
        { name: 'mcp', description: 'Manage MCP servers' },
        { name: 'skills', description: 'List available skills' },
        { name: 'help', description: 'Show help and available commands' },
      ]),
    ).toEqual(
      expect.arrayContaining([
        { name: 'mcp', description: '查看当前聊天可用的 MCP 工具' },
        { name: 'skills', description: '浏览当前聊天可调用的技能' },
        { name: 'help', description: '查看桌面端和 Agent 可用命令' },
      ]),
    )
  })

  it('keeps slash command argument hints and fills missing fallback descriptions', () => {
    expect(
      mergeSlashCommands([
        {
          name: 'compact',
          description: '',
          argumentHint: '[instruction]',
        },
      ]),
    ).toEqual(
      expect.arrayContaining([
        {
          name: 'compact',
          description: '压缩对话上下文',
          argumentHint: '[instruction]',
        },
      ]),
    )
  })

  it('keeps server-provided descriptions for custom commands when they exist', () => {
    expect(
      mergeSlashCommands([
        { name: 'team-report', description: 'Server description' },
      ]),
    ).toEqual(
      expect.arrayContaining([
        { name: 'team-report', description: 'Server description' },
      ]),
    )
  })

  it('ranks slash command name matches before broad description matches', () => {
    expect(
      filterSlashCommands([
        { name: 'lark-calendar', description: 'Includes shortcuts and suggestion helpers' },
        { name: 'agent-team-orchestrator', description: 'Uses Subagent orchestration' },
        { name: 'superpowers:brainstorming', description: 'Creative work planning' },
        { name: 'superpowers:systematic-debugging', description: 'Debug unexpected behavior' },
      ], 'su').map((command) => command.name),
    ).toEqual([
      'superpowers:brainstorming',
      'superpowers:systematic-debugging',
      'lark-calendar',
      'agent-team-orchestrator',
    ])
  })

  it('resolves hidden settings aliases without displaying duplicate fallback rows', () => {
    expect(resolveSlashUiAction('plugins')).toEqual({ type: 'settings', tab: 'plugins' })
    expect(mergeSlashCommands([]).map((command) => command.name)).toContain('plugin')
    expect(mergeSlashCommands([]).map((command) => command.name)).not.toContain('plugins')
  })

  it('routes session inspection commands to the desktop panel', () => {
    expect(resolveSlashUiAction('cost')).toEqual({ type: 'panel', command: 'cost' })
    expect(resolveSlashUiAction('context')).toEqual({ type: 'panel', command: 'context' })
    expect(resolveSlashUiAction('status')).toEqual({ type: 'panel', command: 'status' })
  })
})
