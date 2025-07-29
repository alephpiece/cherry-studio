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
    })

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
    // @ts-ignore mock fetch success
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockSvgContent)
    })

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'true')

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  it('should call renderSvgInShadowHost with fetched content on success', async () => {
    // @ts-ignore mock fetch success
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockSvgContent)
    })

    const { container } = render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      const previewElement = container.querySelector('.plantuml-preview')
      expect(mocks.renderSvgInShadowHost).toHaveBeenCalledWith(previewElement, mockSvgContent)
      expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'false')
    })
  })

  it('should render ImageToolbar when enabled', async () => {
    // @ts-ignore mock fetch success
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockSvgContent)
    })

    render(<PlantUmlPreview enableToolbar>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(screen.getByTestId('image-toolbar')).toBeInTheDocument()
    })
  })

  it('should display an error message when fetch fails', async () => {
    // @ts-ignore mock fetch error
    global.fetch.mockRejectedValue(new Error('Network Error'))

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(screen.getByText('Network Error')).toBeInTheDocument()
      expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'false')
      expect(screen.queryByTestId('image-toolbar')).not.toBeInTheDocument()
    })
  })

  it('should display an error message when response is not ok', async () => {
    // @ts-ignore mock fetch error
    global.fetch.mockResolvedValue({
      ok: false
    })

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(screen.getByText('Error: there may be some syntax errors in the diagram.')).toBeInTheDocument()
      expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'false')
    })
  })

  it('should not call fetch if children is empty', async () => {
    render(<PlantUmlPreview>{''}</PlantUmlPreview>)

    expect(global.fetch).not.toHaveBeenCalled()
  })
})
