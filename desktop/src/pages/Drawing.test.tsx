import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Drawing } from './Drawing'
import { imagesApi, type ImageHistoryItem } from '../api/images'
import { ApiError } from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'
import themeCss from '../theme/globals.css?raw'

vi.mock('../api/images', () => ({
  imagesApi: {
    generate: vi.fn(),
    enhancePrompt: vi.fn(),
    listHistory: vi.fn(),
  },
}))

describe('Drawing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSettingsStore.setState({ locale: 'en' })
    vi.mocked((imagesApi as typeof imagesApi & {
      listHistory: () => Promise<{ history: Array<{
        id: string
        prompt: string
        size: '1024x1024'
        image: {
          src: string
          dataUrl?: string
          mimeType: string
          model: string
          revisedPrompt: string | null
        }
        createdAt: number
      }> }>
    }).listHistory).mockResolvedValue({ history: [] })
  })

  it('generates a gpt-image-2 image from the prompt and selected size', async () => {
    vi.mocked(imagesApi.generate).mockResolvedValue({
      image: {
        src: 'data:image/png;base64,abc123',
        dataUrl: 'data:image/png;base64,abc123',
        mimeType: 'image/png',
        model: 'gpt-image-2',
        revisedPrompt: 'A cinematic neon cat poster',
      },
    })

    render(<Drawing />)

    const prompt = '  neon cat poster\nwith exact spacing  '
    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: prompt },
    })
    fireEvent.click(screen.getByRole('radio', { name: /1920x1080/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    await waitFor(() => expect(imagesApi.generate).toHaveBeenCalledWith({
      prompt,
      size: '1920x1080',
    }))
    expect(await screen.findByAltText(/neon cat poster/)).toHaveAttribute('src', 'data:image/png;base64,abc123')
    expect(screen.getByText('A cinematic neon cat poster')).toBeInTheDocument()
  })

  it('keeps the visible generated data URL when selecting the new thumbnail', async () => {
    vi.mocked(imagesApi.generate).mockResolvedValue({
      image: {
        src: 'data:image/png;base64,abc123',
        dataUrl: 'data:image/png;base64,abc123',
        mimeType: 'image/png',
        model: 'gpt-image-2',
        revisedPrompt: null,
      },
      historyItem: {
        id: 'img-1',
        prompt: 'neon cat poster',
        size: '1024x1024',
        image: {
          src: 'http://127.0.0.1:3456/api/images/history/img-1/file',
          mimeType: 'image/png',
          model: 'gpt-image-2',
          revisedPrompt: null,
        },
        createdAt: 1_760_000_000_000,
      },
    })

    render(<Drawing />)

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'neon cat poster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    const preview = await screen.findByAltText('neon cat poster')
    expect(preview).toHaveAttribute('src', 'data:image/png;base64,abc123')

    const thumbnails = await screen.findAllByRole('button', { name: 'Generated image history item' })
    fireEvent.click(thumbnails[0]!)

    expect(screen.getByAltText('neon cat poster')).toHaveAttribute('src', 'data:image/png;base64,abc123')
  })

  it('uses the theme-colored loading treatment while generation is running', () => {
    vi.mocked(imagesApi.generate).mockImplementation(() => new Promise(() => {}))

    render(<Drawing />)

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'neon cat poster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    const button = screen.getByRole('button', { name: 'Generating' })
    expect(button).toHaveClass('drawing-generate-button--loading')
    expect(button.querySelector('.drawing-generate-button__icon')).toBeInTheDocument()
    expect(button.querySelector('.drawing-generate-button__label')).toHaveTextContent('Generating')
  })

  it('uses the theme-colored loading treatment while prompt enhancement is running', () => {
    vi.mocked(imagesApi.enhancePrompt).mockImplementation(() => new Promise(() => {}))

    render(<Drawing />)

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'neon cat poster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enhance prompt' }))

    const button = screen.getByRole('button', { name: 'Enhancing...' })
    expect(button).toHaveClass('drawing-generate-button--loading')
    expect(button.querySelector('.drawing-generate-button__icon')).toBeInTheDocument()
    expect(button.querySelector('.drawing-generate-button__label')).toHaveTextContent('Enhancing...')
  })

  it('keeps the loading icon spin separate from the label sheen animation', () => {
    expect(themeCss).toContain('@keyframes drawing-generate-theme-spin')
    expect(themeCss).toMatch(
      /\.drawing-generate-button--loading \.drawing-generate-button__icon\s*\{[^}]*drawing-generate-theme-spin[^}]*drawing-generate-theme-text/s,
    )
    expect(themeCss).toMatch(
      /\.drawing-generate-button--loading \.drawing-generate-button__label\s*\{[^}]*drawing-generate-theme-text/s,
    )
  })

  it('restores the latest generated image from drawing history after remounting', async () => {
    const historyItem = {
      id: 'img-1',
      prompt: 'neon cat poster',
      size: '1024x1024' as const,
      image: {
        src: 'http://127.0.0.1:3456/api/images/history/img-1/file',
        mimeType: 'image/png',
        model: 'gpt-image-2',
        revisedPrompt: 'A cinematic neon cat poster',
      },
      createdAt: 1_760_000_000_000,
    }

    vi.mocked(imagesApi.generate).mockResolvedValue({
      image: historyItem.image,
      historyItem,
    })

    const { unmount } = render(<Drawing />)

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'neon cat poster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    expect(await screen.findByAltText('neon cat poster')).toHaveAttribute('src', historyItem.image.src)

    unmount()
    vi.mocked((imagesApi as typeof imagesApi & {
      listHistory: () => Promise<{ history: typeof historyItem[] }>
    }).listHistory).mockResolvedValue({ history: [historyItem] })

    render(<Drawing />)

    expect(await screen.findByAltText('neon cat poster')).toHaveAttribute('src', historyItem.image.src)
    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(screen.getAllByText('neon cat poster').length).toBeGreaterThan(0)
  })

  it('shows common image size presets', () => {
    render(<Drawing />)

    for (const label of [
      '1024x1024',
      '1024x1280',
      '1024x1365',
      '1024x1536',
      '1080x1920',
      '1536x1024',
      '1365x1024',
      '1920x1080',
      '2048x1024',
    ]) {
      expect(screen.getByRole('radio', { name: new RegExp(label) })).toBeInTheDocument()
    }
  })

  it('keeps drawing controls focused on one generate action and model-backed prompt enhancement', () => {
    render(<Drawing />)

    expect(screen.queryByRole('button', { name: 'Prompt assistant' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generate image' })).not.toBeInTheDocument()
    expect(screen.getByText('Prompt enhancement')).toBeInTheDocument()
    expect(screen.getByText(/deepseek-v4-flash/i)).toBeInTheDocument()
  })

  it('enhances the prompt through the images API and writes the returned prompt back', async () => {
    vi.mocked(imagesApi.enhancePrompt).mockResolvedValue({
      prompt: 'A cinematic neon cat poster with dramatic rim lighting and a bold 16:9 composition',
      model: 'deepseek-v4-flash',
    })

    render(<Drawing />)

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'neon cat poster' },
    })
    fireEvent.click(screen.getByRole('radio', { name: /1920x1080/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Enhance prompt' }))

    await waitFor(() => expect(imagesApi.enhancePrompt).toHaveBeenCalledWith({
      prompt: 'neon cat poster',
      size: '1920x1080',
    }))
    expect(screen.getByRole('textbox', { name: /Prompt/ })).toHaveValue(
      'A cinematic neon cat poster with dramatic rim lighting and a bold 16:9 composition',
    )
  })

  it('shows a drawing-specific timeout message', async () => {
    vi.mocked(imagesApi.generate).mockRejectedValue(new Error('Request timed out after 330s'))

    render(<Drawing />)

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'neon cat poster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    expect(await screen.findByText(/image service did not return within 15 minutes/i)).toBeInTheDocument()
  })

  it('shows a drawing-specific upstream 524 timeout message', async () => {
    vi.mocked(imagesApi.generate).mockRejectedValue(new ApiError(504, {
      error: 'IMAGE_GENERATION_UPSTREAM_TIMEOUT',
      message: 'Image generation failed with HTTP 524',
    }))

    render(<Drawing />)

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'neon cat poster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    expect(await screen.findByText(/http 524/i)).toBeInTheDocument()
    expect(screen.getByText(/image channel timed out/i)).toBeInTheDocument()
  })

  it('does not show the previous image as the preview after a failed new generation', async () => {
    vi.mocked((imagesApi as typeof imagesApi & {
      listHistory: () => Promise<{ history: ImageHistoryItem[] }>
    }).listHistory).mockResolvedValue({
      history: [{
        id: 'img-1',
        prompt: 'old successful prompt',
        size: '1024x1024',
        image: {
          src: 'http://127.0.0.1:3456/api/images/history/img-1/file',
          mimeType: 'image/png',
          model: 'gpt-image-2',
          revisedPrompt: 'Old revised prompt',
        },
        createdAt: 1_760_000_000_000,
      }],
    })
    vi.mocked(imagesApi.generate).mockRejectedValue(new ApiError(504, {
      error: 'IMAGE_GENERATION_UPSTREAM_TIMEOUT',
      message: 'Image generation failed with HTTP 524',
    }))

    render(<Drawing />)

    expect(await screen.findByAltText('old successful prompt')).toHaveAttribute(
      'src',
      'http://127.0.0.1:3456/api/images/history/img-1/file',
    )

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'new prompt that times out' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    expect(await screen.findByText(/http 524/i)).toBeInTheDocument()
    expect(screen.queryByAltText('new prompt that times out')).not.toBeInTheDocument()
    expect(screen.queryByText('Old revised prompt')).not.toBeInTheDocument()
    expect(screen.getByText('No image yet')).toBeInTheDocument()
  })

  it('shows a drawing-specific upstream service message', async () => {
    vi.mocked(imagesApi.generate).mockRejectedValue(new Error('upstream error: do request failed (request id: abc)'))

    render(<Drawing />)

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'neon cat poster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    expect(await screen.findByText(/image service request failed/i)).toBeInTheDocument()
  })

  it('shows a drawing-specific interrupted request message instead of raw Load failed', async () => {
    vi.mocked(imagesApi.generate).mockRejectedValue(new TypeError('Load failed'))

    render(<Drawing />)

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'a detailed portrait prompt with soft light and mirror reflections' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    expect(await screen.findByText(/image request was interrupted/i)).toBeInTheDocument()
    expect(screen.queryByText('Load failed')).not.toBeInTheDocument()
  })

  it('shows a drawing-specific interrupted request message for classified API errors', async () => {
    vi.mocked(imagesApi.generate).mockRejectedValue(new ApiError(502, {
      error: 'IMAGE_GENERATION_UPSTREAM_REQUEST_FAILED',
      message: 'G-Master API image request was interrupted before returning a response',
    }))

    render(<Drawing />)

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'a detailed portrait prompt with soft light and mirror reflections' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    expect(await screen.findByText(/image request was interrupted/i)).toBeInTheDocument()
  })

  it('shows a drawing-specific upstream permission message', async () => {
    vi.mocked(imagesApi.generate).mockRejectedValue(new ApiError(403, {
      error: 'IMAGE_GENERATION_UPSTREAM_FORBIDDEN',
      message: 'openai_error',
    }))

    render(<Drawing />)

    fireEvent.change(screen.getByRole('textbox', { name: /Prompt/ }), {
      target: { value: 'neon cat poster' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))

    expect(await screen.findByText(/g-master api image channel returned 403/i)).toBeInTheDocument()
  })

  it('uses theme-aware surfaces instead of fixed light backgrounds', () => {
    const { container } = render(<Drawing />)

    const classNames = Array.from(container.querySelectorAll('[class]'))
      .map((element) => element.getAttribute('class') ?? '')
      .join('\n')

    expect(classNames).not.toMatch(/bg-white|#ffffff|#fbfbff|#f8f8fb|#f7f4ff|#f2efff/)
  })
})
