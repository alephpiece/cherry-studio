import { useImageTools } from '@renderer/components/ActionTools'
import { useImagePreview } from '@renderer/components/CodeToolbar'
import { memo, useEffect, useImperativeHandle, useRef } from 'react'

import ImageToolbar from './ImageToolbar'
import { PreviewContainer } from './styles'
import { BasicPreviewHandles, BasicPreviewProps } from './types'

/**
 * 使用 Shadow DOM 渲染 SVG
 */
const SvgPreview = ({
  children,
  setTools,
  enableToolbar = false,
  ref
}: BasicPreviewProps & { ref?: React.RefObject<BasicPreviewHandles | null> }) => {
  const svgContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = svgContainerRef.current
    if (!container) return

    const shadowRoot = container.shadowRoot || container.attachShadow({ mode: 'open' })

    // 添加基础样式
    const style = document.createElement('style')
    style.textContent = `
      :host {
        padding: 1em;
        background-color: white;
        overflow: auto;
        border: 0.5px solid var(--color-code-background);
        border-top-left-radius: 0;
        border-top-right-radius: 0;
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
      }
      svg {
        max-width: 100%;
        height: auto;
      }
    `

    // 清空并重新添加内容
    shadowRoot.innerHTML = ''
    shadowRoot.appendChild(style)

    const svgContainer = document.createElement('div')
    svgContainer.innerHTML = children
    shadowRoot.appendChild(svgContainer)
  }, [children])

  // 使用通用图像工具
  const { pan, zoom, copy, download } = useImageTools(svgContainerRef, {
    imgSelector: 'svg',
    prefix: 'svg-image',
    enableDrag: true,
    enableWheelZoom: true
  })

  // 注册工具到父级
  useImagePreview({
    setTools,
    handleZoom: zoom,
    handleCopyImage: copy
  })

  useImperativeHandle(ref, () => {
    return {
      pan,
      zoom,
      copy,
      download
    }
  })

  return (
    <PreviewContainer vertical>
      <div ref={svgContainerRef} className="svg-preview special-preview"></div>
      {enableToolbar && <ImageToolbar pan={pan} zoom={zoom} />}
    </PreviewContainer>
  )
}

export default memo(SvgPreview)
