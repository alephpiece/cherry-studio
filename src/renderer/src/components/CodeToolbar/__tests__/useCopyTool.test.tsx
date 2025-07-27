import { useCopyTool } from '@renderer/components/CodeToolbar/hooks/useCopyTool'
import { BasicPreviewHandles } from '@renderer/components/Preview'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock dependencies
const mocks = vi.hoisted(() => ({
  i18n: {
    t: vi.fn((key: string) => key)
  },
  useTemporaryValue: vi.fn(),
  useToolManager: vi.fn(),
  TOOL_SPECS: {
    copy: {
      id: 'copy',
      type: 'core',
      order: 11
    },
    'copy-image': {
      id: 'copy-image',
      type: 'quick',
      order: 30
    }
  }
}))

vi.mock('react-i18next', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-i18next')>()
  return {
    ...actual,
    useTranslation: () => ({
      t: mocks.i18n.t
    })
  }
})

// Mock TOOL_SPECS
vi.mock('@renderer/components/ActionTools', async () => {
  const actual = await vi.importActual('@renderer/components/ActionTools')
  return {
    ...actual,
    TOOL_SPECS: mocks.TOOL_SPECS,
    useToolManager: mocks.useToolManager
  }
})

// Mock useTemporaryValue
const mockSetTemporaryValue = vi.fn()
mocks.useTemporaryValue.mockImplementation(() => [false, mockSetTemporaryValue])

vi.mock('@renderer/hooks/useTemporaryValue', () => ({
  useTemporaryValue: mocks.useTemporaryValue
}))

// Mock useToolManager
const mockRegisterTool = vi.fn()
const mockRemoveTool = vi.fn()
mocks.useToolManager.mockImplementation(() => ({
  registerTool: mockRegisterTool,
  removeTool: mockRemoveTool
}))

