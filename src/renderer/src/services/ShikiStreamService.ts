import type { HighlighterCore, ThemedToken } from 'shiki'

import { CodeCacheService } from './CodeCacheService'
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
 * 支持高亮代码缓存和流式高亮。
 */
class ShikiStreamService {
  // 默认配置
  private static readonly DEFAULT_LANGUAGES = ['javascript', 'typescript', 'python', 'java', 'markdown']
  private static readonly DEFAULT_THEMES = ['one-light', 'material-theme-darker']

  private highlighter: HighlighterCore | null = null
  private highlighterInitPromise: Promise<void> | null = null
  private isInitialized: boolean = false

  // 每个调用者都有自己的 tokenizer 实例
  private tokenizerMap = new Map<string, ShikiStreamTokenizer>()

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
   * @deprecated 请使用 highlightCodeChunk。
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
   * 高亮代码 chunk，返回本次高亮的所有 ThemedToken 行
   *
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
    try {
      const tokenizer = await this.getOrCreateTokenizer(callerId, language, theme)

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
   * 清理特定调用者的 tokenizer
   * @param callerId 调用者ID
   */
  cleanupTokenizer(callerId: string): void {
    if (this.tokenizerMap.has(callerId)) {
      const tokenizer = this.tokenizerMap.get(callerId)!
      tokenizer.clear()
      this.tokenizerMap.delete(callerId)
    }
  }

  /**
   * 获取或创建 tokenizer
   * @param callerId 调用者ID
   * @param language 语言
   * @param theme 主题
   * @returns tokenizer 实例
   */
  private async getOrCreateTokenizer(callerId: string, language: string, theme: string): Promise<ShikiStreamTokenizer> {
    // 如果已存在，直接返回
    if (this.tokenizerMap.has(callerId)) {
      return this.tokenizerMap.get(callerId)!
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
    this.tokenizerMap.set(callerId, tokenizer)

    return tokenizer
  }

  dispose() {
    // 清理所有 tokenizer
    for (const callerId of this.tokenizerMap.keys()) {
      this.cleanupTokenizer(callerId)
    }

    this.highlighter = null
    this.isInitialized = false
    this.highlighterInitPromise = null
  }
}

export const shikiStreamService = new ShikiStreamService()
