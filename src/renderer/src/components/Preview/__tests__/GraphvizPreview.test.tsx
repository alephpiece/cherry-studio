import GraphvizPreview from '@renderer/components/Preview/graphviz'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Use vi.hoisted to manage mocks
const mocks = vi.hoisted(() => ({
  useImageTools: vi.fn(),
  vizInstance: {
    renderSVGElement: vi.fn()
  },
  vizInitializer: {
    get: vi.fn()
  },
  ImageToolbar: vi.fn(() => <div data-testid="image-toolbar">ImageToolbar</div>)
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

vi.mock('@renderer/components/ActionTools', () => ({
  useImageTools: mocks.useImageTools
}))

vi.mock('@renderer/components/Preview/ImageToolbar', () => ({
  default: mocks.ImageToolbar
}))

vi.mock('@renderer/utils/asyncInitializer', () => ({
  AsyncInitializer: class {
    constructor() {
      return mocks.vizInitializer
    }
  }
}))

describe('GraphvizPreview', () => {
  const dotCode = 'digraph { a -> b }'

  beforeEach(() => {
    // Provide default implementations for all mocks
    mocks.useImageTools.mockReturnValue({
      pan: { current: { x: 0, y: 0, scale: 1 } },
      zoom: vi.fn(),
      copy: vi.fn(),
      download: vi.fn()
    })
    mocks.vizInitializer.get.mockResolvedValue(mocks.vizInstance)

    // Mock successful rendering
    const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svgElement.innerHTML = '<g><text>graph</text></g>'
    mocks.vizInstance.renderSVGElement.mockReturnValue(svgElement)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should match snapshot', () => {
      const { container } = render(<GraphvizPreview enableToolbar>{dotCode}</GraphvizPreview>)
      expect(container).toMatchSnapshot()
    })

    it('should display an error message when rendering fails', async () => {
      const errorMessage = 'Syntax Error'
      mocks.vizInstance.renderSVGElement.mockImplementation(() => {
        throw new Error(errorMessage)
      })

      render(<GraphvizPreview>{dotCode}</GraphvizPreview>)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })
  })

  describe('ImageToolbar', () => {
    it('should render ImageToolbar if enableToolbar is true', () => {
      render(<GraphvizPreview enableToolbar>{dotCode}</GraphvizPreview>)

      expect(screen.getByTestId('image-toolbar')).toBeInTheDocument()
    })

    it('should not render ImageToolbar if enableToolbar is false', () => {
      render(<GraphvizPreview enableToolbar={false}>{dotCode}</GraphvizPreview>)

      expect(screen.queryByTestId('image-toolbar')).not.toBeInTheDocument()
    })
  })
})
