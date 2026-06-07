import { useEffect } from 'react'
import { getDesktopHost } from '../lib/desktopHost'

const DRAG_REGION_SELECTOR = '[data-desktop-drag-region]'
const MANUAL_DRAG_MODE = 'manual'
const NO_DRAG_SELECTOR = [
  '[data-desktop-no-drag-region]',
  'button',
  'input',
  'textarea',
  'select',
  'a',
  '[role="button"]',
  '[draggable="true"]',
  '.tab-bar-interactive',
  '.tab-bar-interactive *',
].join(',')

export function shouldUseManualWindowDrag(platform = typeof navigator === 'undefined' ? '' : navigator.platform) {
  return /Win/i.test(platform)
}

export function isDesktopDragStartTarget(target: EventTarget | null): target is Element {
  if (!(target instanceof Element)) return false
  if (target.closest(NO_DRAG_SELECTOR)) return false
  return Boolean(target.closest(DRAG_REGION_SELECTOR))
}

export function useElectronWindowDragRegions() {
  useEffect(() => {
    const host = getDesktopHost()
    if (!host.isDesktop || !host.capabilities?.windowControls || !host.window?.startDragging) return
    if (!shouldUseManualWindowDrag()) return

    const previousDragMode = document.documentElement.dataset.desktopDragMode
    document.documentElement.dataset.desktopDragMode = MANUAL_DRAG_MODE

    let dragging = false
    let lastScreenX = 0
    let lastScreenY = 0

    const stopDragging = () => {
      dragging = false
    }

    const handleMouseDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      if (!isDesktopDragStartTarget(event.target)) return
      dragging = true
      lastScreenX = event.screenX
      lastScreenY = event.screenY
      event.preventDefault()
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragging) return
      const deltaX = event.screenX - lastScreenX
      const deltaY = event.screenY - lastScreenY
      if (deltaX === 0 && deltaY === 0) return

      lastScreenX = event.screenX
      lastScreenY = event.screenY
      void host.window.startDragging({ deltaX, deltaY }).catch(error => {
        console.error('Window drag fallback failed', error)
        stopDragging()
      })
    }

    document.addEventListener('mousedown', handleMouseDown, true)
    window.addEventListener('mousemove', handleMouseMove, true)
    window.addEventListener('mouseup', stopDragging, true)
    window.addEventListener('blur', stopDragging)

    return () => {
      if (previousDragMode === undefined) {
        delete document.documentElement.dataset.desktopDragMode
      } else {
        document.documentElement.dataset.desktopDragMode = previousDragMode
      }
      document.removeEventListener('mousedown', handleMouseDown, true)
      window.removeEventListener('mousemove', handleMouseMove, true)
      window.removeEventListener('mouseup', stopDragging, true)
      window.removeEventListener('blur', stopDragging)
    }
  }, [])
}
