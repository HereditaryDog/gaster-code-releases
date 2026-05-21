import type { Command } from '../../commands.js'

const goal = {
  type: 'local-jsx',
  supportsNonInteractive: true,
  name: 'goal',
  description: '设置当前会话的完成目标',
  argumentHint: '[<目标> | clear]',
  load: () => import('./goal.js'),
} satisfies Command

export default goal
