/// <reference lib="webworker" />

import type { GrammarState, HighlighterCore, ThemedToken } from 'shiki'

// Worker 消息类型
type WorkerMessageType = 'init' | 'highlight' | 'cleanup' | 'dispose'

interface WorkerRequest {
  id: number
  type: WorkerMessageType
  callerId?: string
  chunk?: string
  language?: string
  theme?: string
  languages?: string[]
  themes?: string[]
}

interface WorkerResponse {
  id: number
  type: string
  result?: any
  error?: string
}

// ShikiStreamTokenizer 相关类型和实现
interface ShikiStreamTokenizerOptions {
  highlighter: HighlighterCore
  lang: string
  theme: string
}

interface ShikiStreamTokenizerEnqueueResult {
  recall: number
  stable: ThemedToken[][]
  unstable: ThemedToken[][]
}

interface HighlightChunkResult {
  lines: ThemedToken[][]
  recall: number
}

/**
 * Worker 版本的 ShikiStreamTokenizer
 */
class ShikiStreamTokenizer {
  public readonly options: ShikiStreamTokenizerOptions

  public linesStable: ThemedToken[][] = []
  public linesUnstable: ThemedToken[][] = []

  public lastUnstableCodeChunk: string = ''
  public lastStableGrammarState: GrammarState | undefined

  constructor(options: ShikiStreamTokenizerOptions) {
    this.options = options
  }

  /**
   * 使用 tokenizer 处理一个代码片段。
   */
  enqueue(chunk: string): ShikiStreamTokenizerEnqueueResult {
    const subTrunks = splitToSubTrunks(this.lastUnstableCodeChunk + chunk)

    const stable: ThemedToken[][] = []
    const unstable: ThemedToken[][] = []
    const recall = this.linesUnstable.length

    subTrunks.forEach((subTrunck, i) => {
      const isLastChunk = i === subTrunks.length - 1

      const result = this.options.highlighter.codeToTokens(subTrunck, {
        ...this.options,
        grammarState: this.lastStableGrammarState
      })

      if (!isLastChunk) {
        this.lastStableGrammarState = result.grammarState

        result.tokens.forEach((tokenLine) => {
          stable.push(tokenLine)
        })
      } else {
        unstable.push(result.tokens[0])
        this.lastUnstableCodeChunk = subTrunck
      }

      this.linesStable.push(...stable)
      this.linesUnstable = unstable
    })

    return {
      recall,
      stable,
      unstable
    }
  }

  clear(): void {
    this.linesStable = []
    this.linesUnstable = []
    this.lastUnstableCodeChunk = ''
    this.lastStableGrammarState = undefined
  }
}

function splitToSubTrunks(str: string) {
  const lastNewlineIndex = str.lastIndexOf('\n')
  if (lastNewlineIndex === -1) {
    return [str]
  }
  return [str.substring(0, lastNewlineIndex), str.substring(lastNewlineIndex + 1)]
}

// Worker 全局变量
let highlighter: HighlighterCore | null = null
const tokenizerMap = new Map<string, ShikiStreamTokenizer>()

// 初始化高亮器
async function initHighlighter(themes: string[], languages: string[]): Promise<void> {
  const { createHighlighter } = await import('shiki')
  highlighter = await createHighlighter({
    langs: languages,
    themes: themes
  })
}

// 确保语言和主题已加载
async function ensureLanguageAndThemeLoaded(
  language: string,
  theme: string
): Promise<{ actualLanguage: string; actualTheme: string }> {
  if (!highlighter) {
    throw new Error('Highlighter not initialized')
  }

  let actualLanguage = language
  let actualTheme = theme

  // 加载语言
  if (!highlighter.getLoadedLanguages().includes(language)) {
    const { bundledLanguages } = await import('shiki')
    const languageImportFn = bundledLanguages[language]
    if (languageImportFn) {
      await highlighter.loadLanguage(await languageImportFn())
    } else {
      await highlighter.loadLanguage('text')
      actualLanguage = 'text'
    }
  }

  // 加载主题
  if (!highlighter.getLoadedThemes().includes(theme)) {
    const { bundledThemes } = await import('shiki')
    const themeImportFn = bundledThemes[theme]
    if (themeImportFn) {
      await highlighter.loadTheme(await themeImportFn())
    } else {
      await highlighter.loadTheme('none')
      actualTheme = 'none'
    }
  }

  return { actualLanguage, actualTheme }
}

