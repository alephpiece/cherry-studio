import type { HighlighterCore, ThemedToken } from 'shiki'
import type { RecallToken } from 'shiki-stream'
import { CodeToTokenTransformStream } from 'shiki-stream'

import { CodeCacheService } from './CodeCacheService'

type StreamController = ReadableStreamDefaultController<string>
type TokenCallback = (tokens: ThemedToken[]) => void
type StreamRecord = {
  controller: StreamController | null
  stream: ReadableStream<ThemedToken | RecallToken> | null
  prevLength: number
  tokens: ThemedToken[]
  callbackMap: Map<string, TokenCallback>
}

export type ShikiPreProperties = {
  class: string
  style: string
  tabindex: number
}

/**
 * Shiki 代码高亮服务
 *
 * 支持高亮代码缓存和流式高亮。
 */
class ShikiStreamService {
  // 默认配置
  private static readonly DEFAULT_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'markdown']
  private static readonly DEFAULT_THEMES = ['one-light', 'material-theme-darker']

  private highlighter: HighlighterCore | null = null
  private highlighterInitPromise: Promise<void> | null = null
  private isInitialized: boolean = false
  private streamMap = new Map<string, StreamRecord>()

  /**
   * 初始化 highlighter
   */
  private async initHighlighter(): Promise<void> {
    if (this.isInitialized || this.highlighterInitPromise) {
      return this.highlighterInitPromise || Promise.resolve()
    }

    this.highlighterInitPromise = (async () => {
      try {
        const { createHighlighter } = await import('shiki')

        this.highlighter = await createHighlighter({
          langs: ShikiStreamService.DEFAULT_LANGUAGES,
          themes: ShikiStreamService.DEFAULT_THEMES
        })

        this.isInitialized = true
      } catch (error) {
        this.isInitialized = false
        throw error
      }
    })()

    return this.highlighterInitPromise
  }

  /**
   * 确保 highlighter 已配置
   * @param language 语言
   * @param theme 主题
   */
  private async ensureHighlighterConfigured(
    language: string,
    theme: string
  ): Promise<{ actualLanguage: string; actualTheme: string }> {
    // 确保 highlighter 已初始化
    if (!this.isInitialized) {
      await this.initHighlighter()
    }

    if (!this.highlighter) {
      throw new Error('Highlighter not initialized')
    }

    const shiki = await import('shiki')
    let actualLanguage = language
    let actualTheme = theme

    // 加载语言
    if (!this.highlighter.getLoadedLanguages().includes(language)) {
      const languageImportFn = shiki.bundledLanguages[language]
      if (languageImportFn) {
        await this.highlighter.loadLanguage(await languageImportFn())
      } else {
        await this.highlighter.loadLanguage('text')
        actualLanguage = 'text'
      }
    }

    // 加载主题
    if (!this.highlighter.getLoadedThemes().includes(theme)) {
      const themeImportFn = shiki.bundledThemes[theme]
      if (themeImportFn) {
        await this.highlighter.loadTheme(await themeImportFn())
      } else {
        await this.highlighter.loadTheme('none')
        actualTheme = 'none'
      }
    }

    return { actualLanguage, actualTheme }
  }

  /**
   * 获取 Shiki 的 pre 标签属性
   *
   * 跑一个简单的 hast 结果，从中提取 properties 属性。
   * 如果有更加稳定的方法可以替换。
   * @param language 语言
   * @param theme 主题
   * @returns pre 标签属性
   */
  async getShikiPreProperties(language: string, theme: string): Promise<ShikiPreProperties> {
    const { actualLanguage, actualTheme } = await this.ensureHighlighterConfigured(language, theme)

    if (!this.highlighter) {
      throw new Error('Highlighter not initialized')
    }

    const hast = this.highlighter.codeToHast('test', {
      lang: actualLanguage,
      theme: actualTheme
    })

    // @ts-ignore hack
    return hast.children[0].properties as ShikiPreProperties
  }

  /**
   * 执行一次性全量代码高亮。
   *
   * enableCache 为 true 并且用户启用了缓存功能时，缓存才会真正生效。
   * @param code 代码
   * @param language 语言
   * @param theme 主题
   * @param enableCache 是否启用缓存
   * @returns 高亮后的代码
   */
  async highlightCode(code: string, language: string, theme: string, enableCache: boolean): Promise<string> {
    if (!code) return ''

    // 检查缓存
    const cacheKey = CodeCacheService.generateCacheKey(code, language, theme)
    if (enableCache) {
      const cached = CodeCacheService.getCachedResult(cacheKey)
      if (cached) return cached
    }

    try {
      const { actualLanguage, actualTheme } = await this.ensureHighlighterConfigured(language, theme)

      if (!this.highlighter) {
        throw new Error('Highlighter not initialized')
      }

      const html = this.highlighter.codeToHtml(code, {
        lang: actualLanguage,
        theme: actualTheme
      })

      if (enableCache) {
        CodeCacheService.setCachedResult(cacheKey, html, code.length)
      }

      return html
    } catch (error) {
      // 提供简单的 fallback 保证万无一失
      const escapedCode = code.replace(/[<>]/g, (char) => ({ '<': '&lt;', '>': '&gt;' })[char]!)
      return `<pre style="padding: 10px"><code>${escapedCode}</code></pre>`
    }
  }

  /**
   * 流式转换器，用于流式代码高亮
   * @param language 语言
   * @param theme 主题
   * @returns 流式转换器
   */
  async createTransformStream(language: string, theme: string): Promise<CodeToTokenTransformStream> {
    try {
      const { actualLanguage, actualTheme } = await this.ensureHighlighterConfigured(language, theme)

      if (!this.highlighter) {
        throw new Error('Highlighter not initialized')
      }

      return new CodeToTokenTransformStream({
        highlighter: this.highlighter,
        lang: actualLanguage,
        theme: actualTheme,
        allowRecalls: true
      })
    } catch (error) {
      // 这里没法直接回退到非高亮代码
      // 只能创建一个简单的转换流，传递原始文本
      return new CodeToTokenTransformStream({
        highlighter: {
          // 最小实现
          codeToTokens: (code) => [[{ content: code, color: '#000000' }]]
        } as any,
        lang: 'text',
        theme: 'none'
      })
    }
  }

  /**
   * 创建代码高亮流 - 返回订阅者ID和注册回调的方法
   * @param code 代码内容
   * @param language 语言
   * @param theme 主题
   * @param callerId 调用者ID
   * @returns 订阅管理接口
   */
  async createHighlighterStream(
    code: string,
    language: string,
    theme: string,
    callerId: string
  ): Promise<{
    subscribe: (callback: TokenCallback) => string
    unsubscribe: (subscriberId: string) => void
  }> {
    // 初始化或获取流记录
    const record = await this.getOrCreateStreamRecord(callerId, language, theme)
    if (!record.controller)
      return {
        subscribe: () => '',
        unsubscribe: () => {}
      }

    // 处理代码内容
    const safeCode = typeof code === 'string' ? code.trimEnd() : ''
    if (safeCode !== '') {
      try {
        if (record.prevLength === 0) {
          // 首次发送全部内容
          record.controller.enqueue(safeCode)
        } else if (safeCode.length > record.prevLength) {
          // 只发送新增内容
          const newContent = safeCode.slice(record.prevLength)
          if (newContent.length > 0) {
            record.controller.enqueue(newContent)
          }
        } else if (safeCode.length < record.prevLength) {
          // 内容减少，重新发送全部内容
          record.controller.enqueue(safeCode)
        }
        record.prevLength = safeCode.length
      } catch (error) {
        console.error('Failed to send content to shiki stream:', error)
      }
    }

    // 返回订阅管理接口
    return {
      subscribe: (callback: TokenCallback) => {
        const subscriberId = crypto.randomUUID()
        record.callbackMap.set(subscriberId, callback)

        // 立即通知当前的令牌状态
        if (record.tokens.length > 0) {
          callback([...record.tokens])
        }

        return subscriberId
      },
      unsubscribe: (subscriberId: string) => {
        record.callbackMap.delete(subscriberId)
      }
    }
  }

  /**
   * 关闭特定流和清理资源
   * @param callerId 调用者ID
   */
  closeHighlighterStream(callerId: string): void {
    const record = this.streamMap.get(callerId)
    if (!record) return

    try {
      if (record.controller) {
        record.controller.close()
      }
    } catch (e) {
      console.error('Failed to close shiki stream:', e)
    } finally {
      this.streamMap.delete(callerId)
    }
  }

  /**
   * 获取或创建流记录
   * @param callerId 调用者ID
   * @param language 语言
   * @param theme 主题
   * @returns 流记录
   */
  private async getOrCreateStreamRecord(callerId: string, language: string, theme: string): Promise<StreamRecord> {
    if (this.streamMap.has(callerId)) {
      return this.streamMap.get(callerId)!
    }

    // 创建新的流和控制器
    const record: StreamRecord = {
      controller: null,
      stream: null,
      prevLength: 0,
      tokens: [],
      callbackMap: new Map()
    }

    const textStream = new ReadableStream<string>({
      start(controller) {
        record.controller = controller
      }
    })

    // 创建转换流
    const transformStream = await this.createTransformStream(language, theme)
    record.stream = textStream.pipeThrough(transformStream)

    // 处理流输出
    if (record.stream) {
      record.stream
        .pipeTo(
          new WritableStream({
            write(token) {
              if ('recall' in token) {
                // 撤回最后几个 token
                record.tokens = record.tokens.slice(0, -token.recall)
              } else {
                // 添加新 token
                record.tokens.push(token as ThemedToken)
              }

              // 通知所有订阅者
              record.callbackMap.forEach((callback) => {
                callback([...record.tokens])
              })
            },
            close() {
              console.debug('Shiki stream closed')
            },
            abort(error) {
              console.error('Shiki stream aborted:', error)
            }
          })
        )
        .catch((error) => {
          console.error('Failed to pipe token to shiki stream:', error)
        })
    }

    this.streamMap.set(callerId, record)
    return record
  }

  dispose() {
    // 关闭所有流
    for (const callerId of this.streamMap.keys()) {
      this.closeHighlighterStream(callerId)
    }

    this.highlighter = null
    this.isInitialized = false
    this.highlighterInitPromise = null
  }
}

export const shikiStreamService = new ShikiStreamService()
