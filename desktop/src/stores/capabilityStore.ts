import { create } from 'zustand'
import { capabilitiesApi } from '../api/capabilities'
import type {
  CuratedCapabilitiesResponse,
  CuratedCapabilityItem,
  CuratedCapabilityKind,
} from '../types/capability'

type CapabilityStore = CuratedCapabilitiesResponse & {
  isLoading: boolean
  error: string | null
  isToggling: Record<string, boolean>
  fetchCuratedCapabilities: () => Promise<void>
  setCuratedCapabilityEnabled: (
    kind: CuratedCapabilityKind,
    id: string,
    enabled: boolean,
  ) => Promise<CuratedCapabilityItem>
}

function keyFor(kind: CuratedCapabilityKind, id: string): string {
  return `${kind}:${id}`
}

export const useCapabilityStore = create<CapabilityStore>((set, get) => ({
  skills: [],
  agents: [],
  warnings: [],
  isLoading: false,
  error: null,
  isToggling: {},

  fetchCuratedCapabilities: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await capabilitiesApi.listCurated()
      set({ ...response, isLoading: false })
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error
          ? error.message
          : 'Failed to load curated capabilities',
      })
    }
  },

  setCuratedCapabilityEnabled: async (kind, id, enabled) => {
    const key = keyFor(kind, id)
    set(state => ({
      isToggling: { ...state.isToggling, [key]: true },
      error: null,
    }))

    try {
      const { item } = await capabilitiesApi.setEnabled(kind, id, enabled)
      await get().fetchCuratedCapabilities()
      return item
    } finally {
      set(state => {
        const next = { ...state.isToggling }
        delete next[key]
        return { isToggling: next }
      })
    }
  },
}))
