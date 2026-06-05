// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { browserHost } from '../../lib/desktopHost/browserHost'

const openTarget = vi.hoisted(() => vi.fn())
const shellOpen = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const hostOpenPath = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('../../stores/openTargetStore', () => ({
  useOpenTargetStore: (sel: (s: unknown) => unknown) =>
    sel({
      targets: [
        { id: 'code', kind: 'ide', label: 'VS Code', icon: '', platform: 'darwin' },
        { id: 'finder', kind: 'file_manager', label: 'Finder', icon: '', platform: 'darwin' },
      ],
      ensureTargets: () => {},
      openTarget,
    }),
}))

vi.mock('@tauri-apps/plugin-shell', () => ({ open: shellOpen }))

vi.mock('../../i18n', () => ({
  useTranslation: () => (k: string, v?: Record<string, string>) =>
    v?.target ? `${k}:${v.target}` : k,
}))

import { WorkspaceFileOpenWith } from './WorkspaceFileOpenWith'

describe('WorkspaceFileOpenWith', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.desktopHost = {
      ...browserHost,
      kind: 'electron',
      isDesktop: true,
      capabilities: {
        ...browserHost.capabilities,
        shell: true,
      },
      shell: {
        ...browserHost.shell,
        openPath: hostOpenPath,
      },
    }
  })

  it('renders only IDE and file-manager items', () => {
    const { getAllByRole } = render(
      <WorkspaceFileOpenWith absolutePath="/w/report.md" />,
    )

    const menuItems = getAllByRole('menuitem')
    expect(menuItems).toHaveLength(2)

    const labels = menuItems.map((el) => el.textContent)
    expect(labels.some((l) => l?.includes('VS Code'))).toBe(true)
    expect(labels.some((l) => l?.includes('Finder'))).toBe(true)
    expect(labels.some((l) => l?.includes('openWith.systemDefault'))).toBe(false)
  })

  it('clicking the IDE item calls openTarget and onAfterSelect', () => {
    const onAfter = vi.fn()
    const { getAllByRole } = render(
      <WorkspaceFileOpenWith absolutePath="/w/report.md" onAfterSelect={onAfter} />,
    )

    const menuItems = getAllByRole('menuitem')
    const ideItem = menuItems.find((el) => el.textContent?.includes('VS Code'))
    if (!ideItem) throw new Error('IDE menu item not found')

    fireEvent.click(ideItem)

    expect(openTarget).toHaveBeenCalledWith('code', '/w/report.md')
    expect(onAfter).toHaveBeenCalledTimes(1)
  })

  it('does not call shell open from the file open-with menu', () => {
    render(<WorkspaceFileOpenWith absolutePath="/w/report.md" />)
    expect(shellOpen).not.toHaveBeenCalled()
    expect(hostOpenPath).not.toHaveBeenCalled()
  })
})
