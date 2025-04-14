import { LRUCache } from 'lru-cache'
import type { HighlighterCore, ThemedToken } from 'shiki'

import ShikiStreamWorker from '../workers/shiki-stream.worker?worker'
import { ShikiStreamTokenizer, ShikiStreamTokenizerOptions } from './ShikiStreamTokenizer'

export type ShikiPreProperties = {
  class: string
  style: string
  tabindex: number
}

/**
 * 代码 chunk 高亮结果
 *
 * @param lines 所有高亮行（包括稳定和不稳定）
 * @param recall 需要撤回的行数
 */
export interface HighlightChunkResult {
  lines: ThemedToken[][]
  recall: number
}

/**
 * Shiki 代码高亮服务
 *
 * - 支持流式代码高亮。
 * - 优先使用 Worker 处理高亮请求。
 */
class ShikiStreamService {
  // 默认配置
  private static readonly DEFAULT_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'markdown']
  private static readonly DEFAULT_THEMES = ['one-light', 'material-theme-darker']

  // 主线程 highlighter 和 tokenizers
  private highlighter: HighlighterCore | null = null
  private highlighterInitPromise: Promise<void> | null = null
  private isInitialized: boolean = false

  // 保存以 callerId-language-theme 为键的 tokenizer map
  private tokenizerCache = new LRUCache<string, ShikiStreamTokenizer>({
    max: 100, // 最大缓存数量
    ttl: 1000 * 60 * 30 // 30分钟过期时间
  })

  // Worker 相关资源
  private worker: Worker | null = null
  private workerInitialized = false
  private pendingRequests = new Map<
    number,
    {
      resolve: (value: any) => void
      reject: (reason?: any) => void
    }
  >()
  private requestId = 0

  // 降级策略相关变量，用于记录调用 worker 失败过的 callerId
  private workerDegradationCache = new LRUCache<string, boolean>({
    max: 1000, // 最大记录数量
    ttl: 1000 * 60 * 60 * 12 // 12小时自动过期
  })

  constructor() {
    // 延迟初始化
  }

  /**
   * 初始化 Worker
   */
  private initWorker(): Promise<void> {
    if (typeof Worker === 'undefined') {
      return Promise.resolve()
    }

    // 如果已经初始化，直接返回
    if (this.worker && this.workerInitialized) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      try {
        this.worker = new ShikiStreamWorker()

        // 设置消息处理器
        this.worker.onmessage = (event) => {
          const { id, type, result, error } = event.data

          // 查找对应的请求
          const pendingRequest = this.pendingRequests.get(id)
          if (!pendingRequest) return

          this.pendingRequests.delete(id)

          if (type === 'error') {
            pendingRequest.reject(new Error(error))
          } else if (type === 'init-result') {
            this.workerInitialized = true
            pendingRequest.resolve({ success: true })
            resolve()
          } else {
            pendingRequest.resolve(result)
          }
        }

        // 初始化 worker
        this.sendWorkerMessage({
          type: 'init',
          languages: ShikiStreamService.DEFAULT_LANGUAGES,
          themes: ShikiStreamService.DEFAULT_THEMES
        }).catch((error) => {
          console.error('Failed to initialize worker:', error)
          this.worker = null
          this.workerInitialized = false
          reject(error)
        })
      } catch (error) {
        console.error('Failed to create worker:', error)
        this.worker = null
        reject(error)
      }
    })
  }

  /**
   * 向 Worker 发送消息并等待回复
   */
  private sendWorkerMessage(message: any): Promise<any> {
    if (!this.worker) {
      return Promise.reject(new Error('Worker not available'))
    }

    const id = this.requestId++
    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject })

      // 根据操作类型设置不同的超时时间
      const getTimeoutForMessageType = (type: string): number => {
        switch (type) {
          case 'init':
            return 60000 // 初始化操作允许较长时间 (60秒)
          case 'highlight':
            return 30000 // 高亮操作 (30秒)
          case 'cleanup':
          case 'dispose':
          default:
            return 15000 // 其他操作 (15秒)
        }
      }

      const timeout = getTimeoutForMessageType(message.type)

      // 设置超时处理
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)

          // 如果是高亮操作超时，说明代码块太长，记录callerId以便降级
          if (message.type === 'highlight' && message.callerId) {
            this.workerDegradationCache.set(message.callerId, true)
            reject(new Error(`Worker ${message.type} request timeout for callerId ${message.callerId}`))
          } else {
            reject(new Error(`Worker ${message.type} request timeout`))
          }
        }
      }, timeout)
    })

    this.worker.postMessage({ id, ...message })
    return promise
  }

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
      try {
        const languageImportFn = shiki.bundledLanguages[language]
        const langData = await languageImportFn()
        await this.highlighter.loadLanguage(langData)
      } catch (error) {
        // 回退到 text
        console.debug(`Failed to load language '${language}', falling back to 'text':`, error)
        await this.highlighter.loadLanguage('text')
        actualLanguage = 'text'
      }
    }

    // 加载主题
    if (!this.highlighter.getLoadedThemes().includes(theme)) {
      try {
        const themeImportFn = shiki.bundledThemes[theme]
        const themeData = await themeImportFn()
        await this.highlighter.loadTheme(themeData)
      } catch (error) {
        // 回退到 one-light
        console.debug(`Failed to load theme '${theme}', falling back to 'one-light':`, error)
        const oneLightTheme = await shiki.bundledThemes['one-light']()
        await this.highlighter.loadTheme(oneLightTheme)
        actualTheme = 'one-light'
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
   * 高亮代码 chunk，返回本次高亮的所有 ThemedToken 行
   *
   * 优先使用 Worker 处理，失败时回退到主线程处理。
   * 调用者需要自行处理撤回。
   * @param chunk 代码内容
   * @param language 语言
   * @param theme 主题
   * @param callerId 调用者ID，用于标识不同的组件实例
   * @returns ThemedToken 行
   */
  async highlightCodeChunk(
    chunk: string,
    language: string,
    theme: string,
    callerId: string
  ): Promise<HighlightChunkResult> {
    // 检查callerId是否需要降级处理
    if (this.workerDegradationCache.has(callerId)) {
      return this.highlightWithMainThread(chunk, language, theme, callerId)
    }

    // 初始化 worker
    if (!this.worker) {
      await this.initWorker().catch((error) => {
        console.warn('Failed to initialize worker, falling back to main thread:', error)
      })
    }

    // 如果 Worker 可用，优先使用 Worker 处理
    if (this.worker && this.workerInitialized) {
      try {
        const result = await this.sendWorkerMessage({
          type: 'highlight',
          callerId,
          chunk,
          language,
          theme
        })
        return result
      } catch (error) {
        // Worker 处理失败，记录callerId并永久降级到主线程
        // FIXME: 这种情况如果出现，流式高亮语法状态就会丢失，目前用降级策略来处理
        this.workerDegradationCache.set(callerId, true)
        console.error(
          `Worker highlight failed for callerId ${callerId}, permanently falling back to main thread:`,
          error
        )
      }
    }

    // 使用主线程处理
    return this.highlightWithMainThread(chunk, language, theme, callerId)
  }

  /**
   * 使用主线程处理代码高亮
   * @param chunk 代码内容
   * @param language 语言
   * @param theme 主题
   * @param callerId 调用者ID
   * @returns 高亮结果
   */
  private async highlightWithMainThread(
    chunk: string,
    language: string,
    theme: string,
    callerId: string
  ): Promise<HighlightChunkResult> {
    try {
      const tokenizer = await this.getStreamTokenizer(callerId, language, theme)

      const result = await tokenizer.enqueue(chunk)

      // 合并稳定和不稳定的行作为本次高亮的所有行
      return {
        lines: [...result.stable, ...result.unstable],
        recall: result.recall
      }
    } catch (error) {
      console.error('Failed to highlight code chunk:', error)

      // 提供简单的 fallback
      const fallbackToken: ThemedToken = { content: chunk || '', color: '#000000', offset: 0 }
      return {
        lines: [[fallbackToken]],
        recall: 0
      }
    }
  }

  /**
   * 清理特定调用者的 tokenizers
   * @param callerId 调用者ID
   */
  cleanupTokenizers(callerId: string): void {
    // 先尝试清理 Worker 中的 tokenizers
    if (this.worker && this.workerInitialized) {
      this.sendWorkerMessage({
        type: 'cleanup',
        callerId
      }).catch((error) => {
        console.error('Failed to cleanup worker tokenizer:', error)
      })
    }

    // 再清理主线程中的 tokenizers，移除所有以 callerId 开头的缓存项
    for (const key of this.tokenizerCache.keys()) {
      if (key.startsWith(`${callerId}-`)) {
        const tokenizer = this.tokenizerCache.get(key)!
        tokenizer.clear()
        this.tokenizerCache.delete(key)
      }
    }
  }

  /**
   * 获取或创建 tokenizer
   * @param callerId 调用者ID
   * @param language 语言
   * @param theme 主题
   * @returns tokenizer 实例
   */
  private async getStreamTokenizer(callerId: string, language: string, theme: string): Promise<ShikiStreamTokenizer> {
    // 创建复合键
    const cacheKey = `${callerId}-${language}-${theme}`

    // 如果已存在，直接返回
    if (this.tokenizerCache.has(cacheKey)) {
      return this.tokenizerCache.get(cacheKey)!
    }

    // 确保 highlighter 已配置
    const { actualLanguage, actualTheme } = await this.ensureHighlighterConfigured(language, theme)

    if (!this.highlighter) {
      throw new Error('Highlighter not initialized')
    }

    // 创建新的 tokenizer
    const options: ShikiStreamTokenizerOptions = {
      highlighter: this.highlighter,
      lang: actualLanguage,
      theme: actualTheme
    }

    const tokenizer = new ShikiStreamTokenizer(options)
    this.tokenizerCache.set(cacheKey, tokenizer)

    return tokenizer
  }

  /**
   * 销毁所有资源
   */
  dispose() {
    // 清理 Worker 资源
    if (this.worker) {
      try {
        this.sendWorkerMessage({ type: 'dispose' }).catch((error) => {
          console.error('Failed to dispose worker:', error)
        })
        this.worker.terminate()
      } catch (error) {
        console.error('Failed to terminate worker:', error)
      }
      this.worker = null
      this.workerInitialized = false
      this.pendingRequests.clear()
    }

    // 清理主线程的所有 tokenizers
    for (const key of this.tokenizerCache.keys()) {
      const tokenizer = this.tokenizerCache.get(key)!
      tokenizer.clear()
    }
    this.tokenizerCache.clear()

    this.highlighter = null
    this.isInitialized = false
    this.highlighterInitPromise = null
  }
}

export const shikiStreamService = new ShikiStreamService()
