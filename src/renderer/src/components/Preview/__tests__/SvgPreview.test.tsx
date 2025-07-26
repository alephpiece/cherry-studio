import SvgPreview from '@renderer/components/Preview/svg'
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Use vi.hoisted to manage mocks
const mocks = vi.hoisted(() => ({
  useImageTools: vi.fn(),
  useImagePreview: vi.fn(),
  ImageToolbar: vi.fn(() => <div data-testid="image-toolbar">ImageToolbar</div>)
}))

vi.mock('@renderer/components/ActionTools', () => ({
  useImageTools: mocks.useImageTools
}))

vi.mock('@renderer/components/CodeToolbar', () => ({
  useImagePreview: mocks.useImagePreview
}))

vi.mock('@renderer/components/Preview/ImageToolbar', () => ({
  default: mocks.ImageToolbar
}))

describe('SvgPreview', () => {
  const svgContent = '<svg><rect width="100" height="100" /></svg>'

  beforeEach(() => {
    // Provide default implementations for all mocks
    mocks.useImageTools.mockReturnValue({
      pan: { current: { x: 0, y: 0, scale: 1 } },
      zoom: vi.fn(),
      copy: vi.fn(),
      download: vi.fn()
    })
    mocks.useImagePreview.mockReturnValue({})

    // Mock Shadow DOM API
    Element.prototype.attachShadow = vi.fn().mockImplementation(function (this: HTMLElement) {
      const shadowRoot = new DocumentFragment()
      // @ts-ignore Mock Shadow DOM behavior
      shadowRoot.innerHTML = this.innerHTML
      Object.defineProperty(this, 'shadowRoot', {
        value: shadowRoot,
        writable: true
      })
      return shadowRoot
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

    it('should render the svg content inside a shadow DOM', () => {
      const { container } = render(<SvgPreview>{svgContent}</SvgPreview>)
      const previewElement = container.querySelector('.svg-preview')

      expect(previewElement).not.toBeNull()
      expect(Element.prototype.attachShadow).toHaveBeenCalledWith({ mode: 'open' })

      // Verify Shadow DOM content
      const shadowRoot = previewElement?.shadowRoot
      expect(shadowRoot).not.toBeNull()
      // Check if it contains styles and SVG content
      expect(shadowRoot?.querySelector('style')).not.toBeNull()
      expect(shadowRoot?.querySelector('svg')).not.toBeNull()
      expect(shadowRoot?.querySelector('rect')).not.toBeNull()
    })
  })

  describe('ImageToolbar', () => {
    it('should render ImageToolbar if enableToolbar is true', () => {
      render(<SvgPreview enableToolbar>{svgContent}</SvgPreview>)
      expect(screen.getByTestId('image-toolbar')).toBeInTheDocument()
    })

    it('should not render ImageToolbar if enableToolbar is false', () => {
      render(<SvgPreview enableToolbar={false}>{svgContent}</SvgPreview>)
      expect(screen.queryByTestId('image-toolbar')).not.toBeInTheDocument()
    })
  })
})
