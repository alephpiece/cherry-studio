import PlantUmlPreview from '@renderer/components/Preview/plantuml'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  useImageTools: vi.fn(),
  ImageToolbar: vi.fn(() => <div data-testid="image-toolbar">ImageToolbar</div>),
  renderSvgInShadowHost: vi.fn()
}))

vi.mock('antd', async (importOriginal) => {
  const antd = await importOriginal<typeof import('antd')>()
  return {
    ...antd,
    Spin: ({ children, spinning }) => (
      <div data-testid="spin" data-spinning={spinning}>
        {children}
      </div>
    )
  }
})

vi.mock('@renderer/components/ActionTools', () => ({
  useImageTools: mocks.useImageTools
}))

vi.mock('@renderer/components/Preview/ImageToolbar', () => ({
  default: mocks.ImageToolbar
}))

vi.mock('@renderer/components/Preview/utils', () => ({
  renderSvgInShadowHost: mocks.renderSvgInShadowHost
}))

vi.mock('lodash', async () => {
  const actual = await import('lodash')
  return {
    ...actual,
    debounce: vi.fn((fn) => {
      const debounced = (...args: any[]) => fn(...args)
      debounced.cancel = vi.fn()
      return debounced
    })
  }
})

describe('PlantUmlPreview', () => {
  const diagram = 'A -> B'
  const mockSvgContent = '<svg>A -> B</svg>'

  beforeEach(() => {
    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockSvgContent)
    } as Response)

    mocks.useImageTools.mockReturnValue({
      pan: { current: { x: 0, y: 0, scale: 1 } },
      zoom: vi.fn(),
      copy: vi.fn(),
      download: vi.fn(),
      dialog: vi.fn()
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('should match snapshot', async () => {
    const { container, findByTestId } = render(<PlantUmlPreview enableToolbar>{diagram}</PlantUmlPreview>)

    // Wait for the final state with the toolbar
    await findByTestId('image-toolbar')

    expect(container).toMatchSnapshot()
  })

  it('should show loading indicator initially and call fetch', async () => {
    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'true')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('should call renderSvgInShadowHost with fetched content on success', async () => {
    const { container } = render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      const previewElement = container.querySelector('.plantuml-preview')
      expect(mocks.renderSvgInShadowHost).toHaveBeenCalledWith(previewElement, mockSvgContent)
      expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'false')
    })
  })

  it('should render ImageToolbar when enabled', async () => {
    render(<PlantUmlPreview enableToolbar>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(screen.getByTestId('image-toolbar')).toBeInTheDocument()
    })
  })

  it('should display a network error message when fetch fails', async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'))

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(
        screen.getByText('Network Error: Unable to connect to PlantUML server. Please check your network connection.')
      ).toBeInTheDocument()
      expect(screen.queryByTestId('image-toolbar')).not.toBeInTheDocument()
    })
  })

  it('should display a syntax error message for 400 response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 400
    } as Response)

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(
        screen.getByText(
          'Diagram rendering failed (400): This is likely due to a syntax error in the diagram. Please check your code.'
        )
      ).toBeInTheDocument()
    })
  })

  it('should display a server error message for 503 response', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 503
    } as Response)

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(
        screen.getByText(
          'Diagram rendering failed (503): The PlantUML server is temporarily unavailable. Please try again later.'
        )
      ).toBeInTheDocument()
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
      expect(screen.getByText("Diagram rendering failed, server returned: 418 I'm a teapot")).toBeInTheDocument()
    })
  })

  it('should not call fetch if children is empty', async () => {
    render(<PlantUmlPreview>{''}</PlantUmlPreview>)

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
