import { forwardRef, useMemo, useRef, useState, useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  SCHEDULED_TAB_ID,
  SETTINGS_TAB_ID,
  TERMINAL_TAB_PREFIX,
  useTabStore,
  type Tab,
} from '../../stores/tabStore'
import { useChatStore } from '../../stores/chatStore'
import { useSessionStore } from '../../stores/sessionStore'
import { useWorkspacePanelStore } from '../../stores/workspacePanelStore'
import { useTerminalPanelStore } from '../../stores/terminalPanelStore'
import { useTranslation } from '../../i18n'
import { WindowControls, showWindowControls } from './WindowControls'
import { OpenProjectMenu } from './OpenProjectMenu'
import { Folder, FolderOpen, SquareTerminal } from 'lucide-react'
import { getDesktopHost } from '../../lib/desktopHost'

const TAB_WIDTH = 180
const DRAG_START_THRESHOLD = 4
const DRAG_SLOT_SHIFT = TAB_WIDTH - 20
const isDesktop = getDesktopHost().isDesktop

type PendingCloseRequest = {
  tabs: Tab[]
  runningSessionIds: string[]
}

type DragTabBounds = {
  sessionId: string
  left: number
  right: number
  width: number
}

function isSessionTab(tab: Tab | null) {
  if (!tab) return false
  const tabType = (tab as Partial<Tab>).type
  if (tabType === 'session') return true
  if (tabType) return false
  return isSessionTabId(tab.sessionId)
}

