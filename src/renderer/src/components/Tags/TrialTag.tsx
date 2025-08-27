import { GiftIcon } from '@renderer/components/Icons'
import { Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

type Props = {
  size?: string | number
  color?: string
  tooltip?: string
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void
  style?: Omit<React.CSSProperties, 'color' | 'onClick' | 'height' | 'width'>
}

export const TrialTag = ({ size = '1rem', color = '#ff6060', tooltip, onClick, style }: Props) => {
  const { t } = useTranslation()
  return (
    <Tooltip
      title={tooltip || (onClick ? t('trial.model.tooltip_with_goto') : t('trial.model.tooltip'))}
      mouseEnterDelay={0.3}
      mouseLeaveDelay={0}>
      <GiftIcon size={size} color={color} onClick={onClick} active style={style} />
    </Tooltip>
  )
}
