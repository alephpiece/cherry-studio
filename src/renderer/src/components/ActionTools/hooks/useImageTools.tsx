import { loggerService } from '@logger'
import { download as downloadFile } from '@renderer/utils/download'
import { svgToPngBlob, svgToSvgBlob } from '@renderer/utils/image'
import { RefObject, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

const logger = loggerService.withContext('usePreviewToolHandlers')

/**
 * 使用图像处理工具的自定义Hook
 * 提供图像缩放、复制和下载功能
 */
export const useImageTools = (
  containerRef: RefObject<HTMLDivElement | null>,
  options: {
    prefix: string
    imgSelector: string
    enableWheelZoom?: boolean
  }
) => {
  const transformRef = useRef({ scale: 1, x: 0, y: 0 }) // 管理变换状态
  const { imgSelector, prefix, enableWheelZoom } = options
  const { t } = useTranslation()

  // 创建选择器函数
  const getImgElement = useCallback(() => {
    if (!containerRef.current) return null

    // 优先尝试从 Shadow DOM 中查找
    const shadowRoot = containerRef.current.shadowRoot
    if (shadowRoot) {
      return shadowRoot.querySelector(imgSelector) as SVGElement | null
    }

    // 降级到常规 DOM 查找
    return containerRef.current.querySelector(imgSelector) as SVGElement | null
  }, [containerRef, imgSelector])

  // 查询当前位置
  const getCurrentPosition = useCallback(() => {
    const imgElement = getImgElement()
    if (!imgElement) return transformRef.current

    const transform = imgElement.style.transform
    if (!transform || transform === 'none') return transformRef.current

    // 使用CSS矩阵解析
    const matrix = new DOMMatrix(transform)
    return { x: matrix.m41, y: matrix.m42 }
  }, [getImgElement])

  /**
   * 平移缩放变换
   * @param element 要应用变换的元素
   * @param x X轴偏移量
   * @param y Y轴偏移量
   * @param scale 缩放比例
   */
  const applyTransform = useCallback((element: SVGElement | null, x: number, y: number, scale: number) => {
    if (!element) return
    element.style.transformOrigin = 'top left'
    element.style.transform = `translate(${x}px, ${y}px) scale(${scale})`
  }, [])

  /**
   * 平移函数 - 按指定方向和距离移动图像
   * @param dx X轴偏移量（正数向右，负数向左）
   * @param dy Y轴偏移量（正数向下，负数向上）
   * @param absolute 是否为绝对位置（true）或相对偏移（false）
   */
  const pan = useCallback(
    (dx: number, dy: number, absolute = false) => {
      const currentPos = getCurrentPosition()
      const newX = absolute ? dx : currentPos.x + dx
      const newY = absolute ? dy : currentPos.y + dy

      transformRef.current.x = newX
      transformRef.current.y = newY

      const imgElement = getImgElement()
      applyTransform(imgElement, newX, newY, transformRef.current.scale)
    },
    [getCurrentPosition, getImgElement, applyTransform]
  )

  // 拖拽平移支持
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const startPos = { x: 0, y: 0 }

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startPos.x
      const dy = e.clientY - startPos.y

      // 直接使用 transformRef 中的初始偏移量进行计算
      const newX = transformRef.current.x + dx
      const newY = transformRef.current.y + dy

      const imgElement = getImgElement()
      // 实时应用变换，但不更新 ref，避免累积误差
      applyTransform(imgElement, newX, newY, transformRef.current.scale)
      e.preventDefault()
    }

    const handleMouseUp = (e: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)

      container.style.cursor = 'default'

      // 拖拽结束后，计算最终位置并更新 ref
      const dx = e.clientX - startPos.x
      const dy = e.clientY - startPos.y
      transformRef.current.x += dx
      transformRef.current.y += dy
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return // 只响应左键

      // 每次拖拽开始时，都以 ref 中当前的位置为基准
      const currentPos = getCurrentPosition()
      transformRef.current.x = currentPos.x
      transformRef.current.y = currentPos.y

      startPos.x = e.clientX
      startPos.y = e.clientY

      container.style.cursor = 'grabbing'
      e.preventDefault()

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    container.addEventListener('mousedown', handleMouseDown)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      // 清理以防万一，例如组件在拖拽过程中被卸载
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [containerRef, getImgElement, applyTransform, getCurrentPosition])

  /**
   * 缩放处理函数
   * @param delta 缩放增量（正值放大，负值缩小）
   */
  const zoom = useCallback(
    (delta: number, absolute = false) => {
      const newScale = absolute
        ? Math.max(0.1, Math.min(3, delta))
        : Math.max(0.1, Math.min(3, transformRef.current.scale + delta))

      transformRef.current.scale = newScale

      const imgElement = getImgElement()
      applyTransform(imgElement, transformRef.current.x, transformRef.current.y, newScale)
    },
    [getImgElement, applyTransform]
  )

  // 滚轮缩放支持
  useEffect(() => {
    if (!enableWheelZoom || !containerRef.current) return

    const container = containerRef.current

    const handleWheel = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.target) {
        // 确认事件发生在容器内部
        if (container.contains(e.target as Node)) {
          const delta = e.deltaY < 0 ? 0.1 : -0.1
          zoom(delta)
        }
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: true })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [containerRef, zoom, enableWheelZoom])

  // 复制图像处理函数
  const copy = useCallback(async () => {
    try {
      const imgElement = getImgElement()
      if (!imgElement) return

      const blob = await svgToPngBlob(imgElement)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      window.message.success(t('message.copy.success'))
    } catch (error) {
      logger.error('Copy failed:', error as Error)
      window.message.error(t('message.copy.failed'))
    }
  }, [getImgElement, t])

  // 下载处理函数
  const download = useCallback(
    async (format: 'svg' | 'png') => {
      try {
        const imgElement = getImgElement()
        if (!imgElement) return

        const timestamp = Date.now()

        if (format === 'svg') {
          const blob = svgToSvgBlob(imgElement)
          const url = URL.createObjectURL(blob)
          downloadFile(url, `${prefix}-${timestamp}.svg`)
          URL.revokeObjectURL(url)
        } else {
          const blob = await svgToPngBlob(imgElement)
          const pngUrl = URL.createObjectURL(blob)
          downloadFile(pngUrl, `${prefix}-${timestamp}.png`)
          URL.revokeObjectURL(pngUrl)
        }
      } catch (error) {
        logger.error('Download failed:', error as Error)
        window.message.error(t('message.download.failed'))
      }
    },
    [getImgElement, prefix, t]
  )

  return {
    scale: transformRef.current.scale,
    zoom,
    pan,
    copy,
    download
  }
}
