import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '@testing-library/jest-dom'

vi.mock('../../api/sessions', () => ({
  sessionsApi: {
    getRecentProjects: vi.fn(),
  },
}))

vi.mock('../../api/filesystem', () => ({
  filesystemApi: {
    browse: vi.fn(),
  },
}))

import { DirectoryPicker } from './DirectoryPicker'

describe('DirectoryPicker', () => {
  it('uses the source repository name as the fallback label for desktop worktree paths', () => {
    render(
      <DirectoryPicker
        value="/workspace/checkout/.claude/worktrees/desktop-feature-rail-12345678"
        onChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button')).toHaveTextContent('checkout')
    expect(screen.getByRole('button')).not.toHaveTextContent('desktop-feature-rail-12345678')
  })

  it('uses the frosted project chip style for the selectable trigger', () => {
    render(
      <DirectoryPicker
        value="/Users/jack"
        onChange={vi.fn()}
      />,
    )

    const trigger = screen.getByRole('button')
    expect(trigger).toHaveClass('project-context-chip')
    expect(trigger).toHaveClass('project-context-chip--frosted')
  })

  it('keeps the chip trigger compact for the attached composer row', () => {
    render(
      <DirectoryPicker
        value="/Users/jack/Desktop/网站设计/Gaster Code网站"
        onChange={vi.fn()}
        variant="chip"
        isGitProject
      />,
    )

    const trigger = screen.getByRole('button')
    expect(trigger).toHaveClass('h-8')
    expect(trigger).toHaveClass('max-w-[260px]')
    expect(trigger).toHaveClass('rounded-full')
    expect(trigger).toHaveClass('px-3')
    expect(trigger).toHaveClass('text-xs')
  })

  it('renders the empty chip trigger as a frosted control', () => {
    render(
      <DirectoryPicker
        value=""
        onChange={vi.fn()}
        variant="chip"
      />,
    )

    const trigger = screen.getByRole('button', { name: /Pick project|选择项目/ })
    expect(trigger).toHaveClass('project-context-chip')
    expect(trigger).toHaveClass('project-context-chip--frosted')
    expect(trigger).toHaveClass('h-8')
    expect(trigger).toHaveClass('rounded-full')
  })
})
