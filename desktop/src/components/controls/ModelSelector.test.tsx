import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { ModelSelector } from './ModelSelector'
import { GMASTER_MANAGED_PROVIDER_ID } from '../../constants/gmasterProvider'
import { useProviderStore } from '../../stores/providerStore'
import { useSessionRuntimeStore } from '../../stores/sessionRuntimeStore'
import { useSettingsStore } from '../../stores/settingsStore'
import type { SavedProvider } from '../../types/provider'

vi.mock('../../i18n', () => ({
  useTranslation: () => (key: string) => {
    const translations: Record<string, string> = {
      'model.configuration': 'Model Configuration',
      'model.selectModel': 'Select Model',
      'settings.providers.default': 'Default',
      'settings.providers.officialName': 'Claude Official',
      'settings.providers.mainModel': 'Main Model',
      'settings.providers.haikuModel': 'Haiku Model',
      'settings.providers.sonnetModel': 'Sonnet Model',
      'settings.providers.opusModel': 'Opus Model',
      'settings.general.effort.low': 'Low',
      'settings.general.effort.medium': 'Medium',
      'settings.general.effort.high': 'High',
      'settings.general.effort.max': 'Max',
      'model.effort': 'Effort',
    }

    return translations[key] ?? key
  },
}))

const gmasterProvider: SavedProvider = {
  id: GMASTER_MANAGED_PROVIDER_ID,
  name: 'G-Master API',
  presetId: 'gmaster',
  baseUrl: 'https://gmapi.fun',
  apiKey: '',
  apiFormat: 'openai_responses',
  models: {
    main: 'deepseek-v4-pro',
    haiku: 'deepseek-v4-flash',
    sonnet: 'MiniMax-M2.7',
    opus: 'deepseek-v4-pro',
  },
  managed: { type: 'gmaster' },
}

const customProvider: SavedProvider = {
  id: 'custom-provider',
  name: 'Custom API',
  presetId: 'custom',
  baseUrl: 'https://example.com',
  apiKey: '',
  apiFormat: 'anthropic',
  models: {
    main: 'custom-main',
    haiku: 'custom-haiku',
    sonnet: 'custom-sonnet',
    opus: 'custom-opus',
  },
}

describe('ModelSelector', () => {
  beforeEach(() => {
    useProviderStore.setState({
      providers: [customProvider, gmasterProvider],
      activeId: GMASTER_MANAGED_PROVIDER_ID,
      hasLoadedProviders: true,
      isLoading: false,
      fetchProviders: vi.fn(),
    } as Partial<ReturnType<typeof useProviderStore.getState>>)
    useSettingsStore.setState({
      currentModel: { id: 'deepseek-v4-pro', name: 'deepseek-v4-pro', description: '', context: '' },
      availableModels: [],
      activeProviderName: 'G-Master API',
      effortLevel: 'medium',
    } as Partial<ReturnType<typeof useSettingsStore.getState>>)
    useSessionRuntimeStore.setState({ selections: {} })
  })

  it('places the G-Master API provider group before Claude official models', () => {
    render(<ModelSelector runtimeKey="session-1" />)

    fireEvent.click(screen.getByRole('button', { name: /deepseek-v4-pro/i }))

    const menu = screen.getByText('Model Configuration').parentElement
    expect(menu).not.toBeNull()
    const text = menu?.textContent ?? ''

    expect(text.indexOf('G-Master API')).toBeGreaterThanOrEqual(0)
    expect(text.indexOf('G-Master API')).toBeLessThan(text.indexOf('Claude Official'))
  })

  it('shows live G-Master catalog models in the provider group', () => {
    useProviderStore.setState({
      providers: [{
        ...gmasterProvider,
        availableModels: ['deepseek-v4-pro', 'claude-sonnet-4-6'],
      } as any],
      activeId: GMASTER_MANAGED_PROVIDER_ID,
      hasLoadedProviders: true,
      isLoading: false,
      fetchProviders: vi.fn(),
    } as Partial<ReturnType<typeof useProviderStore.getState>>)

    render(<ModelSelector runtimeKey="session-1" />)

    fireEvent.click(screen.getByRole('button', { name: /deepseek-v4-pro/i }))

    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument()
  })
})
