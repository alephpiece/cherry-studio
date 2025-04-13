import { ExpandAltOutlined, ShrinkOutlined } from '@ant-design/icons'
import { useToolbar } from '@renderer/components/CodeView/context'
import UnWrapIcon from '@renderer/components/Icons/UnWrapIcon'
import WrapIcon from '@renderer/components/Icons/WrapIcon'
import { useCodeStyle } from '@renderer/context/CodeStyleProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import { getTokenStyleObject } from '@shikijs/core'
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
  const { createHighlighterStream, closeHighlighterStream } = useCodeStyle()
  const [isExpanded, setIsExpanded] = useState(!codeCollapsible)
  const [isUnwrapped, setIsUnwrapped] = useState(!codeWrappable)
  const [showExpandButton, setShowExpandButton] = useState(false)
  const [tokens, setTokens] = useState<ThemedToken[]>([])
  const showExpandButtonRef = useRef(false)
  const codeContentRef = useRef<HTMLDivElement>(null)
  const prevCodeLengthRef = useRef(0)
  const isStreamingRef = useRef(false)
  const shouldAutoScrollRef = useRef<boolean>(true)
  const callerId = useRef(crypto.randomUUID()).current
  const subscriberIdRef = useRef<string | null>(null)

  const { t } = useTranslation()

  // 合并引用
  React.useImperativeHandle(ref, () => codeContentRef.current!, [])

  const { registerTool, removeTool } = useToolbar()

  // 处理尾部空白字符
  const safeCodeString = useMemo(() => {
    return typeof children === 'string' ? children.trimEnd() : ''
  }, [children])

  // 展开/折叠工具
  useEffect(() => {
    registerTool({
      id: 'expand',
      type: 'quick',
      icon: isExpanded ? <ShrinkOutlined /> : <ExpandAltOutlined />,
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
      icon: isUnwrapped ? <WrapIcon /> : <UnWrapIcon />,
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

  // 初始化高亮流并处理 tokens 更新
  useEffect(() => {
    let isMounted = true
    let streamHandler: {
      subscribe: (callback: (tokens: ThemedToken[]) => void) => string
      unsubscribe: (subscriberId: string) => void
    } | null = null

    const setupStream = async () => {
      // 创建高亮流
      streamHandler = await createHighlighterStream(safeCodeString, language, callerId)

      // 注册 tokens 回调
      subscriberIdRef.current = streamHandler.subscribe((updatedTokens) => {
        if (isMounted) {
          setTokens(updatedTokens)

          // 如果需要，自动滚动到底部
          if (shouldAutoScrollRef.current) {
            requestAnimationFrame(scrollToBottom)
          }
        }
      })
    }

    setupStream()

    return () => {
      isMounted = false
      // 取消订阅
      if (subscriberIdRef.current) {
        streamHandler?.unsubscribe(subscriberIdRef.current)
        subscriberIdRef.current = null
      }
    }
  }, [safeCodeString, language, callerId, createHighlighterStream, scrollToBottom])

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      closeHighlighterStream(callerId)
    }
  }, [callerId, closeHighlighterStream])

  // 监听滚动事件
  useEffect(() => {
    const codeElement = codeContentRef.current
    if (!codeElement) return

    codeElement.addEventListener('scroll', handleScroll)

    return () => codeElement.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // 视口检测逻辑
  useEffect(() => {
    const codeElement = codeContentRef.current
    if (!codeElement) return

    let isMounted = true

    if (prevCodeLengthRef.current > 0 && prevCodeLengthRef.current !== children?.length) {
      isStreamingRef.current = true
    } else {
      isStreamingRef.current = false
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && isMounted) {
        updateShowExpandButton()
        observer.disconnect()
      }
    })

    observer.observe(codeElement)

    return () => {
      prevCodeLengthRef.current = children?.length || 0
      isMounted = false
      observer.disconnect()
    }
  }, [children, updateShowExpandButton])

  return (
    <CodeViewContainer
      ref={codeContentRef}
      isShowLineNumbers={codeShowLineNumbers}
      isUnwrapped={isUnwrapped}
      isCodeWrappable={codeWrappable}
      style={{
        border: '0.5px solid var(--color-code-background)',
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        marginTop: 0,
        position: 'relative',
        fontSize: fontSize - 1,
        maxHeight: codeCollapsible && !isExpanded ? '350px' : 'none',
        overflow: codeCollapsible && !isExpanded ? 'auto' : 'visible'
      }}>
      {tokens.length > 0 ? (
        <ShikiTokensRenderer language={language} tokens={tokens} />
      ) : (
        <div style={{ opacity: 0.1 }}>{children}</div>
      )}
    </CodeViewContainer>
  )
}

/**
 * 渲染 Shiki 高亮后的 tokens
 */
const ShikiTokensRenderer: React.FC<{ language: string; tokens: ThemedToken[] }> = memo(({ language, tokens }) => {
  const { getShikiPreProperties } = useCodeStyle()
  const rendererRef = useRef<HTMLPreElement>(null)

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

  // 将 tokens 转换为行
  const lines = useMemo(() => {
    if (tokens.length === 0) return []

    const result: ThemedToken[][] = [[]]
    let currentLine = 0

    for (const token of tokens) {
      const content = token.content
      const newLines = content.split('\n')

      if (newLines.length === 1) {
        // 没有换行，直接添加到当前行
        result[currentLine].push(token)
      } else {
        // 处理第一部分（当前行的结尾）
        if (newLines[0]) {
          const firstToken = { ...token, content: newLines[0] }
          result[currentLine].push(firstToken)
        }

        // 处理中间行
        for (let i = 1; i < newLines.length - 1; i++) {
          currentLine++
          result[currentLine] = []
          if (newLines[i]) {
            const midToken = { ...token, content: newLines[i] }
            result[currentLine].push(midToken)
          }
        }

        // 处理最后一部分（新行的开始）
        if (newLines.length > 1) {
          currentLine++
          result[currentLine] = []
          if (newLines[newLines.length - 1]) {
            const lastToken = { ...token, content: newLines[newLines.length - 1] }
            result[currentLine].push(lastToken)
          }
        }
      }
    }

    return result
  }, [tokens])

  return (
    <pre ref={rendererRef}>
      <code>
        {lines.map((lineTokens, lineIndex) => (
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
})

const CodeViewContainer = styled.div<{
  isShowLineNumbers: boolean
  isUnwrapped: boolean
  isCodeWrappable: boolean
}>`
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
