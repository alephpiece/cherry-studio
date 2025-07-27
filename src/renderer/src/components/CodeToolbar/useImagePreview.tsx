import { ActionTool, TOOL_SPECS, useToolManager } from '@renderer/components/ActionTools'
import { FileImage, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export interface ImagePreviewOptions {
  setTools?: (value: React.SetStateAction<ActionTool[]>) => void
  handleZoom?: (delta: number) => void // FIXME: for compatibility
  handleCopyImage?: () => Promise<void>
}

/**
 * 提供预览组件通用工具栏功能的自定义Hook
 */
export const useImagePreview = ({ setTools, handleZoom, handleCopyImage }: ImagePreviewOptions) => {
  const { t } = useTranslation()
  const { registerTool, removeTool } = useToolManager(setTools)

  useEffect(() => {
    // 根据提供的功能有选择性地注册工具
    if (handleZoom) {
      // 放大工具
      registerTool({
        ...TOOL_SPECS['zoom-in'],
        icon: <ZoomIn className="tool-icon" />,
        tooltip: t('preview.zoom_in'),
        onClick: () => handleZoom(0.1)
      })

      // 缩小工具
      registerTool({
        ...TOOL_SPECS['zoom-out'],
        icon: <ZoomOut className="tool-icon" />,
        tooltip: t('preview.zoom_out'),
        onClick: () => handleZoom(-0.1)
      })
    }

    if (handleCopyImage) {
      // 复制图片工具
      registerTool({
        ...TOOL_SPECS['copy-image'],
        icon: <FileImage className="tool-icon" />,
        tooltip: t('preview.copy.image'),
        onClick: handleCopyImage
      })
    }

    // 清理函数
    return () => {
      if (handleZoom) {
        removeTool(TOOL_SPECS['zoom-in'].id)
        removeTool(TOOL_SPECS['zoom-out'].id)
      }
      if (handleCopyImage) {
        removeTool(TOOL_SPECS['copy-image'].id)
      }
    }
  }, [handleCopyImage, handleZoom, registerTool, removeTool, t])
}
