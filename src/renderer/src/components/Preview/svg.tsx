import { useImageTools } from '@renderer/components/ActionTools'
import SvgSpinners180Ring from '@renderer/components/Icons/SvgSpinners180Ring'
import { Spin } from 'antd'
import { debounce } from 'lodash'
import { memo, startTransition, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

import ImageToolbar from './ImageToolbar'
import { PreviewContainer, PreviewError } from './styles'
import { BasicPreviewHandles } from './types'

interface SvgPreviewProps {
  children: string
  enableToolbar?: boolean
  className?: string
  loading?: boolean
  ref?: React.RefObject<BasicPreviewHandles | null>
}

/**
 * 使用 Shadow DOM 渲染 SVG
 * 通过防抖渲染提供比较统一的体验，减少闪烁。
 */
const SvgPreview = ({ children, enableToolbar = false, className, loading = false, ref }: SvgPreviewProps) => {
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

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

  // 实际的渲染函数
  const renderSvg = useCallback(async (content: string) => {
    if (!content || !svgContainerRef.current) return

    try {
      setIsLoading(true)

      const container = svgContainerRef.current
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

      // 解析和附加 SVG
      const parser = new DOMParser()
      const doc = parser.parseFromString(content, 'image/svg+xml')

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

      // 渲染成功，清除错误记录
      setError(null)
    } catch (error) {
      setError((error as Error).message || 'Unknown error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // debounce 渲染
  const debouncedRender = useMemo(
    () =>
      debounce((content: string) => {
        startTransition(() => renderSvg(content))
      }, 300),
    [renderSvg]
  )

  // 触发渲染
  useEffect(() => {
    if (children) {
      setIsLoading(true)
      debouncedRender(children)
    } else {
      debouncedRender.cancel()
      setIsLoading(false)
    }

    return () => {
      debouncedRender.cancel()
    }
  }, [children, debouncedRender])

  return (
    <Spin spinning={loading || isLoading} indicator={<SvgSpinners180Ring color="var(--color-text-2)" />}>
      <PreviewContainer vertical>
        {error && <PreviewError>{error}</PreviewError>}
        <div ref={svgContainerRef} className={className ?? 'svg-preview special-preview'}></div>
        {!error && enableToolbar && <ImageToolbar pan={pan} zoom={zoom} />}
      </PreviewContainer>
    </Spin>
  )
}

export default memo(SvgPreview)
