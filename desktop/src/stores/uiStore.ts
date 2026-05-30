import { create } from 'zustand'
import { isThemeMode, THEME_MODES, type ThemeMode } from '../types/settings'
import { readMigratedStorage, writeMigratedStorage } from '../lib/storageMigration'

const THEME_STORAGE_KEY = 'gaster-code-theme'
const LEGACY_THEME_STORAGE_KEYS = ['cc-haha-theme']
const SIDEBAR_WIDTH_STORAGE_KEY = 'gaster-code-sidebar-width'
export const SIDEBAR_MIN_WIDTH = 240
export const SIDEBAR_DEFAULT_WIDTH = 280
export const SIDEBAR_MAX_WIDTH = 560
export const SIDEBAR_COLLAPSE_THRESHOLD = 220

function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)))
}

function getStoredTheme(): ThemeMode {
  try {
    const stored = readMigratedStorage(THEME_STORAGE_KEY, LEGACY_THEME_STORAGE_KEYS)
    if (isThemeMode(stored)) return stored
  } catch { /* localStorage unavailable */ }
  return 'white'
}

function getStoredSidebarWidth(): number {
  const stored = readMigratedStorage(SIDEBAR_WIDTH_STORAGE_KEY)
  const parsed = stored === null ? Number.NaN : Number.parseInt(stored, 10)
  if (!Number.isFinite(parsed)) return SIDEBAR_DEFAULT_WIDTH
  return clampSidebarWidth(parsed)
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') return
  document.documentElement.setAttribute('data-theme', theme)
  document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light'
}

export function initializeTheme() {
  applyTheme(getStoredTheme())
}

export type Toast = {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  duration?: number
}

export type SettingsTab =
  | 'account'
  | 'providers'
  | 'permissions'
  | 'activity'
  | 'general'
  | 'h5Access'
  | 'adapters'
  | 'terminal'
  | 'mcp'
  | 'agents'
  | 'skills'
  | 'memory'
  | 'plugins'
  | 'computerUse'
  | 'diagnostics'
  | 'about'

type ActiveView = 'code' | 'scheduled' | 'terminal' | 'history' | 'settings'

type UIStore = {
  theme: ThemeMode
  sidebarOpen: boolean
  sidebarWidth: number
  sidebarResizing: boolean
  activeView: ActiveView
  pendingSettingsTab: SettingsTab | null
  pendingMemoryPath: string | null
  activeModal: string | null
  toasts: Toast[]

  setTheme: (theme: ThemeMode) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  setSidebarWidth: (width: number, options?: { persist?: boolean }) => void
  setSidebarResizing: (resizing: boolean) => void
  setActiveView: (view: ActiveView) => void
  setPendingSettingsTab: (tab: SettingsTab | null) => void
  setPendingMemoryPath: (path: string | null) => void
  openModal: (id: string) => void
  closeModal: () => void
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

let toastCounter = 0

export const useUIStore = create<UIStore>((set) => ({
  theme: getStoredTheme(),
  sidebarOpen: true,
  sidebarWidth: getStoredSidebarWidth(),
  sidebarResizing: false,
  activeView: 'code',
  pendingSettingsTab: null,
  pendingMemoryPath: null,
  activeModal: null,
  toasts: [],

  setTheme: (theme) => {
    applyTheme(theme)
    writeMigratedStorage(THEME_STORAGE_KEY, theme, LEGACY_THEME_STORAGE_KEYS)
    set({ theme })
  },

  toggleTheme: () => {
    set((state) => {
      const currentIndex = THEME_MODES.indexOf(state.theme)
      const next = THEME_MODES[(currentIndex + 1) % THEME_MODES.length] ?? 'white'
      applyTheme(next)
      writeMigratedStorage(THEME_STORAGE_KEY, next, LEGACY_THEME_STORAGE_KEYS)
      return { theme: next }
    })
  },

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSidebarWidth: (width, options) => {
    if (!Number.isFinite(width)) return
    const nextWidth = clampSidebarWidth(width)
    if (options?.persist !== false) {
      writeMigratedStorage(SIDEBAR_WIDTH_STORAGE_KEY, String(nextWidth))
    }
    set({ sidebarWidth: nextWidth })
  },
  setSidebarResizing: (resizing) => set({ sidebarResizing: resizing }),
  setActiveView: (view) => set({ activeView: view }),
  setPendingSettingsTab: (tab) => set({ pendingSettingsTab: tab }),
  setPendingMemoryPath: (path) => set({ pendingMemoryPath: path }),
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),

  addToast: (toast) => {
    const id = `toast-${++toastCounter}`
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }))
    // Auto-remove after duration
    const duration = toast.duration ?? 4000
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
      }, duration)
    }
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
