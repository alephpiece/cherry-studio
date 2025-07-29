import SvgPreview from '@renderer/components/Preview/svg'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Use vi.hoisted to manage mocks
const mocks = vi.hoisted(() => ({
  useImageTools: vi.fn(),
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

describe('SvgPreview', () => {
  const svgContent = '<svg><rect width="100" height="100" /></svg>'
  const invalidSvgContent = '<svg><rect width="100" height="100"></svg>' // Missing closing tag

  beforeEach(() => {
    // Provide default implementations for all mocks
    mocks.useImageTools.mockReturnValue({
      pan: { current: { x: 0, y: 0, scale: 1 } },
      zoom: vi.fn(),
      copy: vi.fn(),
      download: vi.fn(),
      dialog: vi.fn()
    })

    // Mock Shadow DOM API
    Element.prototype.attachShadow = vi.fn().mockImplementation(function (this: HTMLElement) {
      const shadowRoot = document.createElement('div')
      // Copy content to simulate shadow DOM behavior
      shadowRoot.innerHTML = this.innerHTML
      Object.defineProperty(this, 'shadowRoot', {
        value: shadowRoot,
        writable: true
      })
      return shadowRoot as unknown as ShadowRoot
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should match snapshot', () => {
      const { container } = render(<SvgPreview enableToolbar>{svgContent}</SvgPreview>)
      expect(container).toMatchSnapshot()
    })

    it('should render the svg content inside a shadow DOM with loading state', async () => {
      const { container } = render(<SvgPreview>{svgContent}</SvgPreview>)
      const previewElement = container.querySelector('.svg-preview')

      expect(previewElement).not.toBeNull()

      // Wait for async rendering to complete
      await waitFor(() => {
        expect(Element.prototype.attachShadow).toHaveBeenCalledWith({ mode: 'open' })
      })

      // Verify Shadow DOM content
      const shadowRoot = previewElement?.shadowRoot
      expect(shadowRoot).not.toBeNull()
      // Check if it contains styles and SVG content
      expect(shadowRoot?.querySelector('style')).not.toBeNull()
      expect(shadowRoot?.querySelector('svg')).not.toBeNull()
      expect(shadowRoot?.querySelector('rect')).not.toBeNull()
    })

    it('should show loading state initially', () => {
      const { container } = render(<SvgPreview>{svgContent}</SvgPreview>)

      const spinElement = container.querySelector('[data-testid="spin"]')
      expect(spinElement).toBeInTheDocument()
    })
  })

  describe('error handling', () => {
    it('should display an error message when SVG parsing fails', async () => {
      render(<SvgPreview>{invalidSvgContent}</SvgPreview>)

      // Wait for debounced rendering and error to appear
      await waitFor(() => {
        expect(screen.getByText(/SVG parsing error/)).toBeInTheDocument()
      })
    })

    it('should display an error message when content is not valid SVG', async () => {
      render(<SvgPreview>{'<div>Not SVG content</div>'}</SvgPreview>)

      // Wait for debounced rendering and error to appear
      await waitFor(() => {
        expect(screen.getByText('Invalid SVG content')).toBeInTheDocument()
      })
    })
  })

  describe('ImageToolbar', () => {
    it('should render ImageToolbar if enableToolbar is true and no error', async () => {
      render(<SvgPreview enableToolbar>{svgContent}</SvgPreview>)

      // Wait for successful rendering
      await waitFor(() => {
        expect(screen.getByTestId('image-toolbar')).toBeInTheDocument()
      })
    })

    it('should not render ImageToolbar if enableToolbar is false', () => {
      render(<SvgPreview enableToolbar={false}>{svgContent}</SvgPreview>)
      expect(screen.queryByTestId('image-toolbar')).not.toBeInTheDocument()
    })

    it('should not render ImageToolbar when there is an error', async () => {
      render(<SvgPreview enableToolbar>{invalidSvgContent}</SvgPreview>)

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/SVG parsing error/)).toBeInTheDocument()
      })

      expect(screen.queryByTestId('image-toolbar')).not.toBeInTheDocument()
    })
  })

  describe('debounced rendering', () => {
    it('should handle empty content by canceling debounced render', () => {
      const { rerender } = render(<SvgPreview>{svgContent}</SvgPreview>)

      // Change to empty content
      rerender(<SvgPreview>{''}</SvgPreview>)

      // Should not throw any errors
      expect(true).toBe(true)
    })
  })
})
