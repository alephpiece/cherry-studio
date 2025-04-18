import { useMermaid } from '@renderer/hooks/useMermaid'
import { useSettings } from '@renderer/hooks/useSettings'
import { HighlightChunkResult, ShikiPreProperties, shikiStreamService } from '@renderer/services/ShikiStreamService'
import { ThemeMode } from '@renderer/types'
import * as cmThemes from '@uiw/codemirror-themes-all'
import type React from 'react'
import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo, useState } from 'react'

interface CodeStyleContextType {
  highlightCodeChunk: (trunk: string, language: string, callerId: string) => Promise<HighlightChunkResult>
  cleanupTokenizers: (callerId: string) => void
  getShikiPreProperties: (language: string) => Promise<ShikiPreProperties>
  themeNames: string[]
  activeThemeName: string
  activeCmTheme: any
  languageMap: Record<string, string>
}

const defaultCodeStyleContext: CodeStyleContextType = {
  highlightCodeChunk: async () => ({ lines: [], recall: 0 }),
  cleanupTokenizers: () => {},
  getShikiPreProperties: async () => ({ class: '', style: '', tabindex: 0 }),
  themeNames: ['auto'],
  activeThemeName: 'auto',
  activeCmTheme: null,
  languageMap: {}
}

const CodeStyleContext = createContext<CodeStyleContextType>(defaultCodeStyleContext)

export const CodeStyleProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { codeEditor, codeStyle, theme } = useSettings()
  const [shikiThemes, setShikiThemes] = useState({})
  useMermaid()

  useEffect(() => {
    if (!codeEditor.enabled) {
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
  }, [codeEditor.enabled, shikiThemes])

  // 获取当前使用的主题名称
  const activeThemeName = useMemo(() => {
    if (!codeStyle || codeStyle === 'auto' || !themeNames.includes(codeStyle)) {
      if (codeEditor.enabled) {
        return theme === ThemeMode.light ? 'materialLight' : 'dark'
      } else {
        return theme === ThemeMode.light ? 'one-light' : 'material-theme-darker'
      }
    }
    return codeStyle
  }, [codeEditor.enabled, codeStyle, themeNames, theme])

  // 获取当前使用的 CodeMirror 主题
  const activeCmTheme = useMemo(() => {
    if (!codeEditor.enabled) return null

    return cmThemes[activeThemeName as keyof typeof cmThemes] || activeThemeName
  }, [activeThemeName, codeEditor.enabled])

  // 一些语言的别名
  const languageMap = useMemo(() => {
    return {
      bash: 'shell',
      'objective-c++': 'objective-cpp',
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
      return shikiStreamService.highlightCodeChunk(trunk, normalizedLang, activeThemeName, callerId)
    },
    [activeThemeName, languageMap]
  )

  // 清理代码高亮资源
  const cleanupTokenizers = useCallback((callerId: string) => {
    shikiStreamService.cleanupTokenizers(callerId)
  }, [])

  // 获取 Shiki pre 标签属性
  const getShikiPreProperties = useCallback(
    async (language: string) => {
      const normalizedLang = languageMap[language as keyof typeof languageMap] || language.toLowerCase()
      return shikiStreamService.getShikiPreProperties(normalizedLang, activeThemeName)
    },
    [activeThemeName, languageMap]
  )

  const contextValue = useMemo(
    () => ({
      highlightCodeChunk,
      cleanupTokenizers,
      getShikiPreProperties,
      themeNames,
      activeThemeName,
      activeCmTheme,
      languageMap
    }),
    [
      highlightCodeChunk,
      cleanupTokenizers,
      getShikiPreProperties,
      themeNames,
      activeThemeName,
      activeCmTheme,
      languageMap
    ]
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
