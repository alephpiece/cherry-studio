import { TOOL_SPECS, useToolManager } from '@renderer/components/ActionTools'
import { BasicPreviewHandles } from '@renderer/components/Preview'
import { useTemporaryValue } from '@renderer/hooks/useTemporaryValue'
import { Check, Copy, FileCode, FileImage } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface UseCopyToolProps {
  hasViewTools?: boolean
  viewRef: React.RefObject<BasicPreviewHandles | null>
  onCopySource: () => void
  setTools: React.Dispatch<React.SetStateAction<any[]>>
}

export const useCopyTool = ({ hasViewTools, viewRef, onCopySource, setTools }: UseCopyToolProps) => {
  const [copied, setCopiedTemporarily] = useTemporaryValue(false)
  const { t } = useTranslation()
  const { registerTool, removeTool } = useToolManager(setTools)

  const handleCopySource = useCallback(() => {
    onCopySource()
    setCopiedTemporarily(true)
  }, [onCopySource, setCopiedTemporarily])

  const handleCopyImage = useCallback(() => {
    viewRef.current?.copy()
    setCopiedTemporarily(true)
  }, [viewRef, setCopiedTemporarily])

  useEffect(() => {
    const showViewTools = hasViewTools && viewRef.current !== null

    const baseTool = {
      ...TOOL_SPECS.copy,
      icon: copied ? (
        <Check className="tool-icon" color="var(--color-status-success)" />
      ) : (
        <Copy className="tool-icon" />
      ),
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
            onClick: handleCopySource
          },
          {
            ...TOOL_SPECS['copy-image'],
            icon: <FileImage size={'1rem'} />,
            tooltip: t('preview.copy.image'),
            onClick: handleCopyImage
          }
        ]
      })
    } else {
      registerTool({
        ...baseTool,
        onClick: handleCopySource
      })
    }

    return () => removeTool(TOOL_SPECS.copy.id)
  }, [viewRef, onCopySource, registerTool, removeTool, t, hasViewTools, copied, handleCopySource, handleCopyImage])
}
