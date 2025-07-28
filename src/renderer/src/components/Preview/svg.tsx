import { useImageTools } from '@renderer/components/ActionTools'
import { memo, useEffect, useImperativeHandle, useRef, useState } from 'react'

import ImageToolbar from './ImageToolbar'
import { PreviewContainer, PreviewError } from './styles'
import { BasicPreviewHandles } from './types'

interface SvgPreviewProps {
  children: string
  enableToolbar?: boolean
  className?: string
  ref?: React.RefObject<BasicPreviewHandles | null>
}

/**
 * 使用 Shadow DOM 渲染 SVG
 */
const SvgPreview = ({ children, enableToolbar = false, className, ref }: SvgPreviewProps) => {
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

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

    try {
      // 清除之前的错误
      setError(null)

      // 解析和附加 SVG
      const parser = new DOMParser()
      const doc = parser.parseFromString(children, 'image/svg+xml')

      // 检查解析错误
      const parserError = doc.querySelector('parsererror')
      if (parserError) {
        throw new Error(`SVG parsing error: ${parserError.textContent}`)
      }

      const svgElement = doc.documentElement
      if (svgElement.nodeName === 'svg') {
        shadowRoot.appendChild(svgElement.cloneNode(true))
      } else {
        throw new Error('Invalid SVG content')
      }
    } catch (error) {
      setError((error as Error).message || 'Unknown error')
    }
  }, [children])

  // 使用通用图像工具
  const { pan, zoom, copy, download } = useImageTools(svgContainerRef, {
    imgSelector: 'svg',
    prefix: 'svg-image',
    enableDrag: true,
    enableWheelZoom: true
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
      {error && <PreviewError>{error}</PreviewError>}
      <div ref={svgContainerRef} className={className ?? 'svg-preview special-preview'}></div>
      {!error && enableToolbar && <ImageToolbar pan={pan} zoom={zoom} />}
    </PreviewContainer>
  )
}

export default memo(SvgPreview)
