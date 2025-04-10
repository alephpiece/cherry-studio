import { DownloadOutlined, EditOutlined, EyeOutlined, LoadingOutlined, PlayCircleOutlined } from '@ant-design/icons'
import { ToolbarProvider, ToolContext, useToolbar } from '@renderer/components/CodeView/context'
import { useSettings } from '@renderer/hooks/useSettings'
import { formatPyodideResult, runPythonScript } from '@renderer/services/PyodideService'
import { extractTitle } from '@renderer/utils/formats'
import dayjs from 'dayjs'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled, { css } from 'styled-components'

import { CodeXmlIcon } from '../Icons/CodeXmlIcon'
import HtmlStatusBar from './HtmlStatusBar'
import MermaidPreview from './MermaidPreview'
import PlantUmlPreview, { isValidPlantUML } from './PlantUmlPreview'
import SourceEditor from './SourceEditor'
import SourcePreview from './SourcePreview'
import StatusBar from './StatusBar'
import SvgPreview from './SvgPreview'
import Toolbar from './Toolbar'

interface Props {
  children: string
  language: string
  id?: string
  onSave?: (id: string, newContent: string) => void
}

/**
 * 代码块视图
 * 工具栏：
 * - 顶部 sticky tool bar
 * - 底部 status bar
 * 预览视图：
 * - Mermaid
 * - PlantUML
 * - SVG
 * - Source (原来的 shiki 高亮视图)
 * 编辑视图：
 * - 代码编辑器
 */
