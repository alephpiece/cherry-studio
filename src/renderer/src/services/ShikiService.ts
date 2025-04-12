import ShikiWorker from '../workers/shiki.worker?worker'
import { CodeCacheService } from './CodeCacheService'

interface PendingRequest {
  resolvers: Array<(html: string) => void>
  code: string
  enableCache: boolean
  timeoutId?: ReturnType<typeof setTimeout>
}

// 初始化状态枚举
enum InitState {
  NotStarted,
  Initializing,
  Initialized,
  Failed
}

/**
 * Shiki 代码高亮服务
 *
 * 可以选择使用 worker highlighter 或者主线程 highlighter。
 * - Worker highlighter 适用于历史消息，避免主线程阻塞；
 * - 主线程 highlighter 适用于当前消息，性能更高。
 *
 * 回退路径:
 * - Web Worker highlighter（如果启用）
 * - 主线程 highlighter
 * - 没有高亮的代码
 *
 * 支持重复请求合并
 * 支持高亮代码缓存
 * */
class ShikiService {
  // 默认配置
  private static readonly DEFAULT_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'markdown']
  private static readonly DEFAULT_THEMES = ['one-light', 'material-theme-darker']
  private static readonly REQUEST_TIMEOUT_MS = 60000 // 1分钟超时

  private worker: Worker | null = null // Worker highlighter
  private highlighter: any = null // 主线程 highlighter
  private pendingRequests = new Map<string, PendingRequest>()

  // 使用枚举跟踪初始化状态
  private workerState: InitState = InitState.NotStarted
  private highlighterState: InitState = InitState.NotStarted

  // 初始化 Promise
  private workerInitPromise: Promise<void> | null = null
  private highlighterInitPromise: Promise<void> | null = null

  private resolveWorkerInit?: () => void

  /**
   * 根据需要初始化服务
   * @param enableWorker 是否启用 Worker
   */
  private async ensureInitialized(enableWorker: boolean): Promise<void> {
    const promises: Promise<void>[] = []

    // 如果需要 worker 且未初始化
    if (enableWorker && this.workerState === InitState.NotStarted) {
      promises.push(
        this.initWorker().catch((error) => {
          console.warn('[ShikiService] Worker initialization failed:', error)
        })
      )
    }

    // 如果需要主线程 highlighter (worker不可用或不启用worker)
    if (
      (!enableWorker || this.workerState === InitState.Failed || this.workerState === InitState.NotStarted) &&
      this.highlighterState === InitState.NotStarted
    ) {
      promises.push(
        this.initMainThreadHighlighter().catch((error) => {
          console.error('[ShikiService] Failed to initialize shiki in main thread:', error)
        })
      )
    }

    // 等待所有需要的初始化完成
    if (promises.length > 0) {
      await Promise.all(promises)
    }
  }

  /**
   * 初始化Web Worker
   */
  private async initWorker(): Promise<void> {
    if (this.workerState === InitState.Initialized || this.workerState === InitState.Initializing) {
      return this.workerInitPromise || Promise.resolve()
    }

    this.workerState = InitState.Initializing

    if (typeof Worker === 'undefined') {
      this.workerState = InitState.Failed
      return Promise.reject(new Error('Web Worker is not supported'))
    }

    this.worker = new ShikiWorker()

    this.worker.onmessage = (e) => {
      const { type, result, cacheKey } = e.data

      if (type === 'init') {
        this.workerState = InitState.Initialized
        this.resolveWorkerInit?.()
      }

      if (type === 'highlight' && cacheKey && this.pendingRequests.has(cacheKey)) {
        if (result.success && result.html) {
          this.resolveRequest(cacheKey, result.html, result.codeLength)
        } else {
          console.warn(`[ShikiService] Failed to highlight:`, result.error || 'Unknown error')
          this.rejectRequest(cacheKey)
        }
      }
    }

    this.workerInitPromise = new Promise((resolve) => {
      this.resolveWorkerInit = resolve

      this.worker?.postMessage({
        type: 'init',
        payload: {
          languages: ShikiService.DEFAULT_LANGUAGES,
          themes: ShikiService.DEFAULT_THEMES
        }
      })
    })

    return this.workerInitPromise
  }

  /**
   * 初始化主线程 highlighter
   */
  private async initMainThreadHighlighter(): Promise<void> {
    if (this.highlighterState === InitState.Initialized || this.highlighterState === InitState.Initializing) {
      return this.highlighterInitPromise || Promise.resolve()
    }

    this.highlighterState = InitState.Initializing

    this.highlighterInitPromise = (async () => {
      try {
        const { createHighlighter } = await import('shiki')

        this.highlighter = await createHighlighter({
          langs: ShikiService.DEFAULT_LANGUAGES,
          themes: ShikiService.DEFAULT_THEMES
        })

        this.highlighterState = InitState.Initialized
      } catch (error) {
        this.highlighterState = InitState.Failed
        throw error
      } finally {
        if (this.highlighterState !== InitState.Initialized) {
          this.highlighterState = InitState.Failed
        }
      }
    })()

    return this.highlighterInitPromise
  }

  /**
   * 执行代码高亮。enableCache 为 true 并且用户启用了缓存功能时，缓存才会真正生效。
   * @param code 代码
   * @param language 语言
   * @param theme 主题
   * @param enableCache 是否启用缓存
   * @param enableWorker 是否启用 worker
   * @returns 高亮后的代码
   */
  async highlightCode(
    code: string,
    language: string,
    theme: string,
    enableCache: boolean,
    enableWorker: boolean = true
  ): Promise<string> {
    if (!code) return ''

    // 检查缓存
    const cacheKey = CodeCacheService.generateCacheKey(code, language, theme)
    if (enableCache) {
      const cached = CodeCacheService.getCachedResult(cacheKey)
      if (cached) return cached
    }

    // 确保需要的组件已初始化
    await this.ensureInitialized(enableWorker)

    return new Promise((resolve) => {
      // 注册代码高亮请求
      this.registerRequest(cacheKey, code, enableCache, resolve)

      // 根据可用组件和参数选择高亮方式
      const canUseWorker = enableWorker && this.workerState === InitState.Initialized && this.worker
      const canUseHighlighter = this.highlighterState === InitState.Initialized && this.highlighter

      if (canUseWorker) {
        this.worker!.postMessage({
          type: 'highlight',
          payload: {
            code,
            language,
            theme,
            cacheKey,
            codeLength: code.length
          }
        })
      } else if (canUseHighlighter) {
        this.processInMainThread(code, language, theme, cacheKey)
      } else {
        // 两种高亮器都不可用，使用 fallback
        this.rejectRequest(cacheKey)
      }
    })
  }

  // 主线程执行代码高亮
  private async processInMainThread(code: string, language: string, theme: string, cacheKey: string) {
    if (!this.pendingRequests.has(cacheKey)) return

    try {
      const shiki = await import('shiki')

      // 加载语言
      if (this.highlighter && !this.highlighter.getLoadedLanguages().includes(language)) {
        const languageImportFn = shiki.bundledLanguages[language]
        if (languageImportFn) {
          await this.highlighter.loadLanguage(await languageImportFn())
        }
      }

      // 加载主题
      if (this.highlighter && !this.highlighter.getLoadedThemes().includes(theme)) {
        const themeImportFn = shiki.bundledThemes[theme]
        if (themeImportFn) {
          await this.highlighter.loadTheme(await themeImportFn())
        }
      }

      const html = this.highlighter.codeToHtml(code, {
        lang: language,
        theme: theme
      })

      this.resolveRequest(cacheKey, html, code.length)
    } catch (error) {
      this.rejectRequest(cacheKey)
    }
  }

  /**
   * 注册新的高亮请求
   */
  private registerRequest(
    cacheKey: string,
    code: string,
    enableCache: boolean,
    resolver: (html: string) => void
  ): void {
    // 合并相同请求，减少不必要的计算
    if (this.pendingRequests.has(cacheKey)) {
      const pendingRequest = this.pendingRequests.get(cacheKey)!
      pendingRequest.resolvers.push(resolver)
      return
    }

    // 设置整个请求的超时处理
    const timeoutId = setTimeout(() => {
      this.rejectRequest(cacheKey)
    }, ShikiService.REQUEST_TIMEOUT_MS)

    // 为新请求创建条目
    this.pendingRequests.set(cacheKey, {
      resolvers: [resolver],
      code,
      enableCache,
      timeoutId
    })
  }

  /**
   * 处理高亮成功的情况
   */
  private resolveRequest(cacheKey: string, html: string, codeLength?: number): void {
    if (!this.pendingRequests.has(cacheKey)) return

    const pendingRequest = this.pendingRequests.get(cacheKey)!

    if (pendingRequest.timeoutId) {
      clearTimeout(pendingRequest.timeoutId)
    }

    if (pendingRequest.enableCache) {
      CodeCacheService.setCachedResult(cacheKey, html, codeLength || pendingRequest.code.length)
    }

    pendingRequest.resolvers.forEach((resolver) => resolver(html))
    this.pendingRequests.delete(cacheKey)
  }

  /**
   * 处理高亮失败的情况
   */
  private rejectRequest(cacheKey: string): void {
    if (!this.pendingRequests.has(cacheKey)) return

    const pendingRequest = this.pendingRequests.get(cacheKey)!

    if (pendingRequest.timeoutId) {
      clearTimeout(pendingRequest.timeoutId)
    }

    // 提供简单的fallback
    const escapedCode = pendingRequest.code.replace(/[<>]/g, (char) => ({ '<': '&lt;', '>': '&gt;' })[char]!)
    const fallbackHtml = `<pre style="padding: 10px"><code>${escapedCode}</code></pre>`

    pendingRequest.resolvers.forEach((resolver) => resolver(fallbackHtml))
    this.pendingRequests.delete(cacheKey)
  }

  dispose() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    this.highlighter = null
    this.workerState = InitState.NotStarted
    this.highlighterState = InitState.NotStarted
    this.workerInitPromise = null
    this.highlighterInitPromise = null

    this.pendingRequests.forEach((request) => {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId)
      }
    })

    this.pendingRequests.clear()
  }
}

export const shikiService = new ShikiService()
