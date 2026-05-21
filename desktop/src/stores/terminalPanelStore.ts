import { create } from 'zustand'

export const TERMINAL_PANEL_DEFAULT_HEIGHT = 300
export const TERMINAL_PANEL_MIN_HEIGHT = 220
export const TERMINAL_PANEL_MAX_HEIGHT = 560

type TerminalPanelSessionState = {
  isOpen: boolean
}

type TerminalPanelStore = {
  panelBySession: Record<string, TerminalPanelSessionState | undefined>
  height: number

  isPanelOpen: (sessionId: string) => boolean
  openPanel: (sessionId: string) => void
  closePanel: (sessionId: string) => void
  togglePanel: (sessionId: string) => void
  setHeight: (height: number) => void
  clearSession: (sessionId: string) => void
}

const DEFAULT_PANEL_STATE: TerminalPanelSessionState = {
  isOpen: false,
}

function getSessionPanelState(
  panelBySession: Record<string, TerminalPanelSessionState | undefined>,
  sessionId: string,
) {
  return panelBySession[sessionId] ?? DEFAULT_PANEL_STATE
}

function removeRecordKey<T>(record: Record<string, T>, key: string) {
  if (!(key in record)) return record
  const { [key]: _removed, ...rest } = record
  return rest
}

export function clampTerminalPanelHeight(height: number) {
  if (!Number.isFinite(height)) return TERMINAL_PANEL_DEFAULT_HEIGHT
  const rounded = Math.round(height)
  return Math.min(TERMINAL_PANEL_MAX_HEIGHT, Math.max(TERMINAL_PANEL_MIN_HEIGHT, rounded))
}

export const useTerminalPanelStore = create<TerminalPanelStore>((set, get) => ({
  panelBySession: {},
  height: TERMINAL_PANEL_DEFAULT_HEIGHT,

  isPanelOpen: (sessionId) => getSessionPanelState(get().panelBySession, sessionId).isOpen,

  openPanel: (sessionId) =>
    set((state) => ({
      panelBySession: {
        ...state.panelBySession,
        [sessionId]: {
          ...getSessionPanelState(state.panelBySession, sessionId),
          isOpen: true,
        },
      },
    })),

  closePanel: (sessionId) =>
    set((state) => ({
      panelBySession: {
        ...state.panelBySession,
        [sessionId]: {
          ...getSessionPanelState(state.panelBySession, sessionId),
          isOpen: false,
        },
      },
    })),

  togglePanel: (sessionId) =>
    set((state) => {
      const panel = getSessionPanelState(state.panelBySession, sessionId)
      return {
        panelBySession: {
          ...state.panelBySession,
          [sessionId]: {
            ...panel,
            isOpen: !panel.isOpen,
          },
        },
      }
    }),

  setHeight: (height) => set({ height: clampTerminalPanelHeight(height) }),

  clearSession: (sessionId) =>
    set((state) => ({
      panelBySession: removeRecordKey(state.panelBySession, sessionId),
    })),
}))
