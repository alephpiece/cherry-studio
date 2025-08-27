import { GiftIcon } from '@renderer/components/Icons'
import { Tooltip } from 'antd'
import { useTranslation } from 'react-i18next'

type Props = {
  size?: string | number
  color?: string
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void
  style?: Omit<React.CSSProperties, 'color' | 'onClick' | 'height' | 'width'>
}

export const TrialTag = ({ size = '1rem', color = '#ff6060', onClick, style }: Props) => {
  const { t } = useTranslation()
  return (
    <Tooltip
      title={onClick ? t('models.trial.tooltip_with_goto') : t('models.trial.tooltip')}
      mouseEnterDelay={0.3}
      mouseLeaveDelay={0}>
      <GiftIcon size={size} color={color} onClick={onClick} active style={style} />
    </Tooltip>
  )
}
