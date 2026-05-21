import { api } from './client'
import type { SkillMeta, SkillDetail } from '../types/skill'
import type { CapabilityInstallLocation } from '../types/capability'

export type SkillListResponse = {
  skills: SkillMeta[]
  installLocations?: CapabilityInstallLocation[]
}

export const skillsApi = {
  list: (cwd?: string) => {
    const query = cwd ? `?cwd=${encodeURIComponent(cwd)}` : ''
    return api.get<SkillListResponse>(`/api/skills${query}`, { timeout: 120_000 })
  },

  detail: (source: string, name: string, cwd?: string) => {
    const query = new URLSearchParams({
      source,
      name,
    })
    if (cwd) query.set('cwd', cwd)

    return api.get<{ detail: SkillDetail }>(
      `/api/skills/detail?${query.toString()}`,
      { timeout: 120_000 },
    )
  },
}
