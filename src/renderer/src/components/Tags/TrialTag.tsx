import { GiftIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import CustomTag, { CustomTagProps } from './CustomTag'

type Props = {
  size?: number
  showTooltip?: boolean
  showLabel?: boolean
} & Omit<CustomTagProps, 'size' | 'tooltip' | 'icon' | 'color' | 'children'>

export const TrialTag = ({ size, showTooltip, showLabel, ...restProps }: Props) => {
  const { t } = useTranslation()
  const color = '#ff3b3b'
  return (
    <CustomTag
      size={size}
      color={color}
      icon={<GiftIcon size={size} color={color} />}
      tooltip={showTooltip ? t('models.trial.tooltip') : undefined}
      {...restProps}>
      {showLabel ? t('models.trial.label') : ''}
    </CustomTag>
  )
}