function isSessionTabId(tabId: string | null) {
  if (!tabId) return false
  return tabId !== SETTINGS_TAB_ID &&
    tabId !== SCHEDULED_TAB_ID &&
    !tabId.startsWith(TERMINAL_TAB_PREFIX)
}

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const sessionTabIds = useMemo(
    () => tabs.filter((tab) => isSessionTab(tab)).map((tab) => tab.sessionId),
    [tabs],
  )
  const activeChatSessionIds = useChatStore(useShallow((s) =>
    sessionTabIds.filter((sessionId) => s.sessions[sessionId]?.chatState !== 'idle')
  ))
  const disconnectSession = useChatStore((s) => s.disconnectSession)
  const activeTab = tabs.find((tab) => tab.sessionId === activeTabId) ?? null
  const isActiveSessionTab = isSessionTab(activeTab) || isSessionTabId(activeTabId)
  const activeSession = useSessionStore((state) =>
    activeTabId ? state.sessions.find((session) => session.id === activeTabId) : undefined,
  )
  const openProjectPath = isActiveSessionTab && activeSession?.workDirExists !== false
    ? activeSession?.workDir ?? null
    : null
  const isWorkspacePanelOpen = useWorkspacePanelStore((state) =>
    activeTabId && isActiveSessionTab ? state.isPanelOpen(activeTabId) : false,
  )
  const isTerminalPanelOpen = useTerminalPanelStore((state) =>
    activeTabId && isActiveSessionTab ? state.isPanelOpen(activeTabId) : false,
  )

  const moveTab = useTabStore((s) => s.moveTab)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ sessionId: string; x: number; y: number } | null>(null)
  const [pendingCloseRequest, setPendingCloseRequest] = useState<PendingCloseRequest | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [draggingSessionId, setDraggingSessionId] = useState<string | null>(null)
  const dragIndexRef = useRef<number | null>(null)
  const dragTargetIndexRef = useRef<number | null>(null)
  const dragFrameRef = useRef<number | null>(null)
  const dragOverIndexRef = useRef<number | null>(null)
  const draggedTabElementRef = useRef<HTMLDivElement | null>(null)
  const latestDragPointRef = useRef<{ clientX: number; clientY: number } | null>(null)
  const dragTabBoundsRef = useRef<DragTabBounds[]>([])
  const pendingDragRef = useRef<{
    index: number
    startX: number
    startY: number
    tabLeft: number
    tabRight: number
  } | null>(null)
  const suppressClickRef = useRef(false)
  const tabRefs = useRef(new Map<string, HTMLDivElement | null>())
  const startDraggingRef = useRef<(() => Promise<void>) | null>(null)
  const t = useTranslation()
  const runningSessionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const tab of tabs) {
      if (isSessionTab(tab) && tab.status === 'running') ids.add(tab.sessionId)
    }
    for (const sessionId of activeChatSessionIds) {
      ids.add(sessionId)
    }
    return ids
  }, [activeChatSessionIds, tabs])

  useEffect(() => {
    const host = getDesktopHost()
    if (!host.capabilities.windowControls) return
    startDraggingRef.current = () => host.window.startDragging()
  }, [])

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  useEffect(() => {
    updateScrollState()
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', updateScrollState)
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState, tabs.length])

  useEffect(() => {
    if (!activeTabId) return
    const activeTabEl = tabRefs.current.get(activeTabId)
    if (!activeTabEl) return

    activeTabEl.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    })

    const frame = window.requestAnimationFrame(updateScrollState)
    return () => window.cancelAnimationFrame(frame)
  }, [activeTabId, tabs.length, updateScrollState])

  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [contextMenu])

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: direction === 'left' ? -TAB_WIDTH : TAB_WIDTH, behavior: 'smooth' })
  }

  const closeTabWithCleanup = useCallback((tab: Tab) => {
    if (isSessionTab(tab)) {
      useWorkspacePanelStore.getState().clearSession(tab.sessionId)
      useTerminalPanelStore.getState().clearSession(tab.sessionId)
    }
    closeTab(tab.sessionId)
  }, [closeTab])

  const getRunningSessionIds = useCallback((targetTabs: Tab[]) => {
    const chatSessions = useChatStore.getState().sessions
    return targetTabs
      .filter((tab) => isSessionTab(tab))
      .filter((tab) => {
        const sessionState = chatSessions[tab.sessionId]
        return !!sessionState && sessionState.chatState !== 'idle'
      })
      .map((tab) => tab.sessionId)
  }, [])

  const closeTabsWithPolicy = useCallback((targetTabs: Tab[], runningSessionIds: string[], stopRunning: boolean) => {
    const runningSessionSet = new Set(runningSessionIds)

    for (const tab of targetTabs) {
      if (isSessionTab(tab)) {
        const isRunning = runningSessionSet.has(tab.sessionId)
        if (isRunning && stopRunning) {
          useChatStore.getState().stopGeneration(tab.sessionId)
        }
        if (!isRunning || stopRunning) {
          disconnectSession(tab.sessionId)
        }
      }
      closeTabWithCleanup(tab)
    }
  }, [closeTabWithCleanup, disconnectSession])

  const requestCloseTabs = useCallback((targetTabs: Tab[]) => {
    if (targetTabs.length === 0) return
    const runningSessionIds = getRunningSessionIds(targetTabs)

    if (runningSessionIds.length > 0) {
      setPendingCloseRequest({ tabs: targetTabs, runningSessionIds })
      return
    }

    closeTabsWithPolicy(targetTabs, [], false)
  }, [closeTabsWithPolicy, getRunningSessionIds])

  const handleClose = (sessionId: string) => {
    const tab = tabs.find((t) => t.sessionId === sessionId)
    if (!tab) return
    requestCloseTabs([tab])
  }

  const handleContextMenu = (e: React.MouseEvent, sessionId: string) => {
    e.preventDefault()
    setContextMenu({ sessionId, x: e.clientX, y: e.clientY })
  }

  const handleCloseOthers = (sessionId: string) => {
    setContextMenu(null)
    const otherTabs = tabs.filter((t) => t.sessionId !== sessionId)
    requestCloseTabs(otherTabs)
  }

  const handleCloseLeft = (sessionId: string) => {
    setContextMenu(null)
    const idx = tabs.findIndex((t) => t.sessionId === sessionId)
    const leftTabs = tabs.slice(0, idx)
    requestCloseTabs(leftTabs)
  }

  const handleCloseRight = (sessionId: string) => {
    setContextMenu(null)
    const idx = tabs.findIndex((t) => t.sessionId === sessionId)
    const rightTabs = tabs.slice(idx + 1)
    requestCloseTabs(rightTabs)
  }

  const handleCloseAll = () => {
    setContextMenu(null)
    requestCloseTabs(tabs)
  }

  const getRectRight = (rect: { left: number; right?: number; width: number }) =>
    Number.isFinite(rect.right) ? rect.right! : rect.left + rect.width

  const getCachedTabBounds = (sessionId: string) =>
    dragTabBoundsRef.current.find((bounds) => bounds.sessionId === sessionId) ?? null

  const getDraggedTransform = (offsetX: number) => `translate3d(${offsetX}px, -3px, 0) scale(1.035)`

  const applyDraggedTabTransform = useCallback((offsetX: number) => {
    if (!draggedTabElementRef.current) return
    draggedTabElementRef.current.style.transform = getDraggedTransform(offsetX)
  }, [])

  const getTargetIndexFromDraggedCenter = useCallback((draggedCenterX: number, dragIndex: number) => {
    let targetIndex = 0

    for (let index = 0; index < tabs.length; index++) {
      if (index === dragIndex) continue

      const tab = tabs[index]
      if (!tab) {
        targetIndex++
        continue
      }
      const rect = getCachedTabBounds(tab.sessionId)
      if (!rect) {
        targetIndex++
        continue
      }
      if (draggedCenterX < rect.left + rect.width / 2) return targetIndex
      targetIndex++
    }

    return targetIndex
  }, [tabs])

  const getTargetIndexFromDrag = useCallback((clientX: number, dragIndex: number) => {
    const pending = pendingDragRef.current
    if (!pending) return { targetIndex: null, previewIndex: null }

    const deltaX = clientX - pending.startX
    const draggedCenterX = (pending.tabLeft + pending.tabRight) / 2 + deltaX
    const targetIndex = getTargetIndexFromDraggedCenter(draggedCenterX, dragIndex)
    let previewIndex = targetIndex !== dragIndex ? targetIndex : null

    if (deltaX < 0 && dragIndex > 0) {
      const previousTab = tabs[dragIndex - 1]
      const previousRect = previousTab ? getCachedTabBounds(previousTab.sessionId) : null
      if (previousRect) {
        const overlap = getRectRight(previousRect) - (pending.tabLeft + deltaX)
        if (overlap >= 0) {
          return { targetIndex, previewIndex: previewIndex ?? dragIndex - 1 }
        }
      }
    }

    if (deltaX > 0 && dragIndex < tabs.length - 1) {
      const nextTab = tabs[dragIndex + 1]
      const nextRect = nextTab ? getCachedTabBounds(nextTab.sessionId) : null
      if (nextRect) {
        const overlap = pending.tabRight + deltaX - nextRect.left
        if (overlap >= 0) {
          return { targetIndex, previewIndex: previewIndex ?? dragIndex + 1 }
        }
      }
    }

    return { targetIndex, previewIndex }
  }, [getTargetIndexFromDraggedCenter, tabs])

  const finalizeDrag = useCallback((targetIndex: number | null) => {
    if (dragFrameRef.current !== null) {
      window.cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = null
    }
    if (draggedTabElementRef.current) {
      draggedTabElementRef.current.style.transform = ''
    }
    if (dragIndexRef.current !== null && targetIndex !== null && dragIndexRef.current !== targetIndex) {
      moveTab(dragIndexRef.current, targetIndex)
    }
    dragIndexRef.current = null
    dragTargetIndexRef.current = null
    dragOverIndexRef.current = null
    draggedTabElementRef.current = null
    latestDragPointRef.current = null
    dragTabBoundsRef.current = []
    pendingDragRef.current = null
    setDraggingSessionId(null)
    setDragOverIndex(null)
  }, [moveTab])

  const applyLatestDragPoint = useCallback(() => {
    dragFrameRef.current = null
    const point = latestDragPointRef.current
    const pending = pendingDragRef.current
    if (!point || !pending) return

    const deltaX = Math.abs(point.clientX - pending.startX)
    const deltaY = Math.abs(point.clientY - pending.startY)

    if (dragIndexRef.current === null) {
      if (Math.max(deltaX, deltaY) < DRAG_START_THRESHOLD) return
      dragIndexRef.current = pending.index
      const draggingTab = tabs[pending.index]
      draggedTabElementRef.current = draggingTab
        ? tabRefs.current.get(draggingTab.sessionId) ?? null
        : null
      suppressClickRef.current = true
      setDraggingSessionId(tabs[pending.index]?.sessionId ?? null)
    }

    applyDraggedTabTransform(point.clientX - pending.startX)

    const { targetIndex, previewIndex } = getTargetIndexFromDrag(point.clientX, dragIndexRef.current)
    dragTargetIndexRef.current = targetIndex !== null && targetIndex !== dragIndexRef.current
      ? targetIndex
      : null
    if (dragOverIndexRef.current !== previewIndex) {
      dragOverIndexRef.current = previewIndex
      setDragOverIndex(previewIndex)
    }
  }, [applyDraggedTabTransform, getTargetIndexFromDrag, tabs])

  const handlePointerMove = useCallback((event: MouseEvent) => {
    const pending = pendingDragRef.current
    if (!pending) return

    latestDragPointRef.current = { clientX: event.clientX, clientY: event.clientY }
    if (dragFrameRef.current !== null) return

    dragFrameRef.current = window.requestAnimationFrame(applyLatestDragPoint)
  }, [applyLatestDragPoint])

  const flushPendingDragFrame = useCallback(() => {
    if (dragFrameRef.current === null) return
    window.cancelAnimationFrame(dragFrameRef.current)
    applyLatestDragPoint()
  }, [applyLatestDragPoint])

  const handlePointerUp = useCallback(() => {
    flushPendingDragFrame()
    finalizeDrag(dragTargetIndexRef.current)
  }, [finalizeDrag, flushPendingDragFrame])

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) {
        window.cancelAnimationFrame(dragFrameRef.current)
      }
    }
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)
    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  useEffect(() => {
    if (!draggingSessionId) return
    const previousCursor = document.body.style.cursor
    document.body.style.cursor = 'grabbing'
    return () => {
      document.body.style.cursor = previousCursor
    }
  }, [draggingSessionId])

  const handleTabMouseDown = (event: React.MouseEvent, index: number) => {
    if (event.button !== 0) return
    dragTabBoundsRef.current = tabs.flatMap((tab) => {
      const el = tabRefs.current.get(tab.sessionId)
      if (!el) return []
      const rect = el.getBoundingClientRect()
      return [{
        sessionId: tab.sessionId,
        left: rect.left,
        right: getRectRight(rect),
        width: rect.width,
      }]
    })
    const currentTab = tabs[index]
    const cachedRect = currentTab ? getCachedTabBounds(currentTab.sessionId) : null
    const rect = cachedRect ?? event.currentTarget.getBoundingClientRect()
    pendingDragRef.current = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      tabLeft: rect.left,
      tabRight: getRectRight(rect),
    }
  }

  const handleTabClick = (sessionId: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    setActiveTab(sessionId)
  }

  const handleScrollRegionMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== scrollRef.current) return
    const startDragging = startDraggingRef.current
    if (!startDragging) return
    void startDragging().catch(() => {})
  }, [])

  const draggingIndex = draggingSessionId
    ? tabs.findIndex((tab) => tab.sessionId === draggingSessionId)
    : -1

  const getDragNudgeDirection = (index: number): -1 | 0 | 1 => {
    if (draggingIndex === -1 || dragOverIndex === null || index === draggingIndex) return 0
    if (dragOverIndex < draggingIndex && index >= dragOverIndex && index < draggingIndex) return 1
    if (dragOverIndex > draggingIndex && index <= dragOverIndex && index > draggingIndex) return -1
    return 0
  }

  return (
    <div
      data-testid="tab-bar"
      className="tab-bar-shell flex min-h-11 items-stretch select-none"
    >

      {canScrollLeft && (
        <button onClick={() => scroll('left')} className="flex h-11 w-7 flex-shrink-0 items-center justify-center text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]">
          <span className="material-symbols-outlined text-[16px]">chevron_left</span>
        </button>
      )}

      <div
        ref={scrollRef}
        className="tab-bar-hit-area flex-1 flex items-stretch overflow-x-hidden"
        onDragOver={(e) => e.preventDefault()}
        onMouseDown={handleScrollRegionMouseDown}
      >
        {tabs.map((tab, index) => (
          <TabItem
            key={tab.sessionId}
            ref={(node) => { tabRefs.current.set(tab.sessionId, node) }}
            tab={tab}
            isRunning={runningSessionIds.has(tab.sessionId)}
            isActive={tab.sessionId === activeTabId}
            isDragOver={dragOverIndex === index}
            isDragging={tab.sessionId === draggingSessionId}
            dragNudgeDirection={getDragNudgeDirection(index)}
            runningLabel={t('tabs.sessionRunning')}
            onClick={() => handleTabClick(tab.sessionId)}
            onClose={() => handleClose(tab.sessionId)}
            onContextMenu={(e) => handleContextMenu(e, tab.sessionId)}
            onMouseDown={(event) => handleTabMouseDown(event, index)}
          />
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-1 border-l border-[var(--color-border)]/70 px-2">
        {isDesktop && isActiveSessionTab && (
          <OpenProjectMenu path={openProjectPath} />
        )}
        <ToolbarIconButton
          icon={<SquareTerminal size={17} strokeWidth={1.9} />}
          label={t('tabs.openTerminal')}
          onClick={() => {
            if (activeTabId && isActiveSessionTab) {
              useTerminalPanelStore.getState().togglePanel(activeTabId)
              return
            }
            useTabStore.getState().openTerminalTab()
          }}
          active={isTerminalPanelOpen}
        />
        {isActiveSessionTab && activeTabId && (
          <ToolbarIconButton
            icon={isWorkspacePanelOpen ? <FolderOpen size={18} strokeWidth={1.9} /> : <Folder size={18} strokeWidth={1.9} />}
            label={t(isWorkspacePanelOpen ? 'tabs.hideWorkspace' : 'tabs.showWorkspace')}
            onClick={() => useWorkspacePanelStore.getState().togglePanel(activeTabId)}
            active={isWorkspacePanelOpen}
          />
        )}
      </div>

      {isDesktop && (
        <div
          data-testid="tab-bar-drag-gutter"
          data-desktop-drag-region
          aria-hidden="true"
          className={`min-h-11 flex-shrink-0 ${showWindowControls ? 'w-3' : 'w-4'}`}
        />
      )}

      {canScrollRight && (
        <button onClick={() => scroll('right')} className="flex h-11 w-7 flex-shrink-0 items-center justify-center text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]">
          <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        </button>
      )}

      <WindowControls />

      {contextMenu && (
        <div
          className="fixed z-50 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] py-1 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y, boxShadow: 'var(--shadow-dropdown)' }}
        >
          <button
            onClick={() => { handleClose(contextMenu.sessionId); setContextMenu(null) }}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('tabs.close')}
          </button>
          <button
            onClick={() => handleCloseOthers(contextMenu.sessionId)}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('tabs.closeOthers')}
          </button>
          <button
            onClick={() => handleCloseLeft(contextMenu.sessionId)}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('tabs.closeLeft')}
          </button>
          <button
            onClick={() => handleCloseRight(contextMenu.sessionId)}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('tabs.closeRight')}
          </button>
          <div className="my-1 border-t border-[var(--color-border)]" />
          <button
            onClick={handleCloseAll}
            className="w-full px-3 py-1.5 text-xs text-left text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)]"
          >
            {t('tabs.closeAll')}
          </button>
        </div>
      )}

      {pendingCloseRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30">
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 max-w-sm w-full mx-4" style={{ boxShadow: 'var(--shadow-dropdown)' }}>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
              {pendingCloseRequest.runningSessionIds.length > 1
                ? t('tabs.closeAllConfirmTitle')
                : t('tabs.closeConfirmTitle')}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              {pendingCloseRequest.runningSessionIds.length > 1
                ? t('tabs.closeAllConfirmMessage', { count: pendingCloseRequest.runningSessionIds.length })
                : t('tabs.closeConfirmMessage')}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setPendingCloseRequest(null)} className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => {
                  closeTabsWithPolicy(pendingCloseRequest.tabs, pendingCloseRequest.runningSessionIds, false)
                  setPendingCloseRequest(null)
                }}
                className="px-3 py-1.5 text-xs rounded-lg border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]"
              >
                {t('tabs.closeConfirmKeep')}
              </button>
              <button
                onClick={() => {
                  closeTabsWithPolicy(pendingCloseRequest.tabs, pendingCloseRequest.runningSessionIds, true)
                  setPendingCloseRequest(null)
                }}
                className="px-3 py-1.5 text-xs rounded-lg bg-[var(--color-brand)] text-white hover:opacity-90"
              >
                {pendingCloseRequest.runningSessionIds.length > 1
                  ? t('tabs.closeAllConfirmStop')
                  : t('tabs.closeConfirmStop')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TabItem = forwardRef<HTMLDivElement, {
  tab: Tab
  isRunning: boolean
  isActive: boolean
  isDragOver: boolean
  isDragging: boolean
  dragNudgeDirection: -1 | 0 | 1
  runningLabel: string
  onClick: () => void
  onClose: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onMouseDown: (event: React.MouseEvent) => void
}>(({ tab, isRunning, isActive, isDragOver, isDragging, dragNudgeDirection, runningLabel, onClick, onClose, onContextMenu, onMouseDown }, ref) => {
  return (
    <div
      ref={ref}
      data-dragging={isDragging ? 'true' : 'false'}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      className={`
        tab-bar-hit-area group relative flex min-h-11 flex-shrink-0 items-center gap-1.5 px-3
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
        ${isDragging ? 'transition-[background-color,opacity,transform] duration-75 ease-out' : 'transition-[background-color,box-shadow,opacity,transform,width] duration-150 ease-out'}
        ${isActive
          ? 'z-10 rounded-t-[13px] border-x border-t border-b-0 border-[color-mix(in_srgb,var(--color-brand)_34%,var(--color-border))] bg-[color-mix(in_srgb,var(--color-surface)_90%,transparent)] shadow-[inset_0_2px_0_var(--color-brand),inset_0_1px_0_rgba(255,255,255,0.14),0_1px_0_var(--color-surface),0_10px_24px_rgba(0,0,0,0.12),0_0_18px_color-mix(in_srgb,var(--color-brand)_14%,transparent)]'
          : 'rounded-t-[12px] border border-transparent bg-transparent hover:border-[color-mix(in_srgb,var(--color-border)_52%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-surface-hover)_72%,transparent)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_8px_20px_rgba(0,0,0,0.08)]'
        }
        ${isDragging ? 'z-30 opacity-[0.98] will-change-transform ring-1 ring-[color-mix(in_srgb,var(--color-brand)_35%,var(--color-border))]' : ''}
        ${isDragOver ? 'before:absolute before:left-0 before:top-[4px] before:bottom-[4px] before:w-[3px] before:bg-[var(--color-brand)] before:rounded-full before:shadow-[0_0_0_1px_rgba(255,255,255,0.25)]' : ''}
      `}
      style={{
        width: TAB_WIDTH,
        maxWidth: TAB_WIDTH,
        transitionProperty: isDragging
          ? 'background-color,opacity,transform'
          : undefined,
        transitionDuration: isDragging ? '0ms' : undefined,
        transitionTimingFunction: dragNudgeDirection !== 0
          ? 'cubic-bezier(0.2, 0.8, 0.2, 1)'
          : undefined,
        transform: dragNudgeDirection !== 0
          ? `translateX(${dragNudgeDirection * DRAG_SLOT_SHIFT}px)`
          : undefined,
      }}
    >
      {tab.type === 'session' && isRunning && (
        <span
          className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-success)] animate-pulse"
          aria-label={runningLabel}
          title={runningLabel}
        />
      )}
      {tab.type === 'session' && tab.status === 'error' && (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-error)] flex-shrink-0" />
      )}
      {tab.type === 'settings' && (
        <span className="material-symbols-outlined text-[14px] flex-shrink-0 text-[var(--color-text-tertiary)]">settings</span>
      )}
      {tab.type === 'scheduled' && (
        <span className="material-symbols-outlined text-[14px] flex-shrink-0 text-[var(--color-text-tertiary)]">schedule</span>
      )}
      {tab.type === 'terminal' && (
        <span className="material-symbols-outlined text-[14px] flex-shrink-0 text-[var(--color-text-tertiary)]">terminal</span>
      )}

      <span className={`flex-1 truncate text-xs ${isActive ? 'text-[var(--color-text-primary)] font-medium' : 'text-[var(--color-text-secondary)]'}`}>
        {tab.title || 'Untitled'}
      </span>

      <button
        type="button"
        aria-label={`Close ${tab.title || 'Untitled'}`}
        onMouseDown={(e) => { e.stopPropagation() }}
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="flex-shrink-0 -mr-0.5 inline-flex h-3 w-3 items-center justify-center bg-transparent p-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-[opacity,color] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none"
      >
        <span className="material-symbols-outlined text-[11px] leading-none">close</span>
      </button>
    </div>
  )
})
TabItem.displayName = 'TabItem'

function ToolbarIconButton({
  icon,
  label,
  onClick,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  active?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      data-active={active ? 'true' : 'false'}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] ${
        active
          ? 'bg-[var(--color-surface-hover)] text-[var(--color-text-primary)]'
          : 'text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]'
      }`}
    >
      {icon}
    </button>
  )
}
