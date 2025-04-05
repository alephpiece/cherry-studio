import { useTheme } from '@renderer/context/ThemeProvider'
import { useMermaid } from '@renderer/hooks/useMermaid'
import { useSettings } from '@renderer/hooks/useSettings'
import { shikiWorker } from '@renderer/services/ShikiWorkerService'
import { type CodeStyleVarious, ThemeMode } from '@renderer/types'
import type React from 'react'
import { createContext, type PropsWithChildren, use, useCallback, useEffect, useMemo } from 'react'
import { bundledThemes } from 'shiki'

interface SyntaxHighlighterContextType {
  codeToHtml: (code: string, language: string, enableCache: boolean) => Promise<string>
}

const SyntaxHighlighterContext = createContext<SyntaxHighlighterContextType | undefined>(undefined)

export const SyntaxHighlighterProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const { theme } = useTheme()
  const { codeStyle } = useSettings()
  useMermaid()

  const highlighterTheme = useMemo(() => {
    if (!codeStyle || codeStyle === 'auto') {
      return theme === ThemeMode.light ? 'one-light' : 'material-theme-darker'
    }
    return codeStyle
  }, [theme, codeStyle])

  useEffect(() => {
    // 在组件卸载时清理 Worker
    return () => {
      shikiWorker.dispose()
    }
  }, [])

  const codeToHtml = useCallback(
    async (code: string, language: string, enableCache: boolean) => {
      if (!code) return ''
      return shikiWorker.highlightCode(code, language, highlighterTheme, enableCache)
    },
    [highlighterTheme]
  )

  return <SyntaxHighlighterContext value={{ codeToHtml }}>{children}</SyntaxHighlighterContext>
}

export const useSyntaxHighlighter = () => {
  const context = use(SyntaxHighlighterContext)
  if (!context) {
    throw new Error('useSyntaxHighlighter must be used within a SyntaxHighlighterProvider')
  }
  return context
}

export const codeThemes = ['auto', ...Object.keys(bundledThemes)] as CodeStyleVarious[]
