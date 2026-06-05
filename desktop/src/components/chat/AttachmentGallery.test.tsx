// @vitest-environment jsdom

import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AttachmentGallery } from './AttachmentGallery'

describe('AttachmentGallery', () => {
  it('renders a compact quote preview for selected workspace text', () => {
    render(
      <AttachmentGallery
        variant="composer"
        attachments={[{
          id: 'selection-1',
          type: 'file',
          name: 'App.tsx',
          path: 'src/App.tsx',
          lineStart: 10,
          lineEnd: 12,
          quote: 'const value = calculate(input)\nreturn value',
        }]}
      />,
    )

    expect(document.body.textContent).toContain('App.tsx:L10-L12')
    expect(document.body.textContent).toContain('const value = calculate(input) return value')
  })

  it('keeps plain file chips on the one-line treatment', () => {
    render(
      <AttachmentGallery
        variant="composer"
        attachments={[{
          id: 'file-1',
          type: 'file',
          name: 'README.md',
          path: 'README.md',
        }]}
      />,
    )

    expect(document.body.textContent).toContain('README.md')
    expect(document.body.textContent).not.toContain(':L')
  })

  it('removes a quoted workspace attachment by id', () => {
    const onRemove = vi.fn()

    const view = render(
      <AttachmentGallery
        variant="composer"
        onRemove={onRemove}
        attachments={[{
          id: 'selection-1',
          type: 'file',
          name: 'App.tsx',
          path: 'src/App.tsx',
          lineStart: 10,
          quote: 'const value = 1',
        }]}
      />,
    )

    fireEvent.click(view.getByRole('button', { name: 'Remove App.tsx' }))

    expect(onRemove).toHaveBeenCalledWith('selection-1')
  })

  it('shows message images with full-content object fitting for tall screenshots', () => {
    const view = render(
      <AttachmentGallery
        variant="message"
        attachments={[{
          id: 'screenshot-1',
          type: 'image',
          name: 'tall-screenshot.png',
          data: 'data:image/png;base64,AAAA',
        }]}
      />,
    )

    const image = view.getByAltText('tall-screenshot.png')
    expect(image.className).toContain('object-contain')
    expect(image.className).not.toContain('object-cover')
  })
})
