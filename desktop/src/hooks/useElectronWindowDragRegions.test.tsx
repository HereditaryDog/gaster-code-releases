import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { shouldUseManualWindowDrag, useElectronWindowDragRegions } from './useElectronWindowDragRegions'

const desktopHostMock = vi.hoisted(() => ({
  startDragging: vi.fn().mockResolvedValue(undefined),
  host: {
    isDesktop: true,
    capabilities: {
      windowControls: true,
    },
    window: {
      startDragging: vi.fn().mockResolvedValue(undefined),
    },
  },
}))

vi.mock('../lib/desktopHost', () => ({
  getDesktopHost: () => desktopHostMock.host,
}))

function Harness() {
  useElectronWindowDragRegions()

  return (
    <div data-testid="drag-region" data-desktop-drag-region>
      <div data-testid="blank-space">blank</div>
      <button type="button">Button</button>
      <div data-testid="tab" className="tab-bar-interactive">
        Tab
      </div>
    </div>
  )
}

describe('useElectronWindowDragRegions', () => {
  const originalPlatform = navigator.platform

  beforeEach(() => {
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'Win32',
    })
    delete document.documentElement.dataset.desktopDragMode
    desktopHostMock.host.isDesktop = true
    desktopHostMock.host.capabilities.windowControls = true
    desktopHostMock.host.window.startDragging.mockReset()
    desktopHostMock.host.window.startDragging.mockResolvedValue(undefined)
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: originalPlatform,
    })
    delete document.documentElement.dataset.desktopDragMode
  })

  it('uses the manual drag fallback on Windows only', () => {
    expect(shouldUseManualWindowDrag('Win32')).toBe(true)
    expect(shouldUseManualWindowDrag('MacIntel')).toBe(false)
    expect(shouldUseManualWindowDrag('Linux x86_64')).toBe(false)
  })

  it('moves the native window while dragging a desktop drag region', async () => {
    render(<Harness />)
    expect(document.documentElement.dataset.desktopDragMode).toBe('manual')

    fireEvent.mouseDown(screen.getByTestId('blank-space'), {
      button: 0,
      screenX: 100,
      screenY: 120,
    })
    fireEvent.mouseMove(window, {
      screenX: 130,
      screenY: 150,
    })

    await waitFor(() => {
      expect(desktopHostMock.host.window.startDragging).toHaveBeenCalledWith({
        deltaX: 30,
        deltaY: 30,
      })
    })

    fireEvent.mouseUp(window)
    fireEvent.mouseMove(window, {
      screenX: 180,
      screenY: 210,
    })

    expect(desktopHostMock.host.window.startDragging).toHaveBeenCalledTimes(1)
  })

  it('keeps buttons and tab reorder targets out of the window drag fallback', () => {
    render(<Harness />)

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Button' }), {
      button: 0,
      screenX: 100,
      screenY: 120,
    })
    fireEvent.mouseMove(window, {
      screenX: 130,
      screenY: 150,
    })

    fireEvent.mouseDown(screen.getByTestId('tab'), {
      button: 0,
      screenX: 100,
      screenY: 120,
    })
    fireEvent.mouseMove(window, {
      screenX: 130,
      screenY: 150,
    })

    expect(desktopHostMock.host.window.startDragging).not.toHaveBeenCalled()
  })

  it('does nothing outside the Electron custom chrome runtime', () => {
    desktopHostMock.host.isDesktop = false
    render(<Harness />)

    fireEvent.mouseDown(screen.getByTestId('blank-space'), {
      button: 0,
      screenX: 100,
      screenY: 120,
    })
    fireEvent.mouseMove(window, {
      screenX: 130,
      screenY: 150,
    })

    expect(desktopHostMock.host.window.startDragging).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.desktopDragMode).toBeUndefined()
  })

  it('leaves native app-region handling active on non-Windows platforms', () => {
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      value: 'MacIntel',
    })
    render(<Harness />)

    fireEvent.mouseDown(screen.getByTestId('blank-space'), {
      button: 0,
      screenX: 100,
      screenY: 120,
    })
    fireEvent.mouseMove(window, {
      screenX: 130,
      screenY: 150,
    })

    expect(desktopHostMock.host.window.startDragging).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.desktopDragMode).toBeUndefined()
  })
})
