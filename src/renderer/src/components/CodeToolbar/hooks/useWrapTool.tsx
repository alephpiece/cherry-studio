import { TOOL_SPECS, useToolManager } from '@renderer/components/ActionTools'
import { Text as UnWrapIcon, WrapText as WrapIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface UseWrapToolProps {
  enabled?: boolean
  unwrapped?: boolean
  wrappable?: boolean
  toggle: () => void
  setTools: React.Dispatch<React.SetStateAction<any[]>>
}

export const useWrapTool = ({ enabled, unwrapped, wrappable, toggle, setTools }: UseWrapToolProps) => {
  const { t } = useTranslation()
  const { registerTool, removeTool } = useToolManager(setTools)

  useEffect(() => {
    if (enabled) {
      registerTool({
        ...TOOL_SPECS.wrap,
        icon: unwrapped ? <UnWrapIcon className="tool-icon" /> : <WrapIcon className="tool-icon" />,
        tooltip: unwrapped ? t('code_block.wrap.off') : t('code_block.wrap.on'),
        visible: () => wrappable ?? false,
        onClick: toggle
      })
    }

    return () => removeTool(TOOL_SPECS.wrap.id)
  }, [wrappable, enabled, registerTool, removeTool, t, toggle, unwrapped])
}
