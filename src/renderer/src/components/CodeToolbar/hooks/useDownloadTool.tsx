import { TOOL_SPECS, useToolManager } from '@renderer/components/ActionTools'
import { BasicPreviewHandles } from '@renderer/components/Preview'
import { Download, FileCode, FileImage } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface UseDownloadToolProps {
  hasViewTools?: boolean
  viewRef: React.RefObject<BasicPreviewHandles | null>
  onDownloadSource: () => void
  setTools: React.Dispatch<React.SetStateAction<any[]>>
}

export const useDownloadTool = ({ hasViewTools, viewRef, onDownloadSource, setTools }: UseDownloadToolProps) => {
  const { t } = useTranslation()
  const { registerTool, removeTool } = useToolManager(setTools)

  useEffect(() => {
    const showViewTools = hasViewTools && viewRef.current !== null

    const baseTool = {
      ...TOOL_SPECS.download,
      icon: <Download className="tool-icon" />,
      tooltip: showViewTools ? t('common.download') : t('code_block.download.source')
    }

    if (showViewTools) {
      registerTool({
        ...baseTool,
        children: [
          {
            ...TOOL_SPECS.download,
            icon: <FileCode size={'1rem'} />,
            tooltip: t('code_block.download.source'),
            onClick: onDownloadSource
          },
          {
            ...TOOL_SPECS['download-svg'],
            icon: <FileImage size={'1rem'} />,
            tooltip: t('code_block.download.svg'),
            onClick: () => viewRef.current?.download('svg')
          },
          {
            ...TOOL_SPECS['download-png'],
            icon: <FileImage size={'1rem'} />,
            tooltip: t('code_block.download.png'),
            onClick: () => viewRef.current?.download('png')
          }
        ]
      })
    } else {
      registerTool({
        ...baseTool,
        onClick: onDownloadSource
      })
    }

    return () => removeTool(TOOL_SPECS.download.id)
  }, [viewRef, onDownloadSource, registerTool, removeTool, t, hasViewTools])
}
