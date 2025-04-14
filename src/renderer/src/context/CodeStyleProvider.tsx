import { useMermaid } from '@renderer/hooks/useMermaid'
import { useSettings } from '@renderer/hooks/useSettings'
import { HighlightChunkResult, ShikiPreProperties, shikiStreamService } from '@renderer/services/ShikiStreamService'
import { ThemeMode } from '@renderer/types'
import type React from 'react'
import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useState } from 'react'

interface CodeStyleContextType {
  highlightCodeChunk: (trunk: string, language: string, callerId: string) => Promise<HighlightChunkResult>
  cleanupTokenizers: (callerId: string) => void
  getShikiPreProperties: (language: string) => Promise<ShikiPreProperties>
  themeNames: string[]
  currentTheme: string
  languageMap: Record<string, string>
}

const defaultCodeStyleContext: CodeStyleContextType = {
  highlightCodeChunk: async () => ({ lines: [], recall: 0 }),
  cleanupTokenizers: () => {},
  getShikiPreProperties: async () => ({ class: '', style: '', tabindex: 0 }),
  themeNames: ['auto'],
  currentTheme: 'none',
  languageMap: {}
}

const CodeStyleContext = createContext<CodeStyleContextType>(defaultCodeStyleContext)

export const CodeStyleProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { codeEditor, codeStyle, theme } = useSettings()
  const [cmThemes, setCmThemes] = useState({})
  const [shikiThemes, setShikiThemes] = useState({})
  useMermaid()

  useEffect(() => {
    if (codeEditor.enabled) {
      import('@uiw/codemirror-themes-all').then((themes) => {
        setCmThemes(themes)
      })
    } else {
      import('shiki').then(({ bundledThemes }) => {
        setShikiThemes(bundledThemes)
      })
    }
  }, [codeEditor.enabled])

  // 获取支持的主题名称列表
  const themeNames = useMemo(() => {
    // CodeMirror 主题
    // 更保险的做法可能是硬编码主题列表
    if (codeEditor.enabled) {
      return ['auto', 'light', 'dark']
        .concat(Object.keys(cmThemes))
        .filter((item) => typeof cmThemes[item as keyof typeof cmThemes] !== 'function')
        .filter((item) => !/^(defaultSettings)/.test(item as string) && !/(Style)$/.test(item as string))
    }

    // Shiki 主题
    return ['auto', ...Object.keys(shikiThemes)]
  }, [cmThemes, codeEditor.enabled, shikiThemes])

  // 获取当前使用的主题名称
  const currentTheme = useMemo(() => {
    if (!codeStyle || codeStyle === 'auto' || !themeNames.includes(codeStyle)) {
      if (codeEditor.enabled) {
        return theme === ThemeMode.light ? 'materialLight' : 'dark'
      } else {
        return theme === ThemeMode.light ? 'one-light' : 'material-theme-darker'
      }
    }
    return codeStyle
  }, [codeEditor.enabled, codeStyle, themeNames, theme])

  // 一些语言的别名
  const languageMap = useMemo(() => {
    return {
      bash: 'shell',
      svg: 'xml',
      vab: 'vb'
    } as Record<string, string>
  }, [])

  useEffect(() => {
    // 在组件卸载时清理 Worker
    return () => {
      shikiStreamService.dispose()
    }
  }, [])

  // 流式代码高亮，返回已高亮的 token lines
  const highlightCodeChunk = useCallback(
    async (trunk: string, language: string, callerId: string) => {
      const normalizedLang = languageMap[language as keyof typeof languageMap] || language.toLowerCase()
      return shikiStreamService.highlightCodeChunk(trunk, normalizedLang, currentTheme, callerId)
    },
    [currentTheme, languageMap]
  )

  // 清理代码高亮资源
  const cleanupTokenizers = useCallback((callerId: string) => {
    shikiStreamService.cleanupTokenizers(callerId)
  }, [])

  // 获取 Shiki pre 标签属性
  const getShikiPreProperties = useCallback(
    async (language: string) => {
      const normalizedLang = languageMap[language as keyof typeof languageMap] || language.toLowerCase()
      return shikiStreamService.getShikiPreProperties(normalizedLang, currentTheme)
    },
    [currentTheme, languageMap]
  )

  const contextValue = useMemo(
    () => ({
      highlightCodeChunk,
      cleanupTokenizers,
      getShikiPreProperties,
      themeNames,
      currentTheme,
      languageMap
    }),
    [highlightCodeChunk, cleanupTokenizers, getShikiPreProperties, themeNames, currentTheme, languageMap]
  )

  return <CodeStyleContext value={contextValue}>{children}</CodeStyleContext>
}

export const useCodeStyle = () => {
  const context = use(CodeStyleContext)
  if (!context) {
    throw new Error('useCodeStyle must be used within a CodeStyleProvider')
  }
  return context
}
