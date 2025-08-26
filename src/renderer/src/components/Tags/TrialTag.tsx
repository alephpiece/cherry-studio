import { Tooltip } from 'antd'
import { GiftIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

type Props = {
  size?: string | number
  color?: string
  onClick?: (e: React.MouseEvent<SVGSVGElement>) => void
  style?: Omit<React.CSSProperties, 'color' | 'onClick' | 'height' | 'width'>
}

export const TrialTag = ({ size = '1rem', color = '#ff3b3b', onClick, style }: Props) => {
  const { t } = useTranslation()
  return (
    <Tooltip title={t('models.trial.tooltip')}>
      <GiftIcon size={size} color={color} onClick={onClick} style={style} />
    </Tooltip>
  )
}
