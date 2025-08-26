import { HammerIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import CustomTag, { CustomTagProps } from '../CustomTag'

type Props = {
  size?: number
  showTooltip?: boolean
  showLabel?: boolean
} & Omit<CustomTagProps, 'size' | 'tooltip' | 'icon' | 'color' | 'children'>

export const ToolsCallingTag = ({ size, showTooltip, showLabel, ...restProps }: Props) => {
  const { t } = useTranslation()
  const color = '#f18737'
  return (
    <CustomTag
      size={size}
      color={color}
      icon={<HammerIcon size={size} color={color} />}
      tooltip={showTooltip ? t('models.type.function_calling') : undefined}
      {...restProps}>
      {showLabel ? t('models.type.function_calling') : ''}
    </CustomTag>
  )
}
