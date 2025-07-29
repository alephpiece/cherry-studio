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

  it('should show loading indicator initially', async () => {
    // @ts-ignore mock fetch success
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockSvgContent)
    })

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    // Wait for the component to update
    await waitFor(() => {
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })
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
    // @ts-ignore mock fetch error
    global.fetch.mockRejectedValue(new Error('Network Error'))

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      // Check that an error message is displayed (without specifying exact text)
      expect(screen.queryByTestId('svg-preview')).not.toBeInTheDocument()
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      // Check that error container with alert role is in the document
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('should display an error message when response is not ok', async () => {
    // @ts-ignore mock fetch error
    global.fetch.mockResolvedValue({
      ok: false,
      statusText: 'Not Found'
    })

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      // Check that an error message is displayed (without specifying exact text)
      expect(screen.queryByTestId('svg-preview')).not.toBeInTheDocument()
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
      // Check that error container with alert role is in the document
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })

  it('should not call fetch if children is empty', async () => {
    render(<PlantUmlPreview>{''}</PlantUmlPreview>)
    // Wait a bit to ensure any potential fetch calls would have happened
    await waitFor(
      () => {
        expect(global.fetch).not.toHaveBeenCalled()
      },
      { timeout: 100 }
    )
  })
})
