import { debounce } from 'lodash'
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import ImagePreviewLayout from './ImagePreviewLayout'
import { BasicPreviewHandles } from './types'
import { renderSvgInShadowHost } from './utils'

interface SvgPreviewProps {
  children: string
  enableToolbar?: boolean
  className?: string
  ref?: React.RefObject<BasicPreviewHandles | null>
}

/**
 * 使用 Shadow DOM 渲染 SVG
 * 通过防抖渲染提供比较统一的体验，减少闪烁。
 */
const SvgPreview = ({ children, enableToolbar = false, className, ref }: SvgPreviewProps) => {
  const svgContainerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // 实际的渲染函数
  const renderSvg = useCallback(async (content: string) => {
    if (!content || !svgContainerRef.current) return

    try {
      setIsLoading(true)
      renderSvgInShadowHost(svgContainerRef.current, content)
      setError(null) // 渲染成功，清除错误记录
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
    <ImagePreviewLayout
      loading={isLoading}
      error={error}
      enableToolbar={enableToolbar}
      ref={ref}
      imageRef={svgContainerRef}
      source="svg">
      <div ref={svgContainerRef} className={className ?? 'svg-preview special-preview'}></div>
    </ImagePreviewLayout>
  )
}

export default memo(SvgPreview)
