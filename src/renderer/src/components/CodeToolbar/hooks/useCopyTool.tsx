import { TOOL_SPECS, useToolManager } from '@renderer/components/ActionTools'
import { BasicPreviewHandles } from '@renderer/components/Preview'
import { Copy, FileCode, FileImage } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface UseCopyToolProps {
  hasViewTools?: boolean
  viewRef: React.RefObject<BasicPreviewHandles | null>
  onCopySource: () => void
  setTools: React.Dispatch<React.SetStateAction<any[]>>
}

export const useCopyTool = ({ hasViewTools, viewRef, onCopySource, setTools }: UseCopyToolProps) => {
  const { t } = useTranslation()
  const { registerTool, removeTool } = useToolManager(setTools)

  useEffect(() => {
    const showViewTools = hasViewTools && viewRef.current !== null

    const baseTool = {
      ...TOOL_SPECS.copy,
      icon: <Copy className="tool-icon" />,
      tooltip: hasViewTools ? t('common.copy') : t('code_block.copy.source')
    }

    if (showViewTools) {
      registerTool({
        ...baseTool,
        children: [
          {
            ...TOOL_SPECS.copy,
            icon: <FileCode size={'1rem'} />,
            tooltip: t('code_block.copy.source'),
            onClick: onCopySource
          },
          {
            ...TOOL_SPECS['copy-image'],
            icon: <FileImage size={'1rem'} />,
            tooltip: t('preview.copy.image'),
            onClick: () => viewRef.current?.copy()
          }
        ]
      })
    } else {
      registerTool({
        ...baseTool,
        onClick: onCopySource
      })
    }

    return () => removeTool(TOOL_SPECS.copy.id)
  }, [viewRef, onCopySource, registerTool, removeTool, t, hasViewTools])
}
