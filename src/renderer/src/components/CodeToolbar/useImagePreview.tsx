import { ActionTool, TOOL_SPECS, useToolManager } from '@renderer/components/ActionTools'
import { FileImage, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { DownloadPngIcon, DownloadSvgIcon } from '../Icons/DownloadIcons'

export interface ImagePreviewOptions {
  setTools?: (value: React.SetStateAction<ActionTool[]>) => void
  handleZoom?: (delta: number) => void
  handleCopyImage?: () => Promise<void>
  handleDownload?: (format: 'svg' | 'png') => void
}

/**
 * 提供预览组件通用工具栏功能的自定义Hook
 */
export const useImagePreview = ({ setTools, handleZoom, handleCopyImage, handleDownload }: ImagePreviewOptions) => {
  const { t } = useTranslation()
  const { registerTool, removeTool } = useToolManager(setTools)

  useEffect(() => {
    // 根据提供的功能有选择性地注册工具
    if (handleZoom) {
      // 放大工具
      registerTool({
        ...TOOL_SPECS['zoom-in'],
        icon: <ZoomIn className="tool-icon" />,
        tooltip: t('code_block.preview.zoom_in'),
        onClick: () => handleZoom(0.1)
      })

      // 缩小工具
      registerTool({
        ...TOOL_SPECS['zoom-out'],
        icon: <ZoomOut className="tool-icon" />,
        tooltip: t('code_block.preview.zoom_out'),
        onClick: () => handleZoom(-0.1)
      })
    }

    if (handleCopyImage) {
      // 复制图片工具
      registerTool({
        ...TOOL_SPECS['copy-image'],
        icon: <FileImage className="tool-icon" />,
        tooltip: t('code_block.preview.copy.image'),
        onClick: handleCopyImage
      })
    }

    if (handleDownload) {
      // 下载 SVG 工具
      registerTool({
        ...TOOL_SPECS['download-svg'],
        icon: <DownloadSvgIcon />,
        tooltip: t('code_block.download.svg'),
        onClick: () => handleDownload('svg')
      })

      // 下载 PNG 工具
      registerTool({
        ...TOOL_SPECS['download-png'],
        icon: <DownloadPngIcon />,
        tooltip: t('code_block.download.png'),
        onClick: () => handleDownload('png')
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
      if (handleDownload) {
        removeTool(TOOL_SPECS['download-svg'].id)
        removeTool(TOOL_SPECS['download-png'].id)
      }
    }
  }, [handleCopyImage, handleDownload, handleZoom, registerTool, removeTool, t])
}