describe('useCopyTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // We only need to reset to default values here
    mocks.useTemporaryValue.mockReturnValue([false, mockSetTemporaryValue])
  })

  // Helper function to create mock props
  const createMockProps = (overrides: Partial<Parameters<typeof useCopyTool>[0]> = {}) => {
    const defaultProps = {
      hasViewTools: false,
      viewRef: { current: null },
      onCopySource: vi.fn(),
      setTools: vi.fn()
    }

    return { ...defaultProps, ...overrides }
  }

  // Helper function to create mock preview handles
  const createMockPreviewHandles = (): BasicPreviewHandles => ({
    pan: vi.fn(),
    zoom: vi.fn(),
    copy: vi.fn(),
    download: vi.fn()
  })

  // Helper function for tool registration assertions
  const expectToolRegistration = (times: number, toolConfig?: object) => {
    expect(mockRegisterTool).toHaveBeenCalledTimes(times)
    if (times > 0 && toolConfig) {
      expect(mockRegisterTool).toHaveBeenCalledWith(expect.objectContaining(toolConfig))
    }
  }

  const expectNoChildren = () => {
    const registeredTool = mockRegisterTool.mock.calls[0][0]
    expect(registeredTool).not.toHaveProperty('children')
  }

  describe('tool registration', () => {
    it('should register single copy tool when hasViewTools is false', () => {
      const props = createMockProps({ hasViewTools: false })
      renderHook(() => useCopyTool(props))

      expect(mocks.useToolManager).toHaveBeenCalledWith(props.setTools)
      expectToolRegistration(1, {
        id: 'copy',
        type: 'core',
        order: 11,
        tooltip: 'code_block.copy.source',
        onClick: expect.any(Function),
        icon: expect.any(Object)
      })
      expectNoChildren()
    })

    it('should register single copy tool when hasViewTools is true but viewRef.current is null', () => {
      const props = createMockProps({ hasViewTools: true, viewRef: { current: null } })
      renderHook(() => useCopyTool(props))

      expectToolRegistration(1, {
        id: 'copy',
        type: 'core',
        order: 11,
        tooltip: 'common.copy',
        onClick: expect.any(Function),
        icon: expect.any(Object)
      })
      expectNoChildren()
    })

    it('should register copy tool with children when hasViewTools is true and viewRef.current is not null', () => {
      const mockPreviewHandles = createMockPreviewHandles()
      const props = createMockProps({
        hasViewTools: true,
        viewRef: { current: mockPreviewHandles }
      })

      renderHook(() => useCopyTool(props))

      expectToolRegistration(1, {
        id: 'copy',
        type: 'core',
        order: 11,
        tooltip: 'common.copy',
        icon: expect.any(Object),
        children: expect.arrayContaining([
          expect.objectContaining({
            id: 'copy',
            type: 'core',
            order: 11,
            tooltip: 'code_block.copy.source',
            onClick: expect.any(Function),
            icon: expect.any(Object)
          }),
          expect.objectContaining({
            id: 'copy-image',
            type: 'quick',
            order: 30,
            tooltip: 'preview.copy.image',
            onClick: expect.any(Function),
            icon: expect.any(Object)
          })
        ])
      })
    })
  })

  describe('copy functionality', () => {
    it('should execute copy source behavior when tool is activated', () => {
      const mockOnCopySource = vi.fn()
      const props = createMockProps({ onCopySource: mockOnCopySource })
      renderHook(() => useCopyTool(props))

      // Get the onClick handler from the registered tool
      const registeredTool = mockRegisterTool.mock.calls[0][0]
      act(() => {
        registeredTool.onClick()
      })

      expect(mockOnCopySource).toHaveBeenCalledTimes(1)
      expect(mockSetTemporaryValue).toHaveBeenCalledWith(true)
    })

    it('should execute copy image behavior when image copy tool is activated', () => {
      const mockPreviewHandles = createMockPreviewHandles()
      const props = createMockProps({
        hasViewTools: true,
        viewRef: { current: mockPreviewHandles }
      })

      renderHook(() => useCopyTool(props))

      // Get the copy-image child tool
      const registeredTool = mockRegisterTool.mock.calls[0][0]
      const copyImageTool = registeredTool.children?.find((child: any) => child.tooltip === 'preview.copy.image')

      expect(copyImageTool).toBeDefined()

      act(() => {
        copyImageTool.onClick()
      })

      expect(mockPreviewHandles.copy).toHaveBeenCalledTimes(1)
      expect(mockSetTemporaryValue).toHaveBeenCalledWith(true)
    })

    it('should execute copy source behavior from child tool', () => {
      const mockOnCopySource = vi.fn()
      const props = createMockProps({
        hasViewTools: true,
        onCopySource: mockOnCopySource,
        viewRef: { current: createMockPreviewHandles() }
      })

      renderHook(() => useCopyTool(props))

      // Get the copy source child tool
      const registeredTool = mockRegisterTool.mock.calls[0][0]
      const copySourceTool = registeredTool.children?.find((child: any) => child.tooltip === 'code_block.copy.source')

      expect(copySourceTool).toBeDefined()

      act(() => {
        copySourceTool.onClick()
      })

      expect(mockOnCopySource).toHaveBeenCalledTimes(1)
      expect(mockSetTemporaryValue).toHaveBeenCalledWith(true)
    })
  })

  describe('state management', () => {
    it('should re-register tool when copy state changes', () => {
      const props = createMockProps()

      // Initially not copied
      mocks.useTemporaryValue.mockImplementation(() => [false, mockSetTemporaryValue])
      const { rerender } = renderHook(() => useCopyTool(props))

      expect(mockRegisterTool).toHaveBeenCalledTimes(1)

      // Change to copied state and rerender
      mocks.useTemporaryValue.mockImplementation(() => [true, mockSetTemporaryValue])
      rerender()

      // Should register tool again with updated state
      expect(mockRegisterTool).toHaveBeenCalledTimes(2)
    })

    it('should reflect copy state in tool icon', () => {
      const props = createMockProps()

      // Test not copied state
      mocks.useTemporaryValue.mockReturnValue([false, mockSetTemporaryValue])
      const { rerender } = renderHook(() => useCopyTool(props))

      const notCopiedTool = mockRegisterTool.mock.calls[0][0]

      // Test copied state
      mocks.useTemporaryValue.mockReturnValue([true, mockSetTemporaryValue])
      rerender()

      const copiedTool = mockRegisterTool.mock.calls[1][0]

      // Verify different icons are used (without testing implementation details)
      expect(notCopiedTool.icon).not.toEqual(copiedTool.icon)
      // Both should have same basic properties
      expect(notCopiedTool.id).toBe(copiedTool.id)
      expect(notCopiedTool.type).toBe(copiedTool.type)
      expect(notCopiedTool.order).toBe(copiedTool.order)
    })

    it('should maintain state consistency across re-renders', () => {
      const props = createMockProps()

      // Start with copied state
      mocks.useTemporaryValue.mockReturnValue([true, mockSetTemporaryValue])
      const { rerender } = renderHook(() => useCopyTool(props))

      const firstCallIndex = mockRegisterTool.mock.calls.length - 1
      const firstCopiedTool = mockRegisterTool.mock.calls[firstCallIndex][0]

      // Rerender with same state
      rerender()

      const lastCallIndex = mockRegisterTool.mock.calls.length - 1
      const lastTool = mockRegisterTool.mock.calls[lastCallIndex][0]

      // Should have consistent properties for same state
      expect(firstCopiedTool.id).toBe(lastTool.id)
      expect(firstCopiedTool.type).toBe(lastTool.type)
      expect(firstCopiedTool.order).toBe(lastTool.order)
      expect(firstCopiedTool.tooltip).toBe(lastTool.tooltip)
      // Icons should have same type (both showing copied state)
      expect(firstCopiedTool.icon.type).toBe(lastTool.icon.type)
    })
  })

  describe('cleanup', () => {
    it('should remove tool on unmount', () => {
      const props = createMockProps()
      const { unmount } = renderHook(() => useCopyTool(props))

      unmount()

      expect(mockRemoveTool).toHaveBeenCalledWith('copy')
    })
  })

  describe('edge cases', () => {
    it('should handle missing setTools gracefully', () => {
      const props = createMockProps({ setTools: undefined })

      expect(() => {
        renderHook(() => useCopyTool(props))
      }).not.toThrow()

      // Should still call useToolManager (but won't actually register)
      expect(mocks.useToolManager).toHaveBeenCalledWith(undefined)
    })

    it('should handle missing viewRef.current gracefully', () => {
      const props = createMockProps({
        hasViewTools: true,
        viewRef: { current: null }
      })

      expect(() => {
        renderHook(() => useCopyTool(props))
      }).not.toThrow()

      // Should register single tool without children
      expectToolRegistration(1)
      const registeredTool = mockRegisterTool.mock.calls[0][0]
      expect(registeredTool).not.toHaveProperty('children')
    })

    it('should handle copy source operation failures gracefully', () => {
      const mockOnCopySource = vi.fn().mockImplementation(() => {
        throw new Error('Copy failed')
      })

      const props = createMockProps({ onCopySource: mockOnCopySource })
      renderHook(() => useCopyTool(props))

      const registeredTool = mockRegisterTool.mock.calls[0][0]

      // Errors should be propagated up
      expect(() => {
        act(() => {
          registeredTool.onClick()
        })
      }).toThrow('Copy failed')

      // Callback should still be called
      expect(mockOnCopySource).toHaveBeenCalledTimes(1)
      // State should be reset to false on error (improved behavior)
      expect(mockSetTemporaryValue).toHaveBeenCalledWith(false)
    })

    it('should handle copy image operation failures gracefully', () => {
      const mockPreviewHandles = createMockPreviewHandles()
      mockPreviewHandles.copy = vi.fn().mockImplementation(() => {
        throw new Error('Image copy failed')
      })

      const props = createMockProps({
        hasViewTools: true,
        viewRef: { current: mockPreviewHandles }
      })

      renderHook(() => useCopyTool(props))

      const registeredTool = mockRegisterTool.mock.calls[0][0]
      const copyImageTool = registeredTool.children?.find((child: any) => child.tooltip === 'preview.copy.image')

      expect(copyImageTool).toBeDefined()

      // Errors should be propagated up
      expect(() => {
        act(() => {
          copyImageTool.onClick()
        })
      }).toThrow('Image copy failed')

      // Callback should still be called
      expect(mockPreviewHandles.copy).toHaveBeenCalledTimes(1)
      // State should be reset to false on error (improved behavior)
      expect(mockSetTemporaryValue).toHaveBeenCalledWith(false)
    })
  })
})
