export type CuratedCapabilityKind = 'skills' | 'agents'

export type CuratedCapabilityDefinition = {
  id: string
  kind: CuratedCapabilityKind
  displayName: string
  description: string
  category: string
  author: 'GasterCode'
  version: string
  defaultEnabled: true
  tags: string[]
}

export type CuratedCapabilityItem = CuratedCapabilityDefinition & {
  enabled: boolean
}

const CURATED_SKILLS: CuratedCapabilityDefinition[] = [
  {
    id: 'diagnostics-analyzer',
    kind: 'skills',
    displayName: '诊断包分析',
    description:
      'Analyze exported diagnostics, group repeated failures, and identify likely root causes.',
    category: 'diagnostics',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['diagnostics', 'logs', 'support'],
  },
  {
    id: 'code-review',
    kind: 'skills',
    displayName: '代码审查',
    description:
      'Review diffs for bugs, regressions, security risks, and missing tests.',
    category: 'engineering',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['review', 'quality', 'git'],
  },
  {
    id: 'bug-investigation',
    kind: 'skills',
    displayName: '问题定位',
    description: 'Guide systematic debugging before editing code.',
    category: 'debugging',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['debugging', 'triage'],
  },
  {
    id: 'frontend-review',
    kind: 'skills',
    displayName: '前端体验走查',
    description:
      'Review rendered UI for layout, copy, responsive issues, and interaction gaps.',
    category: 'frontend',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['frontend', 'ui', 'ux'],
  },
  {
    id: 'browser-smoke-test',
    kind: 'skills',
    displayName: '浏览器冒烟验证',
    description: 'Plan and run focused browser checks for local frontend changes.',
    category: 'verification',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['browser', 'verification'],
  },
  {
    id: 'test-author',
    kind: 'skills',
    displayName: '测试补齐',
    description: 'Add or improve focused regression tests for changed behavior.',
    category: 'testing',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['tests', 'regression'],
  },
  {
    id: 'release-checklist',
    kind: 'skills',
    displayName: '发布检查',
    description:
      'Prepare release checks, notes, version consistency, and package handoff.',
    category: 'release',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['release', 'versioning'],
  },
  {
    id: 'docs-polisher',
    kind: 'skills',
    displayName: '文档润色',
    description: 'Improve README, docs, changelog, and user-facing technical copy.',
    category: 'documentation',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['docs', 'copy'],
  },
  {
    id: 'git-pr-summary',
    kind: 'skills',
    displayName: 'PR 摘要',
    description: 'Summarize local changes into commit, PR, or release-note language.',
    category: 'git',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['git', 'summary'],
  },
  {
    id: 'migration-planner',
    kind: 'skills',
    displayName: '迁移规划',
    description:
      'Plan compatibility migrations for config, localStorage, naming, and legacy paths.',
    category: 'migration',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['migration', 'compatibility'],
  },
]

const CURATED_AGENTS: CuratedCapabilityDefinition[] = [
  {
    id: 'gaster-frontend-engineer',
    kind: 'agents',
    displayName: '前端工程师',
    description: 'Implement and verify focused desktop UI changes.',
    category: 'engineering',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['frontend', 'react'],
  },
  {
    id: 'gaster-backend-engineer',
    kind: 'agents',
    displayName: '后端工程师',
    description:
      'Work on server APIs, runtime services, config storage, and integration points.',
    category: 'engineering',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['server', 'api'],
  },
  {
    id: 'gaster-qa-engineer',
    kind: 'agents',
    displayName: '测试工程师',
    description: 'Add regression coverage and run targeted verification.',
    category: 'testing',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['tests', 'quality'],
  },
  {
    id: 'gaster-debug-investigator',
    kind: 'agents',
    displayName: '调试分析师',
    description: 'Explore failures, logs, and diagnostics before implementation.',
    category: 'debugging',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['debugging', 'diagnostics'],
  },
  {
    id: 'gaster-release-manager',
    kind: 'agents',
    displayName: '发布经理',
    description:
      'Prepare version, release notes, package workflow checks, and release handoff.',
    category: 'release',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['release', 'packaging'],
  },
  {
    id: 'gaster-docs-engineer',
    kind: 'agents',
    displayName: '文档工程师',
    description: 'Update docs and user-facing technical explanations.',
    category: 'documentation',
    author: 'GasterCode',
    version: '1.0.0',
    defaultEnabled: true,
    tags: ['docs', 'writing'],
  },
]

export const CURATED_SKILL_COUNT = CURATED_SKILLS.length
export const CURATED_AGENT_COUNT = CURATED_AGENTS.length

export function listCuratedCapabilities(
  kind: 'skills',
): CuratedCapabilityDefinition[]
export function listCuratedCapabilities(
  kind: 'agents',
): CuratedCapabilityDefinition[]
export function listCuratedCapabilities(
  kind: CuratedCapabilityKind,
): CuratedCapabilityDefinition[] {
  return kind === 'skills' ? [...CURATED_SKILLS] : [...CURATED_AGENTS]
}

export function findCuratedCapability(
  kind: CuratedCapabilityKind,
  id: string,
): CuratedCapabilityDefinition | undefined {
  return listCuratedCapabilities(kind).find(item => item.id === id)
}

export function isCuratedCapabilityId(
  kind: CuratedCapabilityKind,
  id: string,
): boolean {
  return findCuratedCapability(kind, id) !== undefined
}
