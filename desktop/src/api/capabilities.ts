import { api } from './client'
import type {
  CuratedCapabilitiesResponse,
  CuratedCapabilityItem,
  CuratedCapabilityKind,
} from '../types/capability'

export const capabilitiesApi = {
  listCurated: () =>
    api.get<CuratedCapabilitiesResponse>('/api/capabilities/curated'),

  setEnabled: (kind: CuratedCapabilityKind, id: string, enabled: boolean) =>
    api.put<{ ok: true; item: CuratedCapabilityItem }>(
      `/api/capabilities/curated/${kind}/${encodeURIComponent(id)}`,
      { enabled },
    ),
}
