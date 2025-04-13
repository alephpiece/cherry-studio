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

interface CodePreviewProps {
  children: string
  language: string
}

/**
 * Shiki 代码高亮组件的入口
 *
 * 集成了流式代码高亮的渲染逻辑
 */
const CodePreview = ({
  ref,
  children,
  language
}: CodePreviewProps & { ref?: React.RefObject<HTMLDivElement | null> }) => {
  const { codeShowLineNumbers, fontSize, codeCollapsible, codeWrappable } = useSettings()
  const { highlightCodeChunk, cleanupTokenizer } = useCodeStyle()
  const [isExpanded, setIsExpanded] = useState(!codeCollapsible)
  const [isUnwrapped, setIsUnwrapped] = useState(!codeWrappable)
  const [showExpandButton, setShowExpandButton] = useState(false)
  const [tokenLines, setTokenLines] = useState<ThemedToken[][]>([])
  const showExpandButtonRef = useRef(false)
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
      visible: () => codeCollapsible && showExpandButton,
      onClick: () => setIsExpanded(!isExpanded),
      order: 1
    })

    return () => removeTool('expand')
  }, [codeCollapsible, isExpanded, registerTool, removeTool, showExpandButton, t])

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
    setShowExpandButton(codeCollapsible && (codeContentRef.current?.scrollHeight ?? 0) > 350)
  }, [codeCollapsible])

  // 更新换行状态
  useEffect(() => {
    setIsUnwrapped(!codeWrappable)
  }, [codeWrappable])

  // 检查是否需要显示展开按钮
  const updateShowExpandButton = useCallback(() => {
    if (!codeContentRef.current) return

    const isShowExpandButton = codeContentRef.current.scrollHeight > 350
    if (showExpandButtonRef.current === isShowExpandButton) return

    showExpandButtonRef.current = isShowExpandButton
    setShowExpandButton(showExpandButtonRef.current)
  }, [])

  const scrollToBottom = useCallback(() => {
    if (codeContentRef.current && !isExpanded) {
      codeContentRef.current.scrollTop = codeContentRef.current.scrollHeight
    }
  }, [isExpanded])

  const handleScroll = useCallback(() => {
    if (!codeContentRef.current) {
      shouldAutoScrollRef.current = false
      return
    }

    const { scrollTop, scrollHeight, clientHeight } = codeContentRef.current
    shouldAutoScrollRef.current = scrollHeight - (scrollTop + clientHeight) < 50
  }, [])

  // 处理尾部空白字符
  const safeCodeString = useMemo(() => {
    return typeof children === 'string' ? children.trimEnd() : ''
  }, [children])

  const highlightCode = useCallback(async () => {
    if (!safeCodeString) return

    if (prevCodeLengthRef.current < safeCodeString.length) {
      // 传递增量部分，获取高亮的 token lines
      const incrementalCode = safeCodeString.slice(prevCodeLengthRef.current)
      const result = await highlightCodeChunk(incrementalCode, language, callerId)

      setTokenLines((lines) => [...lines.slice(0, lines.length - result.recall), ...result.lines])
      prevCodeLengthRef.current = safeCodeString.length
    } else {
      // FIXME: 长度有问题，清理 tokenizer
      if (prevCodeLengthRef.current > safeCodeString.length) {
        cleanupTokenizer(callerId)
      }

      // 不管是第一次高亮还是长度有问题，都传整个代码过去
      const result = await highlightCodeChunk(safeCodeString, language, callerId)

      setTokenLines(result.lines)
      prevCodeLengthRef.current = safeCodeString.length
    }

    updateShowExpandButton()

    // 如果需要自动滚动，则滚动到页面底部
    if (shouldAutoScrollRef.current) {
      requestAnimationFrame(scrollToBottom)
    }
  }, [callerId, cleanupTokenizer, highlightCodeChunk, language, safeCodeString, scrollToBottom, updateShowExpandButton])

  // 组件卸载时清理资源
  useEffect(() => {
    return () => cleanupTokenizer(callerId)
  }, [callerId, cleanupTokenizer])

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

    return (
      <pre className="shiki" ref={rendererRef}>
        <code>
          {tokenLines.map((lineTokens, lineIndex) => (
            <span key={`line-${lineIndex}`} className="line">
              {lineTokens.map((token, tokenIndex) => (
                <span
                  key={`${lineIndex}-${tokenIndex}-${token.content}`}
                  style={token.htmlStyle || getTokenStyleObject(token)}>
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

CodePreview.displayName = 'CodePreview'

export default memo(CodePreview)