// 获取或创建 tokenizer
async function getOrCreateTokenizer(callerId: string, language: string, theme: string): Promise<ShikiStreamTokenizer> {
  // 如果已存在，直接返回
  if (tokenizerMap.has(callerId)) {
    return tokenizerMap.get(callerId)!
  }

  if (!highlighter) {
    throw new Error('Highlighter not initialized')
  }

  // 确保语言和主题已加载
  const { actualLanguage, actualTheme } = await ensureLanguageAndThemeLoaded(language, theme)

  // 创建新的 tokenizer
  const options: ShikiStreamTokenizerOptions = {
    highlighter,
    lang: actualLanguage,
    theme: actualTheme
  }

  const tokenizer = new ShikiStreamTokenizer(options)
  tokenizerMap.set(callerId, tokenizer)

  return tokenizer
}

// 高亮代码 chunk
async function highlightCodeChunk(
  callerId: string,
  chunk: string,
  language: string,
  theme: string
): Promise<HighlightChunkResult> {
  try {
    // 获取 tokenizer
    const tokenizer = await getOrCreateTokenizer(callerId, language, theme)

    // 处理代码 chunk
    const result = tokenizer.enqueue(chunk)

    // 返回结果
    return {
      lines: [...result.stable, ...result.unstable],
      recall: result.recall
    }
  } catch (error) {
    console.error('Worker failed to highlight code chunk:', error)

    // 提供简单的 fallback
    const fallbackToken: ThemedToken = { content: chunk || '', color: '#000000', offset: 0 }
    return {
      lines: [[fallbackToken]],
      recall: 0
    }
  }
}

// 清理特定调用者的 tokenizer
function cleanupTokenizer(callerId: string): void {
  if (tokenizerMap.has(callerId)) {
    const tokenizer = tokenizerMap.get(callerId)!
    tokenizer.clear()
    tokenizerMap.delete(callerId)
  }
}

// 清理所有资源
function disposeAll(): void {
  // 清理所有 tokenizer
  tokenizerMap.forEach((tokenizer) => tokenizer.clear())
  tokenizerMap.clear()

  // 清理 highlighter
  highlighter = null
}

// 定义 worker 上下文类型
declare const self: DedicatedWorkerGlobalScope

// 监听消息
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, type } = e.data

  try {
    switch (type) {
      case 'init':
        if (e.data.languages && e.data.themes) {
          await initHighlighter(e.data.themes, e.data.languages)
          self.postMessage({ id, type: 'init-result', result: { success: true } } as WorkerResponse)
        } else {
          throw new Error('Missing required init parameters')
        }
        break

      case 'highlight':
        if (!highlighter) {
          throw new Error('Highlighter not initialized')
        }

        if (e.data.callerId && e.data.chunk && e.data.language && e.data.theme) {
          const result = await highlightCodeChunk(e.data.callerId, e.data.chunk, e.data.language, e.data.theme)
          self.postMessage({ id, type: 'highlight-result', result } as WorkerResponse)
        } else {
          throw new Error('Missing required highlight parameters')
        }
        break

      case 'cleanup':
        if (e.data.callerId) {
          cleanupTokenizer(e.data.callerId)
          self.postMessage({ id, type: 'cleanup-result', result: { success: true } } as WorkerResponse)
        } else {
          throw new Error('Missing callerId for cleanup')
        }
        break

      case 'dispose':
        disposeAll()
        self.postMessage({ id, type: 'dispose-result', result: { success: true } } as WorkerResponse)
        break

      default:
        throw new Error(`Unknown command: ${type}`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    self.postMessage({
      id,
      type: 'error',
      error: errorMessage
    } as WorkerResponse)
  }
}
