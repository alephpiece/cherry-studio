import { classNames } from '@renderer/utils'
import { Button, Tooltip } from 'antd'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

interface ImageToolbarProps {
  pan: (dx: number, dy: number, absolute?: boolean) => void
  zoom: (delta: number, absolute?: boolean) => void
  className?: string
}

interface ImageToolButtonProps {
  tooltip: string
  icon: React.ReactNode
  onClick: () => void
}

const ImageToolButton: React.FC<ImageToolButtonProps> = memo(({ tooltip, icon, onClick }) => {
  return (
    <Tooltip title={tooltip} mouseEnterDelay={0.5} mouseLeaveDelay={0}>
      <Button shape="circle" icon={icon} onClick={onClick} role="button" aria-label={tooltip} />
    </Tooltip>
  )
})

const ImageToolbar = ({ pan, zoom, className }: ImageToolbarProps) => {
  const { t } = useTranslation()

  // 定义平移距离
  const panDistance = 20

  // 定义缩放增量
  const zoomDelta = 0.1

  const handleReset = useCallback(() => {
    pan(0, 0, true)
    zoom(1, true)
  }, [pan, zoom])

  return (
    <ToolbarWrapper className={classNames('preview-toolbar', className)} role="toolbar" aria-label={t('preview.label')}>
      {/* Up, Reset */}
      <ActionButtonRow>
        <Spacer />
        <ImageToolButton
          tooltip={t('preview.pan_up')}
          icon={<ChevronUp size={'1rem'} />}
          onClick={() => pan(0, -panDistance)}
        />
        <ImageToolButton tooltip={t('preview.reset')} icon={<RotateCcw size={'1rem'} />} onClick={handleReset} />
      </ActionButtonRow>

      {/* Left, Right */}
      <ActionButtonRow>
        <ImageToolButton
          tooltip={t('preview.pan_left')}
          icon={<ChevronLeft size={'1rem'} />}
          onClick={() => pan(-panDistance, 0)}
        />
        <Spacer />
        <ImageToolButton
          tooltip={t('preview.pan_right')}
          icon={<ChevronRight size={'1rem'} />}
          onClick={() => pan(panDistance, 0)}
        />
      </ActionButtonRow>

      {/* Down, Zoom */}
      <ActionButtonRow>
        <ImageToolButton
          tooltip={t('preview.zoom_out')}
          icon={<ZoomOut size={'1rem'} />}
          onClick={() => zoom(-zoomDelta)}
        />
        <ImageToolButton
          tooltip={t('preview.pan_down')}
          icon={<ChevronDown size={'1rem'} />}
          onClick={() => pan(0, panDistance)}
        />
        <ImageToolButton
          tooltip={t('preview.zoom_in')}
          icon={<ZoomIn size={'1rem'} />}
          onClick={() => zoom(zoomDelta)}
        />
      </ActionButtonRow>
    </ToolbarWrapper>
  )
}

const ToolbarWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  position: absolute;
  gap: 4px;
  right: 1em;
  bottom: 1em;
  z-index: 5;
`

const ActionButtonRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 4px;
  width: 100%;
`

const Spacer = styled.div`
  flex: 1;
`

export default memo(ImageToolbar)
