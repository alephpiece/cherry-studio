import { ActionTool, TOOL_SPECS, useToolManager } from '@renderer/components/ActionTools'
import { BasicPreviewHandles } from '@renderer/components/Preview'
import { useTemporaryValue } from '@renderer/hooks/useTemporaryValue'
import { Check, Copy, FileCode, FileImage } from 'lucide-react'
import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface UseCopyToolProps {
  showPreviewTools?: boolean
  previewRef: React.RefObject<BasicPreviewHandles | null>
  onCopySource: () => void
  setTools: React.Dispatch<React.SetStateAction<ActionTool[]>>
}

export const useCopyTool = ({ showPreviewTools, previewRef, onCopySource, setTools }: UseCopyToolProps) => {
  const [copied, setCopiedTemporarily] = useTemporaryValue(false)
  const { t } = useTranslation()
  const { registerTool, removeTool } = useToolManager(setTools)

  const handleCopySource = useCallback(() => {
    try {
      onCopySource()
      setCopiedTemporarily(true)
    } catch (error) {
      setCopiedTemporarily(false)
      throw error
    }
  }, [onCopySource, setCopiedTemporarily])

  const handleCopyImage = useCallback(() => {
    try {
      previewRef.current?.copy()
      setCopiedTemporarily(true)
    } catch (error) {
      setCopiedTemporarily(false)
      throw error
    }
  }, [previewRef, setCopiedTemporarily])

  useEffect(() => {
    const includePreviewTools = showPreviewTools && previewRef.current !== null

    const baseTool = {
      ...TOOL_SPECS.copy,
      icon: copied ? (
        <Check className="tool-icon" color="var(--color-status-success)" />
      ) : (
        <Copy className="tool-icon" />
      ),
      tooltip: includePreviewTools ? t('common.copy') : t('code_block.copy.source')
    }

    if (includePreviewTools) {
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
  }, [
    onCopySource,
    registerTool,
    removeTool,
    t,
    copied,
    handleCopySource,
    handleCopyImage,
    showPreviewTools,
    previewRef
  ])
}
