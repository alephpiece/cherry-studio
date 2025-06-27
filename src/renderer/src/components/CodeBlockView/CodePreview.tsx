import { CodeTool, TOOL_SPECS, useCodeTool } from '@renderer/components/CodeToolbar'
import { useCodeStyle } from '@renderer/context/CodeStyleProvider'
import { useCodeHighlight } from '@renderer/hooks/useCodeHighlight'
import { useSettings } from '@renderer/hooks/useSettings'
import { uuid } from '@renderer/utils'
import { getReactStyleFromToken } from '@renderer/utils/shiki'
import { ChevronsDownUp, ChevronsUpDown, Text as UnWrapIcon, WrapText as WrapIcon } from 'lucide-react'
import React, { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { VariableSizeList } from 'react-window'
import { ThemedToken } from 'shiki/core'
import styled from 'styled-components'

interface CodePreviewProps {
  children: string
  language: string
  setTools?: (value: React.SetStateAction<CodeTool[]>) => void
}

const MIN_COLLAPSE_LINES = 16
const DEFAULT_LINE_HEIGHT = 24 // 仅作为初始估计值，实际高度基于测量
const MAX_COLLAPSE_HEIGHT = DEFAULT_LINE_HEIGHT * MIN_COLLAPSE_LINES

/**
 * Shiki 流式代码高亮组件
 * - 使用虚拟滚动
 * - 自动测量高度
 */
const CodePreview = ({ children, language, setTools }: CodePreviewProps) => {
  const { codeShowLineNumbers, fontSize, codeCollapsible, codeWrappable } = useSettings()
  const { activeShikiTheme, getShikiPreProperties } = useCodeStyle()
  const [isExpanded, setIsExpanded] = useState(!codeCollapsible)
  const [isUnwrapped, setIsUnwrapped] = useState(!codeWrappable)
  const [lineHeights, setLineHeights] = useState<{ [key: number]: number }>({})
  const shikiPreRef = useRef<HTMLPreElement>(null)
  const listRef = useRef<VariableSizeList>(null)
  const callerId = useRef(`${Date.now()}-${uuid()}`).current

  const { t } = useTranslation()
  const { registerTool, removeTool } = useCodeTool(setTools)

  // 使用代码高亮 Hook
  const { tokenLines, highlightCode } = useCodeHighlight({
    children,
    language,
    callerId
  })

  // 触发代码高亮
  useLayoutEffect(() => {
    if (shikiPreRef.current) {
      setTimeout(highlightCode, 0)
    }
  }, [highlightCode])

  // 主题变化时重置高度缓存
  useEffect(() => {
    setLineHeights({})
  }, [activeShikiTheme])

  const shouldCollapse = useMemo(() => codeCollapsible && !isExpanded, [codeCollapsible, isExpanded])
  const shouldWrap = useMemo(() => codeWrappable && !isUnwrapped, [codeWrappable, isUnwrapped])

  // 展开/折叠工具
  useEffect(() => {
    registerTool({
      ...TOOL_SPECS.expand,
      icon: isExpanded ? <ChevronsDownUp className="icon" /> : <ChevronsUpDown className="icon" />,
      tooltip: isExpanded ? t('code_block.collapse') : t('code_block.expand'),
      visible: () => {
        return codeCollapsible && tokenLines.length > MIN_COLLAPSE_LINES
      },
      onClick: () => setIsExpanded((prev) => !prev)
    })

    return () => removeTool(TOOL_SPECS.expand.id)
  }, [codeCollapsible, isExpanded, registerTool, removeTool, t, tokenLines.length])

  // 自动换行工具
  useEffect(() => {
    registerTool({
      ...TOOL_SPECS.wrap,
      icon: isUnwrapped ? <WrapIcon className="icon" /> : <UnWrapIcon className="icon" />,
      tooltip: isUnwrapped ? t('code_block.wrap.on') : t('code_block.wrap.off'),
      visible: () => codeWrappable,
      onClick: () => setIsUnwrapped((prev) => !prev)
    })

    return () => removeTool(TOOL_SPECS.wrap.id)
  }, [codeWrappable, isUnwrapped, registerTool, removeTool, t])

  // 更新展开状态
  useEffect(() => {
    setIsExpanded(!codeCollapsible)
  }, [codeCollapsible])

  // 更新换行状态
  useEffect(() => {
    setIsUnwrapped(!codeWrappable)
  }, [codeWrappable])

  // 设置 pre 标签属性
  useLayoutEffect(() => {
    getShikiPreProperties(language).then((properties) => {
      const pre = shikiPreRef.current
      if (pre) {
        pre.className = `${properties.class || 'shiki'}`
        if (properties.style) {
          pre.style.cssText = `${properties.style}`
        }
        pre.style.setProperty('overflow', 'visible')
        pre.tabIndex = properties.tabindex
      }
    })
  }, [language, getShikiPreProperties])

  // 计算行号数字位数
  const gutterDigits = useMemo(
    () => (codeShowLineNumbers ? Math.max(tokenLines.length.toString().length, 1) : 0),
    [codeShowLineNumbers, tokenLines.length]
  )

  // 自动高度测量
  const updateLineHeight = useCallback((index: number, height: number) => {
    setLineHeights((prev) => {
      const currentHeight = prev[index] || DEFAULT_LINE_HEIGHT

      if (Math.abs(currentHeight - height) > 1) {
        // 触发VariableSizeList重新计算
        setTimeout(() => {
          if (listRef.current) {
            listRef.current.resetAfterIndex(index, true)
          }
        }, 0)

        return { ...prev, [index]: height }
      }
      return prev
    })
  }, [])

  // wrap模式下实际测量行高，unwrap模式下使用固定高度
  const getItemSize = useCallback(
    (index: number) => {
      if (shouldWrap) {
        return lineHeights[index] || DEFAULT_LINE_HEIGHT
      }
      return DEFAULT_LINE_HEIGHT
    },
    [lineHeights, shouldWrap]
  )

  // wrap状态变化时重置高度缓存
  useEffect(() => {
    setLineHeights({})
  }, [shouldWrap])

  // 计算虚拟列表高度
  const listHeight = useMemo(() => {
    const totalHeight = tokenLines.reduce((sum, _, index) => {
      return sum + getItemSize(index)
    }, 0)
    return shouldCollapse ? Math.min(totalHeight, MAX_COLLAPSE_HEIGHT) : totalHeight
  }, [tokenLines, shouldCollapse, getItemSize])

  const virtualItemData = useMemo(
    () => ({ tokenLines, lineNumbers: codeShowLineNumbers, shouldWrap, updateLineHeight }),
    [tokenLines, codeShowLineNumbers, shouldWrap, updateLineHeight]
  )

  const hasHighlightedCode = tokenLines.length > 0

  return (
    <pre ref={shikiPreRef}>
      <CodeContainer
        className="shiki-code"
        $fontSize={fontSize - 1}
        $wrap={shouldWrap}
        $fadeIn={hasHighlightedCode}
        style={{ '--gutter-width': `${gutterDigits}ch` } as React.CSSProperties}>
        {hasHighlightedCode ? (
          <VariableSizeList
            className="shiki-list"
            ref={listRef}
            height={listHeight}
            width="100%"
            itemCount={tokenLines.length}
            itemSize={getItemSize}
            estimatedItemSize={DEFAULT_LINE_HEIGHT}
            itemData={virtualItemData}
            overscanCount={20}>
            {VirtualizedLine}
          </VariableSizeList>
        ) : (
          <CodePlaceholder style={{ maxHeight: shouldCollapse ? MAX_COLLAPSE_HEIGHT : undefined }}>
            {children}
          </CodePlaceholder>
        )}
      </CodeContainer>
    </pre>
  )
}

CodePreview.displayName = 'CodePreview'

interface VirtualLineData {
  tokenLines: ThemedToken[][]
  lineNumbers: boolean
  shouldWrap: boolean
  updateLineHeight: (index: number, height: number) => void
}

/**
 * 虚拟化行组件
 */
const VirtualizedLine = memo<{
  index: number
  style: React.CSSProperties
  data: VirtualLineData
}>(({ index, style, data }) => {
  const { tokenLines, lineNumbers, shouldWrap, updateLineHeight } = data
  const lineTokens = tokenLines[index]
  const lineRef = useRef<HTMLDivElement>(null)

  // 高度测量
  useEffect(() => {
    if (!lineRef.current) return

    const element = lineRef.current

    // 立即测量初始高度
    const initialHeight = element.clientHeight
    if (initialHeight > 0) {
      updateLineHeight(index, initialHeight)
    }

    // 使用ResizeObserver监听高度变化
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height
        if (height > 0) {
          updateLineHeight(index, height)
        }
      }
    })

    resizeObserver.observe(element)
    return () => resizeObserver.disconnect()
  }, [index, updateLineHeight, lineTokens])

  if (!lineTokens) {
    return <div style={style} />
  }

  return (
    <div ref={lineRef} style={style} className={`line ${shouldWrap ? 'line-wrap' : ''}`}>
      {lineNumbers && <span className="line-number">{index + 1}</span>}
      <span className="line-content">
        {lineTokens.map((token, tokenIndex) => (
          <span key={`token-${tokenIndex}`} style={getReactStyleFromToken(token)}>
            {token.content}
          </span>
        ))}
      </span>
    </div>
  )
})

