import SvgPreview from '@renderer/components/Preview/svg'
import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Use vi.hoisted to manage mocks
const mocks = vi.hoisted(() => ({
  ImagePreviewLayout: vi.fn(({ children }) => <div data-testid="image-preview-layout">{children}</div>),
  renderSvgInShadowHost: vi.fn()
}))

vi.mock('lodash', () => ({
  debounce: vi.fn((fn) => {
    const debounced = (...args: any[]) => fn(...args)
    debounced.cancel = vi.fn()
    return debounced
  })
}))

vi.mock('@renderer/components/Preview/ImagePreviewLayout', () => ({
  default: mocks.ImagePreviewLayout
}))

// Mock the utils module
vi.mock('@renderer/components/Preview/utils', async () => {
  const actual = await import('@renderer/components/Preview/utils')
  return {
    ...actual,
    renderSvgInShadowHost: mocks.renderSvgInShadowHost
  }
})

describe('SvgPreview', () => {
  const svgContent = '<svg><rect width="100" height="100" /></svg>'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should match snapshot', () => {
      const { container } = render(<SvgPreview enableToolbar>{svgContent}</SvgPreview>)
      expect(container).toMatchSnapshot()
    })

    it('should call renderSvgInShadowHost with the correct content', async () => {
      const { container } = render(<SvgPreview>{svgContent}</SvgPreview>)
      const previewElement = container.querySelector('.svg-preview')

      expect(previewElement).not.toBeNull()

      await waitFor(() => {
        expect(mocks.renderSvgInShadowHost).toHaveBeenCalledWith(previewElement, svgContent)
      })
    })
  })

  describe('debounced rendering', () => {
    it('should not call renderer again when content becomes empty', async () => {
      const { rerender } = render(<SvgPreview>{svgContent}</SvgPreview>)

      await waitFor(() => {
        expect(mocks.renderSvgInShadowHost).toHaveBeenCalledTimes(1)
      })

      // Change to empty content
      rerender(<SvgPreview>{''}</SvgPreview>)

      // Wait a bit to ensure debounced function does not run
      await new Promise((r) => setTimeout(r, 350))

      // The mock should still only have been called once from the initial render
      expect(mocks.renderSvgInShadowHost).toHaveBeenCalledTimes(1)
    })
  })
})
