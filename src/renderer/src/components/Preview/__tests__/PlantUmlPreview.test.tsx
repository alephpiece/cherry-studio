import PlantUmlPreview from '@renderer/components/Preview/plantuml'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock SvgPreview as it's a separate unit being tested elsewhere
const mocks = vi.hoisted(() => ({
  SvgPreview: vi.fn(({ children, enableToolbar, className }) => (
    <div data-testid="svg-preview" data-enable-toolbar={enableToolbar} data-classname={className}>
      <div data-testid="svg-content">{children}</div>
    </div>
  ))
}))

vi.mock('@renderer/components/Preview/svg', () => ({
  default: mocks.SvgPreview
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

describe('PlantUmlPreview', () => {
  const diagram = 'A -> B'
  const mockSvgContent = '<svg>A -> B</svg>'

  beforeEach(() => {
    // Mock global fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('should show loading indicator initially', () => {
    // @ts-ignore mock fetch success
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockSvgContent)
    })

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('should render SvgPreview with fetched content on success', async () => {
    // @ts-ignore mock fetch success
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockSvgContent)
    })

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(screen.getByTestId('svg-preview')).toBeInTheDocument()
    })

    expect(screen.getByTestId('svg-content')).toHaveTextContent(mockSvgContent)
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
  })

  it('should pass props correctly to SvgPreview', async () => {
    // @ts-ignore mock fetch success
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockSvgContent)
    })

    render(<PlantUmlPreview enableToolbar>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      // Check if the mock was called
      expect(mocks.SvgPreview).toHaveBeenCalled()
    })

    // Get the props from the last call to the mock
    const lastCallProps = mocks.SvgPreview.mock.calls[0][0]
    expect(lastCallProps.enableToolbar).toBe(true)
    expect(lastCallProps.className).toBe('plantuml-preview special-preview')
    expect(lastCallProps.children).toBe(mockSvgContent)
  })

  it('should display an error message when fetch fails', async () => {
    const errorMessage = 'Network Error'
    // @ts-ignore mock fetch error
    global.fetch.mockRejectedValue(new Error(errorMessage))

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('should display an error message when response is not ok', async () => {
    const errorMessage = 'Not Found'
    // @ts-ignore mock fetch error
    global.fetch.mockResolvedValue({
      ok: false,
      statusText: errorMessage
    })

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('should not call fetch if children is empty', () => {
    render(<PlantUmlPreview>{''}</PlantUmlPreview>)
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
