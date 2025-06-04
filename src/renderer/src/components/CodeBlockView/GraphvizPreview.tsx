import { usePreviewToolHandlers, usePreviewTools } from '@renderer/components/CodeToolbar'
import SvgSpinners180Ring from '@renderer/components/Icons/SvgSpinners180Ring'
import { Flex, Spin } from 'antd'
import { debounce } from 'lodash'
import React, { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import styled from 'styled-components'

import { BasicPreviewProps } from './types'

// 懒加载 viz 实例
let vizInstance: any = null
let vizLoading = false
let vizLoadPromise: Promise<any> | null = null

const loadViz = async () => {
  if (vizInstance) return vizInstance
  if (vizLoading && vizLoadPromise) return vizLoadPromise

  vizLoading = true
  vizLoadPromise = import('@viz-js/viz')
    .then(async (module) => {
      vizInstance = await module.instance()
      vizLoading = false
      return vizInstance
    })
    .catch((error) => {
      vizLoading = false
      throw error
    })

  return vizLoadPromise
}

/** 预览 Graphviz 图表
 * 通过防抖渲染提供比较统一的体验，减少闪烁。
 */
const GraphvizPreview: React.FC<BasicPreviewProps> = ({ children, setTools }) => {
  const graphvizRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingViz, setIsLoadingViz] = useState(false)
  const [isRendering, setIsRendering] = useState(false)

  // 使用通用图像工具
  const { handleZoom, handleCopyImage, handleDownload } = usePreviewToolHandlers(graphvizRef, {
    imgSelector: 'svg',
    prefix: 'graphviz',
    enableWheelZoom: true
  })

  // 使用工具栏
  usePreviewTools({
    setTools,
    handleZoom,
    handleCopyImage,
    handleDownload
  })

  // 实际的渲染函数
  const renderGraphviz = useCallback(async (content: string) => {
    if (!content || !graphvizRef.current) return

    try {
      setIsRendering(true)

      // 首次加载时显示加载状态
      if (!vizInstance) {
        setIsLoadingViz(true)
      }

      const viz = await loadViz()
      setIsLoadingViz(false)

      const svgElement = viz.renderSVGElement(content)

      // 清空容器并添加新的 SVG
      graphvizRef.current.innerHTML = ''
      graphvizRef.current.appendChild(svgElement)

      // 渲染成功，清除错误记录
      setError(null)
    } catch (error) {
      setError((error as Error).message || 'DOT syntax error or rendering failed')
      setIsLoadingViz(false)
    } finally {
      setIsRendering(false)
    }
  }, [])

  // debounce 渲染
  const debouncedRender = useMemo(
    () =>
      debounce((content: string) => {
        startTransition(() => renderGraphviz(content))
      }, 300),
    [renderGraphviz]
  )

  // 触发渲染
  useEffect(() => {
    if (children) {
      setIsRendering(true)
      debouncedRender(children)
    } else {
      debouncedRender.cancel()
      setIsRendering(false)
    }

    return () => {
      debouncedRender.cancel()
    }
  }, [children, debouncedRender])

  const isLoading = isLoadingViz || isRendering

  return (
    <Spin spinning={isLoading} indicator={<SvgSpinners180Ring color="var(--color-text-2)" />}>
      <Flex vertical style={{ minHeight: isLoading ? '2rem' : 'auto' }}>
        {error && <StyledError>{error}</StyledError>}
        <StyledGraphviz ref={graphvizRef} className="graphviz special-preview" />
      </Flex>
    </Spin>
  )
}

const StyledGraphviz = styled.div`
  overflow: auto;
`

const StyledError = styled.div`
  overflow: auto;
  padding: 16px;
  color: #ff4d4f;
  border: 1px solid #ff4d4f;
  border-radius: 4px;
  word-wrap: break-word;
  white-space: pre-wrap;
`

export default memo(GraphvizPreview)
