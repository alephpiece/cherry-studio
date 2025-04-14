import { useToolbar } from '@renderer/components/CodeView/context'
import { useCodeStyle } from '@renderer/context/CodeStyleProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { uuid } from '@renderer/utils'
import { getTokenStyleObject } from '@shikijs/core'
import { ChevronsDownUp, ChevronsUpDown, Text as UnWrapIcon, WrapText as WrapIcon } from 'lucide-react'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ThemedToken } from 'shiki'
import styled from 'styled-components'

interface SourcePreviewProps {
  children: string
  language: string
}

/**
 * Shiki 流式代码高亮组件
 *
 * - 通过 shiki tokenizer 处理流式响应
 * - 为了正确执行语法高亮，必须保证流式响应都依次到达 tokenizer，不能跳过
 */
const SourcePreview = ({
  ref,
  children,
  language
}: SourcePreviewProps & { ref?: React.RefObject<HTMLDivElement | null> }) => {
  const { codeShowLineNumbers, fontSize, codeCollapsible, codeWrappable } = useSettings()
  const { highlightCodeChunk, cleanupTokenizers } = useCodeStyle()
  const [isExpanded, setIsExpanded] = useState(!codeCollapsible)
  const [isUnwrapped, setIsUnwrapped] = useState(!codeWrappable)
  const [tokenLines, setTokenLines] = useState<ThemedToken[][]>([])
  const codeContentRef = useRef<HTMLDivElement>(null)
  const prevCodeLengthRef = useRef(0)
  const shouldAutoScrollRef = useRef<boolean>(true)
  const callerId = useRef(`${Date.now()}-${uuid()}`).current

  const { t } = useTranslation()

  // 合并引用
  React.useImperativeHandle(ref, () => codeContentRef.current!, [])

  const { registerTool, removeTool } = useToolbar()

  // 展开/折叠工具
  useEffect(() => {
    registerTool({
      id: 'expand',
      type: 'quick',
      icon: isExpanded ? <ChevronsDownUp className="icon" /> : <ChevronsUpDown className="icon" />,
      tooltip: isExpanded ? t('code_block.collapse') : t('code_block.expand'),
      visible: () => {
        const scrollHeight = codeContentRef.current?.scrollHeight
        return codeCollapsible && (scrollHeight ?? 0) > 350
      },
      onClick: () => setIsExpanded(!isExpanded),
      order: 1
    })

    return () => removeTool('expand')
  }, [codeCollapsible, isExpanded, registerTool, removeTool, t])

  // 自动换行工具
  useEffect(() => {
    registerTool({
      id: 'wrap',
      type: 'quick',
      icon: isUnwrapped ? <WrapIcon className="icon" /> : <UnWrapIcon className="icon" />,
      tooltip: isUnwrapped ? t('code_block.wrap.on') : t('code_block.wrap.off'),
      visible: () => codeWrappable,
      onClick: () => setIsUnwrapped(!isUnwrapped),
      order: 0
    })

    return () => removeTool('wrap')
  }, [codeWrappable, isUnwrapped, registerTool, removeTool, t])

  // 更新展开状态
  useEffect(() => {
    setIsExpanded(!codeCollapsible)
  }, [codeCollapsible])

  // 更新换行状态
  useEffect(() => {
    setIsUnwrapped(!codeWrappable)
  }, [codeWrappable])

  const scrollToBottom = useCallback(() => {
    if (codeContentRef.current && !isExpanded) {
      codeContentRef.current.scrollTop = codeContentRef.current.scrollHeight
    }
  }, [isExpanded])

  // 处理尾部空白字符
  const safeCodeString = useMemo(() => {
    return typeof children === 'string' ? children.trimEnd() : ''
  }, [children])

  const highlightCode = useCallback(async () => {
    if (!safeCodeString) return

    if (prevCodeLengthRef.current < safeCodeString.length) {
      // 传递增量部分，获取高亮的 token lines
      const incrementalCode = safeCodeString.slice(prevCodeLengthRef.current)
      if (incrementalCode.length > 0) {
        const result = await highlightCodeChunk(incrementalCode, language, callerId)
        setTokenLines((lines) => [...lines.slice(0, lines.length - result.recall), ...result.lines])
      }
    } else {
      // FIXME: 长度有问题，清理 tokenizer
      if (prevCodeLengthRef.current > safeCodeString.length) {
        cleanupTokenizers(callerId)
      }

      const result = await highlightCodeChunk(safeCodeString, language, callerId)

      setTokenLines(result.lines)
    }

    prevCodeLengthRef.current = safeCodeString.length

    // 如果需要自动滚动，则滚动到页面底部
    if (shouldAutoScrollRef.current) {
      requestAnimationFrame(scrollToBottom)
    }
  }, [callerId, cleanupTokenizers, highlightCodeChunk, language, safeCodeString, scrollToBottom])

  // 组件卸载时清理资源
  useEffect(() => {
    return () => cleanupTokenizers(callerId)
  }, [callerId, cleanupTokenizers])

  // 处理第二次开始的代码高亮
  useEffect(() => {
    if (prevCodeLengthRef.current > 0) {
      setTimeout(highlightCode, 0)
    }
  }, [highlightCode])

  // 视口检测逻辑，只处理第一次代码高亮
  useEffect(() => {
    const codeElement = codeContentRef.current
    if (!codeElement || prevCodeLengthRef.current > 0) return

    let isMounted = true

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && isMounted) {
        setTimeout(highlightCode, 0)
        observer.disconnect()
      }
    })

    observer.observe(codeElement)

    return () => {
      isMounted = false
      observer.disconnect()
    }
  }, [highlightCode])

  // 处理滚动事件，判断是否需要继续自动滚动
  const handleScroll = useCallback(() => {
    if (!codeContentRef.current) {
      shouldAutoScrollRef.current = false
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = codeContentRef.current
    shouldAutoScrollRef.current = scrollHeight - (scrollTop + clientHeight) < 50
  }, [])

  // 监听滚动事件
  useEffect(() => {
    const codeElement = codeContentRef.current
    if (!codeElement) return

    codeElement.addEventListener('scroll', handleScroll)

    return () => codeElement.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  return (
    <ContentContainer
      ref={codeContentRef}
      isShowLineNumbers={codeShowLineNumbers}
      isUnwrapped={isUnwrapped}
      isCodeWrappable={codeWrappable}
      style={{
        fontSize: fontSize - 1,
        maxHeight: codeCollapsible && !isExpanded ? '350px' : 'none',
        overflow: codeCollapsible && !isExpanded ? 'auto' : 'visible'
      }}>
      {tokenLines.length > 0 ? (
        <ShikiTokensRenderer language={language} tokenLines={tokenLines} />
      ) : (
        <div style={{ opacity: 0.1 }}>{children}</div>
      )}
    </ContentContainer>
  )
}

/**
 * 渲染 Shiki 高亮后的 tokens
 *
 * 独立出来，方便将来做 virtual list
 */
const ShikiTokensRenderer: React.FC<{ language: string; tokenLines: ThemedToken[][] }> = memo(
  ({ language, tokenLines }) => {
    const { getShikiPreProperties } = useCodeStyle()
    const rendererRef = useRef<HTMLPreElement>(null)

    // 设置 pre 标签属性
    useEffect(() => {
      getShikiPreProperties(language).then((properties) => {
        const pre = rendererRef.current
        if (pre) {
          pre.className = properties.class
          pre.style.cssText = properties.style
          pre.tabIndex = properties.tabindex
        }
      })
    }, [language, getShikiPreProperties])

    // Shiki token 样式转换为 React 样式对象
    function getReactStyleFromToken(token: ThemedToken): Record<string, string> {
      const style = token.htmlStyle || getTokenStyleObject(token)
      const reactStyle: Record<string, string> = {}
      for (const [key, value] of Object.entries(style)) {
        switch (key) {
          case 'font-style':
            reactStyle.fontStyle = value
            break
          case 'font-weight':
            reactStyle.fontWeight = value
            break
          case 'background-color':
            reactStyle.backgroundColor = value
            break
          case 'text-decoration':
            reactStyle.textDecoration = value
            break
          default:
            reactStyle[key] = value
        }
      }
      return reactStyle
    }

    return (
      <pre className="shiki" ref={rendererRef}>
        <code>
          {tokenLines.map((lineTokens, lineIndex) => (
            <span key={`line-${lineIndex}`} className="line">
              {lineTokens.map((token, tokenIndex) => (
                <span key={`${lineIndex}-${tokenIndex}-${token.content}`} style={getReactStyleFromToken(token)}>
                  {token.content}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
    )
  }
)

const ContentContainer = styled.div<{
  isShowLineNumbers: boolean
  isUnwrapped: boolean
  isCodeWrappable: boolean
}>`
  position: relative;
  border: 0.5px solid var(--color-code-background);
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  margin-top: 0;
  transition: opacity 0.3s ease;

  .shiki {
    padding: 1em;

    code {
      display: flex;
      flex-direction: column;
      width: 100%;

      .line {
        display: block;
        min-height: 1.3rem;
        padding-left: ${(props) => (props.isShowLineNumbers ? '2rem' : '0')};
      }
    }
  }

  ${(props) =>
    props.isShowLineNumbers &&
    `
      code {
        counter-reset: step;
        counter-increment: step 0;
        position: relative;
      }

      code .line::before {
        content: counter(step);
        counter-increment: step;
        width: 1rem;
        position: absolute;
        left: 0;
        text-align: right;
        opacity: 0.35;
      }
    `}

  ${(props) =>
    props.isCodeWrappable &&
    !props.isUnwrapped &&
    `
      code .line * {
        word-wrap: break-word;
        white-space: pre-wrap;
      }
    `}
`

SourcePreview.displayName = 'SourcePreview'

export default memo(SourcePreview)
