import PlantUmlPreview from '@renderer/components/Preview/plantuml'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock SvgPreview as it's a separate unit being tested elsewhere
const mocks = vi.hoisted(() => ({
  SvgPreview: vi.fn(({ children, enableToolbar, className, loading }) => (
    <div
      data-testid="svg-preview"
      data-enable-toolbar={enableToolbar}
      data-classname={className}
      data-loading={loading}>
      <div data-testid="svg-content">{children}</div>
    </div>
  ))
}))

vi.mock('@renderer/components/Preview/svg', () => ({
  default: mocks.SvgPreview
}))

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

  it('should pass loading state to SvgPreview initially', async () => {
    // @ts-ignore mock fetch success
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockSvgContent)
    })

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    // Should immediately render SvgPreview with loading=true after fetch starts
    await waitFor(() => {
      expect(screen.getByTestId('svg-preview')).toHaveAttribute('data-loading', 'true')
    })
  })

  it('should render SvgPreview with fetched content and stop loading on success', async () => {
    // @ts-ignore mock fetch success
    global.fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockSvgContent)
    })

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(screen.getByTestId('svg-preview')).toHaveAttribute('data-loading', 'false')
    })

    expect(screen.getByTestId('svg-content')).toHaveTextContent(mockSvgContent)
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
    const lastCallProps = mocks.SvgPreview.mock.calls[mocks.SvgPreview.mock.calls.length - 1][0]
    expect(lastCallProps.enableToolbar).toBe(true)
    expect(lastCallProps.className).toBe('plantuml-preview special-preview')
    expect(lastCallProps.children).toBe(mockSvgContent)
  })

  it('should display an error message when fetch fails', async () => {
    // @ts-ignore mock fetch error
    global.fetch.mockRejectedValue(new Error('Network Error'))

    render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      // Check that an error message is displayed
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.queryByTestId('svg-preview')).not.toBeInTheDocument()
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
      // Check that an error message is displayed
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.queryByTestId('svg-preview')).not.toBeInTheDocument()
    })
  })

  it('should render SvgPreview with empty content when children is empty', async () => {
    render(<PlantUmlPreview>{''}</PlantUmlPreview>)

    // Should render SvgPreview immediately with empty content and loading=false
    expect(screen.getByTestId('svg-preview')).toBeInTheDocument()
    expect(screen.getByTestId('svg-preview')).toHaveAttribute('data-loading', 'false')
    expect(screen.getByTestId('svg-content')).toHaveTextContent('')

    // Wait a bit to ensure no fetch call happens
    await waitFor(
      () => {
        expect(global.fetch).not.toHaveBeenCalled()
      },
      { timeout: 100 }
    )
  })

  it('should clear error and content when children becomes empty', async () => {
    // @ts-ignore mock fetch error first
    global.fetch.mockRejectedValue(new Error('Network Error'))

    const { rerender } = render(<PlantUmlPreview>{diagram}</PlantUmlPreview>)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })

    // Clear children
    rerender(<PlantUmlPreview>{''}</PlantUmlPreview>)

    // Should now render SvgPreview instead of error
    expect(screen.getByTestId('svg-preview')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
