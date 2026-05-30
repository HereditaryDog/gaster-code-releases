import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

const { getRecentProjectsMock } = vi.hoisted(() => ({
  getRecentProjectsMock: vi.fn(),
}))

vi.mock('../../api/sessions', async () => {
  const actual = await vi.importActual<typeof import('../../api/sessions')>('../../api/sessions')
  return {
    ...actual,
    sessionsApi: {
      ...actual.sessionsApi,
      getRecentProjects: getRecentProjectsMock,
    },
  }
})

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string) => {
    const translations: Record<string, string> = {
      'sidebar.allProjects': 'All projects',
      'sidebar.other': 'Other',
      'sidebar.noSessions': 'No sessions',
      'common.loading': 'Loading',
    }

    return translations[key] ?? key
  },
}))

import { useSessionStore } from '../../stores/sessionStore'
import { ProjectFilter } from './ProjectFilter'

describe('ProjectFilter', () => {
  beforeEach(() => {
    getRecentProjectsMock.mockReset()
    useSessionStore.setState({
      sessions: [],
      activeSessionId: null,
      isLoading: false,
      error: null,
      selectedProjects: [],
      availableProjects: [
        'Users-demo-workspace-myself_code-OpenCutSkill',
        'Users-demo-workspace-myself_code-gaster-code',
      ],
    })
  })

  it('renders recent project metadata instead of bare fallback folder names', async () => {
    getRecentProjectsMock.mockResolvedValue({
      projects: [
        {
          projectPath: 'Users-demo-workspace-myself_code-gaster-code',
          realPath: '/Users/demo/workspace/myself_code/gaster-code',
          projectName: 'gaster-code',
          isGit: true,
          repoName: 'HereditaryDog/gaster-code',
          branch: 'main',
          modifiedAt: '2026-04-20T10:00:00.000Z',
          sessionCount: 4,
        },
        {
          projectPath: 'Users-demo-workspace-myself_code-OpenCutSkill',
          realPath: '/Users/demo/workspace/myself_code/OpenCutSkill',
          projectName: 'OpenCutSkill',
          isGit: true,
          repoName: 'NanmiCoder/OpenCutSkill',
          branch: 'main',
          modifiedAt: '2026-04-20T09:00:00.000Z',
          sessionCount: 2,
        },
      ],
    })

    render(<ProjectFilter />)

    fireEvent.click(screen.getByRole('button', { name: /All projects/i }))

    await waitFor(() => {
      expect(screen.getByText('HereditaryDog/gaster-code')).toBeInTheDocument()
      expect(screen.getByText('/Users/demo/workspace/myself_code/gaster-code')).toBeInTheDocument()
      expect(screen.getByText('NanmiCoder/OpenCutSkill')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /HereditaryDog\/gaster-code/i }))

    await waitFor(() => {
      expect(useSessionStore.getState().selectedProjects).toEqual(['Users-demo-workspace-myself_code-gaster-code'])
    })

    expect(screen.getAllByRole('button', { name: /HereditaryDog\/gaster-code/i })).toHaveLength(2)
  })
})