VirtualizedLine.displayName = 'VirtualizedLine'

const CodeContainer = styled.code<{ $fontSize: number; $wrap?: boolean; $fadeIn?: boolean }>`
  display: block;
  font-size: ${(props) => props.$fontSize}px;
  height: auto;
  position: relative;
  overflow: visible;
  border-radius: inherit;

  .line {
    display: flex;
    align-items: flex-start;
    padding-left: 1rem;

    &.line-wrap {
      /* 强制覆盖虚拟滚动的样式限制，用于支持自动换行 */
      height: auto !important;
    }

    .line-number {
      width: var(--gutter-width, 1.2ch);
      text-align: right;
      opacity: 0.35;
      margin-right: 1rem;
      user-select: none;
      flex-shrink: 0;
      overflow: hidden;
      line-height: inherit;
      font-family: inherit;
      font-variant-numeric: tabular-nums;
    }

    .line-content {
      flex: 1;
      line-height: inherit;
      white-space: ${(props) => (props.$wrap ? 'pre-wrap' : 'pre')};
      overflow-wrap: ${(props) => (props.$wrap ? 'break-word' : 'normal')};
    }
  }

  @keyframes contentFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  animation: ${(props) => (props.$fadeIn ? 'contentFadeIn 0.1s ease-in forwards' : 'none')};
`

const CodePlaceholder = styled.div`
  display: block;
  opacity: 0.1;
  white-space: pre-wrap;
  word-break: break-all;
  overflow-x: hidden;
  min-height: 1.3rem;
`

export default memo(CodePreview)
