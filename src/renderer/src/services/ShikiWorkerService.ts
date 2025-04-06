import ShikiWorker from '../workers/shiki.worker?worker'
import { CodeCacheService } from './CodeCacheService'

interface PendingRequest {
  resolvers: Array<(html: string) => void>
  code: string
  timeoutId?: ReturnType<typeof setTimeout>
}

class ShikiWorkerService {
  private worker: Worker | null = null
  private pendingRequests = new Map<string, PendingRequest>()
  private isInitialized = false
  private initPromise: Promise<void> | null = null
  private resolveInit?: () => void

  constructor() {
    this.initWorker()
  }

  private initWorker() {
    if (typeof Worker === 'undefined') {
      console.warn('[ShikiWorker] Web Worker is not supported in this environment')
      return
    }

    try {
      this.worker = new ShikiWorker()

      this.worker.onmessage = (e) => {
        const { type, result, cacheKey } = e.data

        if (type === 'init') {
          this.isInitialized = true
          this.resolveInit?.()
        }

        if (type === 'highlight' && cacheKey && this.pendingRequests.has(cacheKey)) {
          const pendingRequest = this.pendingRequests.get(cacheKey)!

          // 清除请求超时计时器
          if (pendingRequest.timeoutId) {
            clearTimeout(pendingRequest.timeoutId)
          }

          if (result.success && result.html) {
            CodeCacheService.setCachedResult(cacheKey, result.html, result.codeLength || 0)

            // 调用所有等待的解析器
            pendingRequest.resolvers.forEach((resolver) => resolver(result.html))
          } else {
            console.warn(`[ShikiWorker] Failed to highlight:`, result.error || 'Unknown error')

            // 错误情况下也需要通知所有等待的解析器
            const escapedCode = pendingRequest.code?.replace(/[<>]/g, (char) => ({ '<': '&lt;', '>': '&gt;' })[char]!)
            const fallbackHtml = `<pre style="padding: 10px"><code>${escapedCode}</code></pre>`
            pendingRequest.resolvers.forEach((resolver) => resolver(fallbackHtml))
          }

          this.pendingRequests.delete(cacheKey)
        }
      }

      this.initPromise = new Promise((resolve) => {
        this.resolveInit = resolve

        // 初始化 worker，加载少量语言和主题
        this.worker?.postMessage({
          type: 'init',
          payload: {
            languages: ['javascript', 'typescript', 'python', 'java', 'markdown'],
            themes: ['one-light', 'material-theme-darker']
          }
        })
      })
    } catch (error) {
      this.worker = null
    }
  }

  /**
   * 执行代码高亮。enableCache 为 true 并且用户启用了缓存功能时，缓存才会真正生效。
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

    // 如果没有 Worker 支持，返回简单格式化
    if (!this.worker) {
      const escapedCode = code?.replace(/[<>]/g, (char) => ({ '<': '&lt;', '>': '&gt;' })[char]!)
      return `<pre style="padding: 10px"><code>${escapedCode}</code></pre>`
    }

    // 确保 Worker 已初始化
    if (!this.isInitialized && this.initPromise) {
      await this.initPromise
    }

    return new Promise((resolve) => {
      // 检查是否已有相同请求，有则合并
      if (this.pendingRequests.has(cacheKey)) {
        const pendingRequest = this.pendingRequests.get(cacheKey)!
        pendingRequest.resolvers.push(resolve)
      } else {
        // 设置整个请求的超时处理
        const timeoutId = setTimeout(() => {
          if (this.pendingRequests.has(cacheKey)) {
            const pendingRequest = this.pendingRequests.get(cacheKey)!
            const escapedCode = code?.replace(/[<>]/g, (char) => ({ '<': '&lt;', '>': '&gt;' })[char]!)
            const fallbackHtml = `<pre style="padding: 10px"><code>${escapedCode}</code></pre>`

            // 通知所有等待的解析器
            pendingRequest.resolvers.forEach((r) => r(fallbackHtml))
            this.pendingRequests.delete(cacheKey)
          }
        }, 10000) // 10秒超时

        // 新请求，创建条目并发送到 Worker
        this.pendingRequests.set(cacheKey, {
          resolvers: [resolve],
          code,
          timeoutId
        })

        this.worker?.postMessage({
          type: 'highlight',
          payload: {
            code,
            language,
            theme,
            cacheKey,
            codeLength: code.length
          }
        })
      }
    })
  }

  dispose() {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    // 清理所有超时计时器
    this.pendingRequests.forEach((request) => {
      if (request.timeoutId) {
        clearTimeout(request.timeoutId)
      }
    })

    this.pendingRequests.clear()
  }
}

export const shikiWorker = new ShikiWorkerService()
