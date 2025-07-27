import { ToolRegisterProps } from '@renderer/components/ActionTools'

/**
 * 预览组件的基本 props
 */
export interface BasicPreviewProps extends ToolRegisterProps {
  children: string
  enableToolbar?: boolean
}

/**
 * 通过 useImperativeHandle 暴露的方法类型
 */
export interface BasicPreviewHandles {
  pan: (dx: number, dy: number, absolute?: boolean) => void
  zoom: (delta: number, absolute?: boolean) => void
  copy: () => Promise<void>
  download: (format: 'svg' | 'png') => Promise<void>
}
