import { ToolRegisterProps } from '@renderer/components/ActionTools'

/**
 * 预览组件的基本 props
 */
export interface BasicPreviewProps extends ToolRegisterProps {
  children: string
  enableToolbar?: boolean
}
