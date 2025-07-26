import { useImageTools } from '@renderer/components/ActionTools'
import { useImagePreview } from '@renderer/components/CodeToolbar'
import { memo, useEffect, useRef } from 'react'

import ImageToolbar from './ImageToolbar'
import { BasicPreviewProps } from './types'

/**
 * 使用 Shadow DOM 渲染 SVG
 */
const SvgPreview: React.FC<BasicPreviewProps> = ({ children, setTools, enableToolbar = false }) => {
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
    prefix: 'svg-image'
  })

  // 注册工具到父级
  useImagePreview({
    setTools,
    handleCopyImage: copy,
    handleDownload: download
  })

  return (
    <div ref={svgContainerRef} className="svg-preview special-preview">
      {enableToolbar && <ImageToolbar pan={pan} zoom={zoom} />}
    </div>
  )
}

export default memo(SvgPreview)