const CodeViewImpl: React.FC<Props> = ({ children, language, id, onSave }) => {
  const { codeEditor } = useSettings()
  const { t } = useTranslation()
  const previewRef = useRef<HTMLDivElement>(null)
  const [isInSourceView, setIsInSourceView] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [output, setOutput] = useState('')

  const isExecutable = useMemo(() => language === 'python', [language])
  const hasSpecialView = ['mermaid', 'plantuml', 'svg'].includes(language)

  const isInSpecialView = useMemo(() => {
    return hasSpecialView && !isInSourceView
  }, [hasSpecialView, isInSourceView])

  const { updateContext, registerTool, removeTool } = useToolbar()

  useEffect(() => {
    updateContext({
      code: children,
      language,
      viewType: isInSourceView ? 'source' : language,
      viewRef: previewRef
    })
  }, [children, language, isInSourceView, updateContext])

  const onCopySource = useCallback(
    (ctx?: ToolContext) => {
      if (!ctx) return
      navigator.clipboard.writeText(ctx.code)
      window.message.success({ content: t('code_block.copy.success'), key: 'copy-code' })
    },
    [t]
  )

  const onDownloadSource = useCallback((ctx?: ToolContext) => {
    if (!ctx) return

    const { code, language } = ctx
    let fileName = ''

    // 尝试提取标题
    if (language === 'html' && code.includes('</html>')) {
      const title = extractTitle(code)
      if (title) {
        fileName = `${title}.html`
      }
    }

    // 默认使用日期格式命名
    if (!fileName) {
      fileName = `${dayjs().format('YYYYMMDDHHmm')}.${language}`
    }

    window.api.file.save(fileName, code)
  }, [])

  const onRunScript = useCallback((ctx?: ToolContext) => {
    if (!ctx) return

    setIsRunning(true)
    setOutput('')

    runPythonScript(ctx.code, {})
      .then((output) => {
        console.log('Python execution result:', output)

        // 统一构建输出文本
        let outputText = ''

        // 1. 优先显示标准输出文本
        if (output.text) {
          outputText = output.text
        }
        // 2. 如果没有标准输出但有结果值，显示结果
        else if (output.result !== null && output.result !== undefined) {
          outputText = formatPyodideResult(output.result)
        }

        // 3. 如果有错误信息，附加显示（无论是否有其他输出）
        if (output.error) {
          if (outputText) outputText += '\n\n'
          outputText += output.error
        }

        setOutput(outputText || '(no output)')
      })
      .catch((error) => {
        // 这里只处理系统级错误（如网络问题、Worker崩溃等）
        // Python执行错误已由Worker捕获并通过output.error字段返回
        console.error('System error:', error)
        setOutput(`System error:\n${error.message || 'Unknown error'}`)
      })
      .finally(() => {
        setIsRunning(false)
      })
  }, [])

  useEffect(() => {
    // 复制按钮
    registerTool({
      id: 'copy',
      type: 'core',
      icon: <i className="iconfont icon-copy" style={{ fontSize: 14 }}></i>,
      tooltip: t('code_block.copy.source'),
      onClick: onCopySource,
      order: 0
    })

    // 下载按钮
    registerTool({
      id: 'download',
      type: 'core',
      icon: <DownloadOutlined />,
      tooltip: t('code_block.download.source'),
      onClick: onDownloadSource,
      order: 1
    })
    return () => {
      removeTool('copy')
      removeTool('download')
    }
  }, [onCopySource, onDownloadSource, registerTool, removeTool, t])

  // 特殊视图的编辑按钮
  useEffect(() => {
    if (!hasSpecialView) return

    if (codeEditor.enabled) {
      registerTool({
        id: 'edit',
        type: 'core',
        icon: isInSourceView ? <EyeOutlined /> : <EditOutlined />,
        tooltip: isInSourceView ? t('code_block.preview') : t('code_block.edit'),
        onClick: () => setIsInSourceView(!isInSourceView),
        order: 2
      })
    } else {
      registerTool({
        id: 'view-source',
        type: 'core',
        icon: isInSourceView ? <EyeOutlined /> : <CodeXmlIcon />,
        tooltip: isInSourceView ? t('code_block.preview') : t('code_block.preview.source'),
        onClick: () => setIsInSourceView(!isInSourceView),
        order: 2
      })
    }

    return () => {
      if (!hasSpecialView) return

      if (codeEditor.enabled) {
        removeTool('edit')
      } else {
        removeTool('view-source')
      }
    }
  }, [codeEditor.enabled, hasSpecialView, isInSourceView, registerTool, removeTool, t])

  useEffect(() => {
    if (!isExecutable) return

    registerTool({
      id: 'run',
      type: 'quick',
      icon: isRunning ? <LoadingOutlined /> : <PlayCircleOutlined />,
      tooltip: t('code_block.run'),
      onClick: onRunScript,
      order: 0
    })

    return () => isExecutable && removeTool('run')
  }, [children, isExecutable, isRunning, onRunScript, registerTool, removeTool, t])

  const SourceViewer = useMemo(() => {
    return codeEditor.enabled ? SourceEditor : SourcePreview
  }, [codeEditor.enabled])

  const renderHeader = useMemo(() => {
    if (isInSpecialView) {
      return null
    }
    return <CodeHeader>{'<' + language.toUpperCase() + '>'}</CodeHeader>
  }, [isInSpecialView, language])

  const renderContent = useMemo(() => {
    if (!isInSourceView) {
      if (language === 'mermaid') {
        return <MermaidPreview>{children}</MermaidPreview>
      }

      if (language === 'plantuml' && isValidPlantUML(children)) {
        return <PlantUmlPreview>{children}</PlantUmlPreview>
      }

      if (language === 'svg') {
        return <SvgPreview>{children}</SvgPreview>
      }
    }

    return (
      <SourceViewer ref={previewRef} language={language} id={id} onSave={onSave}>
        {children}
      </SourceViewer>
    )
  }, [SourceViewer, children, id, isInSourceView, language, onSave])

  const renderStatusBar = useMemo(() => {
    if (language === 'html') {
      return <HtmlStatusBar>{children}</HtmlStatusBar>
    }

    if (isExecutable && output) {
      return <StatusBar>{output}</StatusBar>
    }

    return null
  }, [children, isExecutable, language, output])

  return (
    <CodeBlockWrapper className="code-block" isInSpecialView={isInSpecialView}>
      {renderHeader}
      <Toolbar />
      {renderContent}
      {renderStatusBar}
    </CodeBlockWrapper>
  )
}

const CodeView: React.FC<Props> = ({ children, language, id, onSave }) => {
  return (
    <ToolbarProvider>
      <CodeViewImpl children={children} language={language} id={id} onSave={onSave} />
    </ToolbarProvider>
  )
}

const CodeBlockWrapper = styled.div<{ isInSpecialView: boolean }>`
  position: relative;

  ${({ isInSpecialView }) =>
    isInSpecialView &&
    css`
      .toolbar {
        opacity: 0;
        transition: opacity 0.2s ease;
        transform: translateZ(0);
        will-change: opacity;
        margin-top: 20px;
        &.show {
          opacity: 1;
        }
      }
      &:hover {
        .toolbar {
          opacity: 1;
        }
      }
    `}
`

const CodeHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--color-text);
  font-size: 14px;
  font-weight: bold;
  height: 34px;
  padding: 0 10px;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
`

export default memo(CodeView)
