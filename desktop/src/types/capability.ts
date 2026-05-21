export type CuratedCapabilityKind = 'skills' | 'agents'

export type CuratedCapabilityItem = {
  id: string
  kind: CuratedCapabilityKind
  displayName: string
  description: string
  category: string
  author: 'GasterCode'
  version: string
  defaultEnabled: true
  tags: string[]
  enabled: boolean
}

export type CuratedCapabilitiesResponse = {
  skills: CuratedCapabilityItem[]
  agents: CuratedCapabilityItem[]
  warnings?: string[]
}

export type CapabilityInstallLocation = {
  id: string
  label: string
  path: string
  description: string
}
