import PlantUmlPreview from '@renderer/components/Preview/plantuml'
import { render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ImagePreviewLayout: vi.fn(({ children }) => <div data-testid="image-preview-layout">{children}</div>),
  renderSvgInShadowHost: vi.fn()
}))

vi.mock('@renderer/components/Preview/ImagePreviewLayout', () => ({
  default: mocks.ImagePreviewLayout
}))

vi.mock('@renderer/components/Preview/utils', () => ({
  renderSvgInShadowHost: mocks.renderSvgInShadowHost
}))

vi.mock('lodash', () => ({
  debounce: vi.fn((fn) => {
    const debounced = (...args: any[]) => fn(...args)
    debounced.cancel = vi.fn()
    return debounced
  })
}))

describe('PlantUmlPreview', () => {
  const diagram = 'A -> B'
  const mockSvgContent = '<svg>A -> B</svg>'

  beforeEach(() => {
    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockSvgContent)
    } as Response)

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should match snapshot', async () => {
    const { container } = render(<PlantUmlPreview enableToolbar>{diagram}</PlantUmlPreview>)
    expect(container).toMatchSnapshot()
  })

  it('should call renderSvgInShadowHost with fetched content on success', async () => {
    const { container } = render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      const previewElement = container.querySelector('.plantuml-preview')
      expect(mocks.renderSvgInShadowHost).toHaveBeenCalledWith(previewElement, mockSvgContent)
    })
  })

  it('should display a network error message when fetch fails', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      // Check that ImagePreviewLayout was called with the error on the second call
      const calls = mocks.ImagePreviewLayout.mock.calls
      const lastCall = calls[calls.length - 1][0] // Get the props from the last call
      expect(lastCall.error).toBe(
        'Network Error: Unable to connect to PlantUML server. Please check your network connection.'
      )
    })
  })

  it('should display a syntax error message for 400 response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400
    } as Response)

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      // Check that ImagePreviewLayout was called with the error on the second call
      const calls = mocks.ImagePreviewLayout.mock.calls
      const lastCall = calls[calls.length - 1][0] // Get the props from the last call
      expect(lastCall.error).toBe(
        'Diagram rendering failed (400): This is likely due to a syntax error in the diagram. Please check your code.'
      )
    })
  })

  it('should display a server error message for 503 response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 503
    } as Response)

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      // Check that ImagePreviewLayout was called with the error on the second call
      const calls = mocks.ImagePreviewLayout.mock.calls
      const lastCall = calls[calls.length - 1][0] // Get the props from the last call
      expect(lastCall.error).toBe(
        'Diagram rendering failed (503): The PlantUML server is temporarily unavailable. Please try again later.'
      )
    })
  })

  it('should display a generic error for other non-ok responses', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 418,
      statusText: "I'm a teapot"
    } as Response)

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      // Check that ImagePreviewLayout was called with the error on the second call
      const calls = mocks.ImagePreviewLayout.mock.calls
      const lastCall = calls[calls.length - 1][0] // Get the props from the last call
      expect(lastCall.error).toBe("Diagram rendering failed, server returned: 418 I'm a teapot")
    })
  })

  it('should not call fetch if children is empty', async () => {
    render(<PlantUmlPreview>{''}</PlantUmlPreview>)

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
