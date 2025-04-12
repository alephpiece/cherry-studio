import { useCodeStyle } from '@renderer/context/CodeStyleProvider'
import React, { createContext, use, useCallback, useEffect, useRef, useState } from 'react'

type StreamController = ReadableStreamDefaultController<string>

interface CodeStreamContextType {
  tokenStream: ReadableStream<any> | null
  sendToStream: (content: string) => void
  isInitialized: boolean
}

const defaultContext: CodeStreamContextType = {
  tokenStream: null,
  sendToStream: () => {},
  isInitialized: false
}

const CodeStreamContext = createContext<CodeStreamContextType>(defaultContext)

interface CodeStreamProviderProps {
  language: string
  children: React.ReactNode
}

/**
 * Stream provider，负责创建和管理 stream 的生命周期
 *
 * 用它来避免在同一个组件里管理和消费 stream，不然容易出问题。
 */
export const CodeStreamProvider = ({ language, children }: CodeStreamProviderProps) => {
  const { createTransformStream } = useCodeStyle()
  const [tokenStream, setTokenStream] = useState<ReadableStream<any> | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const controllerRef = useRef<StreamController | null>(null)

  // 安全地关闭流控制器
  const safelyCloseController = useCallback(() => {
    if (!controllerRef.current) return

    try {
      controllerRef.current.close()
    } catch (e) {
      // 无法关闭流控制器，说明我们的代码高亮服务有问题，用户是解决不了的
      console.log('Internal error:', e)
    } finally {
      controllerRef.current = null
    }
  }, [])

  // 向流发送内容
  const sendToStream = useCallback((content: string) => {
    if (!controllerRef.current || !content) return

    try {
      controllerRef.current.enqueue(content)
    } catch (error) {
      console.error('Failed to send content to stream:', error)
    }
  }, [])

  // 当语言变化时初始化/重置流
  useEffect(() => {
    // 清理旧的流
    safelyCloseController()
    setIsInitialized(false)
    setTokenStream(null)

    // 创建新的流
    const initializeStream = async () => {
      const textStream = new ReadableStream<string>({
        start(controller) {
          controllerRef.current = controller
        }
      })

      try {
        // 创建转换流
        const transformStream = await createTransformStream(language)
        const newTokenStream = textStream.pipeThrough(transformStream)

        // 更新状态
        setTokenStream(newTokenStream)
        setIsInitialized(true)
      } catch (error) {
        // 无法初始化流，说明我们的代码高亮服务有问题，用户是解决不了的
        console.error('Failed to initialize stream:', error)
      }
    }

    initializeStream()

    return () => safelyCloseController()
  }, [language, createTransformStream, safelyCloseController])

  const contextValue = {
    tokenStream,
    sendToStream,
    isInitialized
  }

  return <CodeStreamContext value={contextValue}>{children}</CodeStreamContext>
}

export const useStreamContext = () => use(CodeStreamContext)
