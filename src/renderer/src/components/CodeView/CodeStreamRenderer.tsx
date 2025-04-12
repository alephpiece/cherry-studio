import { useCallback, useEffect, useMemo, useRef } from 'react'
import { ShikiStreamRenderer } from 'shiki-stream/react'

import { useStreamContext } from './CodeStreamContext'

interface SourceStreamRendererProps {
  children: string
}

/**
 * 源码流渲染器组件
 * 合并了内容管理和渲染功能，同时处理代码内容更新和高亮显示
 */
const CodeStreamRenderer = ({ children }: SourceStreamRendererProps) => {
  const { tokenStream, sendToStream, isInitialized } = useStreamContext()
  const previousLengthRef = useRef<number>(0)

  // 处理尾部空白字符
  const safeCodeString = useMemo(() => {
    return typeof children === 'string' ? children.trimEnd() : ''
  }, [children])

  // 发送初始内容或增量内容
  const handleContentUpdate = useCallback(() => {
    const codeStr = safeCodeString

    if (!isInitialized || codeStr === '') return

    try {
      if (previousLengthRef.current === 0) {
        // 首次发送全部内容
        sendToStream(codeStr)
        previousLengthRef.current = codeStr.length
      } else if (codeStr.length > previousLengthRef.current) {
        // 只发送新增内容
        const newContent = codeStr.slice(previousLengthRef.current)
        if (newContent.length > 0) {
          sendToStream(newContent)
          previousLengthRef.current += newContent.length
        }
      } else if (codeStr.length < previousLengthRef.current) {
        // 内容减少，重新发送全部内容
        sendToStream(codeStr)
        previousLengthRef.current = codeStr.length
      }
    } catch (error) {
      console.error('Failed to handle content update:', error)
    }
  }, [safeCodeString, sendToStream, isInitialized])

  // 当内容变化或流初始化完成时更新内容
  useEffect(() => {
    handleContentUpdate()
  }, [safeCodeString, isInitialized, handleContentUpdate])

  // 重置内容长度引用
  useEffect(() => {
    if (!isInitialized) {
      previousLengthRef.current = 0
    }
  }, [isInitialized])

  // 未初始化或者没有流，显示原始内容
  if (!isInitialized || !tokenStream) {
    return <div>{children}</div>
  }

  return <ShikiStreamRenderer stream={tokenStream} />
}

export default CodeStreamRenderer
