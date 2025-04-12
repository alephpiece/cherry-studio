import type { HighlighterCore } from 'shiki'
import { CodeToTokenTransformStream } from 'shiki-stream'

import { CodeCacheService } from './CodeCacheService'

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

  dispose() {
    this.highlighter = null
    this.isInitialized = false
    this.highlighterInitPromise = null
  }
}

export const shikiStreamService = new ShikiStreamService()
