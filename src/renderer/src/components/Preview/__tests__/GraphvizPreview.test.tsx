import GraphvizPreview from '@renderer/components/Preview/graphviz'
import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Use vi.hoisted to manage mocks
const mocks = vi.hoisted(() => ({
  vizInstance: {
    renderSVGElement: vi.fn()
  },
  vizInitializer: {
    get: vi.fn()
  },
  ImagePreviewLayout: vi.fn(({ children }) => <div data-testid="image-preview-layout">{children}</div>)
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
  })
})
