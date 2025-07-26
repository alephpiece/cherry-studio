import PlantUmlPreview from '@renderer/components/Preview/plantuml'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Use vi.hoisted to manage mocks
const mocks = vi.hoisted(() => ({
  useImageTools: vi.fn(),
  useImagePreview: vi.fn(),
  ImageToolbar: vi.fn(() => <div data-testid="image-toolbar">ImageToolbar</div>),
  getPlantUMLImageUrl: vi.fn(),
  download: vi.fn() // 模拟 download 工具函数
}))

// Mock antd's Spin component for state assertions
vi.mock('antd', async (importOriginal) => {
  const antd = await importOriginal<typeof import('antd')>()
  return {
    ...antd,
    Spin: ({ children, spinning }) => (
      <div data-testid="spin" data-spinning={spinning}>
        {spinning && <div data-testid="loading-indicator">Loading...</div>}
        {children}
      </div>
    )
  }
})

vi.mock('@renderer/components/ActionTools', () => ({
  useImageTools: mocks.useImageTools
}))

vi.mock('@renderer/components/CodeToolbar', () => ({
  useImagePreview: mocks.useImagePreview
}))

vi.mock('@renderer/utils/download', () => ({
  download: mocks.download
}))

vi.mock('@renderer/components/Preview/ImageToolbar', () => ({
  default: mocks.ImageToolbar
}))

// Mock plantuml.tsx module internal functions
vi.mock('@renderer/components/Preview/plantuml', async (importOriginal) => {
  const actual = await importOriginal<any>()
  return {
    ...actual,
    // Note: Since PlantUMLServerImage is defined inside the module, we need to redefine it in the tests
    // But a simpler approach is to just mock getPlantUMLImageUrl, and let the original component use it
    __esModule: true,
    default: actual.default,
    getPlantUMLImageUrl: mocks.getPlantUMLImageUrl
  }
})

describe('PlantUmlPreview', () => {
  const diagram = 'A -> B'
  const mockImageUrl = 'https://example.com/plantuml.svg'

  beforeEach(() => {
    // Provide default implementations for all mocks
    mocks.useImageTools.mockReturnValue({
      pan: { current: { x: 0, y: 0, scale: 1 } },
      zoom: vi.fn(),
      copy: vi.fn()
    })
    mocks.useImagePreview.mockReturnValue({})
    mocks.getPlantUMLImageUrl.mockReturnValue(mockImageUrl)
    mocks.download.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should match snapshot', () => {
      const { container } = render(<PlantUmlPreview enableToolbar>{diagram}</PlantUmlPreview>)
      expect(container).toMatchSnapshot()
    })

    it('should show loading indicator initially and hide it on image load', async () => {
      render(<PlantUmlPreview enableToolbar>{diagram}</PlantUmlPreview>)

      // Initially, the loading indicator should be visible
      expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'true')
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()

      // Trigger image load completion event
      const img = screen.getByRole('img')
      fireEvent.load(img)

      // Wait for state update
      await waitFor(() => {
        expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'false')
        expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      })
    })

    it('should handle image loading error', async () => {
      render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

      // Initially, the loading indicator should be visible
      expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'true')

      // Trigger image load error event
      const img = screen.getByRole('img')
      fireEvent.error(img)

      // Wait for state update
      await waitFor(() => {
        // Load state should end
        expect(screen.getByTestId('spin')).toHaveAttribute('data-spinning', 'false')
        // Image should have error style
        expect(img).toHaveStyle({ opacity: '0.5', filter: 'blur(2px)' })
      })
    })
  })

  describe('ImageToolbar', () => {
    it('should render ImageToolbar if enableToolbar is true', () => {
      render(<PlantUmlPreview enableToolbar>{diagram}</PlantUmlPreview>)
      expect(screen.getByTestId('image-toolbar')).toBeInTheDocument()
    })

    it('should not render ImageToolbar if enableToolbar is false', () => {
      render(<PlantUmlPreview enableToolbar={false}>{diagram}</PlantUmlPreview>)
      expect(screen.queryByTestId('image-toolbar')).not.toBeInTheDocument()
    })
  })

  describe('download', () => {
    it('should call custom download function when triggered from useImagePreview', () => {
      render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

      // Get the handleDownload function passed to useImagePreview
      const downloadFn = mocks.useImagePreview.mock.calls[0][0].handleDownload
      expect(downloadFn).toBeDefined()

      // Call download function
      downloadFn('svg')

      // Verify that the download tool function is called correctly
      expect(mocks.download).toHaveBeenCalledTimes(1)
      expect(mocks.download).toHaveBeenCalledWith(
        expect.stringContaining('plantuml.com/plantuml/svg/'),
        expect.stringContaining('plantuml-diagram-')
      )
    })
  })
})
