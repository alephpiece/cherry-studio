import SvgPreview from '@renderer/components/Preview/svg'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Use vi.hoisted to manage mocks
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

    it('should show loading state initially', () => {
      render(<SvgPreview>{svgContent}</SvgPreview>)
      expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'true')
    })
  })

  describe('error handling', () => {
    it('should display an error message when renderSvgInShadowHost throws an error', async () => {
      const errorMessage = 'SVG parsing error'
      mocks.renderSvgInShadowHost.mockImplementation(() => {
        throw new Error(errorMessage)
      })

      render(<SvgPreview>{svgContent}</SvgPreview>)

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })
  })

  describe('ImageToolbar', () => {
    it('should render ImageToolbar if enableToolbar is true and no error', async () => {
      render(<SvgPreview enableToolbar>{svgContent}</SvgPreview>)

      await waitFor(() => {
        expect(screen.getByTestId('image-toolbar')).toBeInTheDocument()
      })
    })

    it('should not render ImageToolbar if enableToolbar is false', () => {
      render(<SvgPreview enableToolbar={false}>{svgContent}</SvgPreview>)
      expect(screen.queryByTestId('image-toolbar')).not.toBeInTheDocument()
    })

    it('should not render ImageToolbar when there is an error', async () => {
      mocks.renderSvgInShadowHost.mockImplementation(() => {
        throw new Error('Some error')
      })

      render(<SvgPreview enableToolbar>{svgContent}</SvgPreview>)

      await waitFor(() => {
        expect(screen.getByText('Some error')).toBeInTheDocument()
      })

      expect(screen.queryByTestId('image-toolbar')).not.toBeInTheDocument()
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
