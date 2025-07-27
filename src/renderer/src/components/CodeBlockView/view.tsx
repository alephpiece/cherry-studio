import { LoadingOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { ActionTool, TOOL_SPECS, useToolManager } from '@renderer/components/ActionTools'
import CodeEditor from '@renderer/components/CodeEditor'
import { CodeToolbar } from '@renderer/components/CodeToolbar'
import { DownloadPngIcon, DownloadSvgIcon } from '@renderer/components/Icons/DownloadIcons'
import ImageViewer from '@renderer/components/ImageViewer'
import { BasicPreviewHandles } from '@renderer/components/Preview'
import { useSettings } from '@renderer/hooks/useSettings'
import { pyodideService } from '@renderer/services/PyodideService'
import { extractTitle } from '@renderer/utils/formats'
import { getExtensionByLanguage, isHtmlCode, isValidPlantUML } from '@renderer/utils/markdown'
import dayjs from 'dayjs'
import {
  CirclePlay,
  CodeXml,
  Copy,
  Download,
  Eye,
  FileCode,
  Square,
  SquarePen,
  SquareSplitHorizontal
} from 'lucide-react'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import CodePreview from './CodePreview'
import { SPECIAL_VIEW_COMPONENTS, SPECIAL_VIEWS } from './constants'
import HtmlArtifactsCard from './HtmlArtifactsCard'
import StatusBar from './StatusBar'
import { ViewMode } from './types'

const logger = loggerService.withContext('CodeBlockView')

interface Props {
  children: string
  language: string
  onSave?: (newContent: string) => void
}

/**
 * 代码块视图
 *
 * 视图类型：
 * - preview: 预览视图，其中非源代码的是特殊视图
 * - edit: 编辑视图
 *
 * 视图模式：
 * - source: 源代码视图模式
 * - special: 特殊视图模式（Mermaid、PlantUML、SVG）
 * - split: 分屏模式（源代码和特殊视图并排显示）
 *
 * 顶部 sticky 工具栏：
 * - quick 工具
 * - core 工具
 */
export const CodeBlockView: React.FC<Props> = memo(({ children, language, onSave }) => {
  const { t } = useTranslation()
  const { codeEditor, codeExecution } = useSettings()

  const [viewMode, setViewMode] = useState<ViewMode>('special')
  const [isRunning, setIsRunning] = useState(false)
  const [executionResult, setExecutionResult] = useState<{ text: string; image?: string } | null>(null)

  const [tools, setTools] = useState<ActionTool[]>([])
  const { registerTool, removeTool } = useToolManager(setTools)

  const isExecutable = useMemo(() => {
    return codeExecution.enabled && language === 'python'
  }, [codeExecution.enabled, language])

  const specialViewRef = useRef<BasicPreviewHandles>(null)

  const hasSpecialView = useMemo(() => SPECIAL_VIEWS.includes(language), [language])

  const isInSpecialView = useMemo(() => {
    return hasSpecialView && viewMode === 'special'
  }, [hasSpecialView, viewMode])

  const handleCopySource = useCallback(() => {
    navigator.clipboard.writeText(children)
    window.message.success({ content: t('code_block.copy.success'), key: 'copy-code' })
  }, [children, t])

  const handleDownloadSource = useCallback(() => {
    let fileName = ''

    // 尝试提取 HTML 标题
    if (language === 'html' && children.includes('</html>')) {
      fileName = extractTitle(children) || ''
    }

    // 默认使用日期格式命名
    if (!fileName) {
      fileName = `${dayjs().format('YYYYMMDDHHmm')}`
    }

    const ext = getExtensionByLanguage(language)
    window.api.file.save(`${fileName}${ext}`, children)
  }, [children, language])

  const handleRunScript = useCallback(() => {
    setIsRunning(true)
    setExecutionResult(null)

    pyodideService
      .runScript(children, {}, codeExecution.timeoutMinutes * 60000)
      .then((result) => {
        setExecutionResult(result)
      })
      .catch((error) => {
        logger.error('Unexpected error:', error)
        setExecutionResult({
          text: `Unexpected error: ${error.message || 'Unknown error'}`
        })
      })
      .finally(() => {
        setIsRunning(false)
      })
  }, [children, codeExecution.timeoutMinutes])

  // 复制按钮
  useEffect(() => {
    registerTool({
      ...TOOL_SPECS.copy,
      icon: <Copy className="tool-icon" />,
      tooltip: t('code_block.copy.source'),
      onClick: handleCopySource
    })

    return () => removeTool(TOOL_SPECS.copy.id)
  }, [handleCopySource, registerTool, removeTool, t])

  // 下载按钮
  useEffect(() => {
    const hasSpecialViewTools = hasSpecialView && specialViewRef.current

    const baseTool = {
      ...TOOL_SPECS.download,
      icon: <Download className="tool-icon" />,
      tooltip: hasSpecialViewTools ? t('common.download') : t('code_block.download.source')
    }

    if (hasSpecialViewTools) {
      registerTool({
        ...baseTool,
        children: [
          {
            ...TOOL_SPECS.download,
            icon: <FileCode size={'1rem'} />,
            tooltip: t('code_block.download.source'),
            onClick: handleDownloadSource
          },
          {
            ...TOOL_SPECS['download-svg'],
            icon: <DownloadSvgIcon size={'1rem'} />,
            tooltip: t('code_block.download.svg'),
            onClick: () => specialViewRef.current?.download('svg')
          },
          {
            ...TOOL_SPECS['download-png'],
            icon: <DownloadPngIcon size={'1rem'} />,
            tooltip: t('code_block.download.png'),
            onClick: () => specialViewRef.current?.download('png')
          }
        ]
      })
    } else {
      registerTool({
        ...baseTool,
        onClick: handleDownloadSource
      })
    }

    return () => removeTool(TOOL_SPECS.download.id)
  }, [handleDownloadSource, hasSpecialView, registerTool, removeTool, t])

  // 特殊视图的编辑按钮，在分屏模式下不可用
  useEffect(() => {
    if (!hasSpecialView || viewMode === 'split') return

    const viewSourceToolSpec = codeEditor.enabled ? TOOL_SPECS.edit : TOOL_SPECS['view-source']

    if (codeEditor.enabled) {
      registerTool({
        ...viewSourceToolSpec,
        icon: viewMode === 'source' ? <Eye className="tool-icon" /> : <SquarePen className="tool-icon" />,
        tooltip: viewMode === 'source' ? t('preview.label') : t('code_block.edit.label'),
        onClick: () => setViewMode(viewMode === 'source' ? 'special' : 'source')
      })
    } else {
      registerTool({
        ...viewSourceToolSpec,
        icon: viewMode === 'source' ? <Eye className="tool-icon" /> : <CodeXml className="tool-icon" />,
        tooltip: viewMode === 'source' ? t('preview.label') : t('preview.source'),
        onClick: () => setViewMode(viewMode === 'source' ? 'special' : 'source')
      })
    }

    return () => removeTool(viewSourceToolSpec.id)
  }, [codeEditor.enabled, hasSpecialView, viewMode, registerTool, removeTool, t])

  // 特殊视图的分屏按钮
  useEffect(() => {
    if (!hasSpecialView) return

    registerTool({
      ...TOOL_SPECS['split-view'],
      icon: viewMode === 'split' ? <Square className="tool-icon" /> : <SquareSplitHorizontal className="tool-icon" />,
      tooltip: viewMode === 'split' ? t('code_block.split.restore') : t('code_block.split.label'),
      onClick: () => setViewMode(viewMode === 'split' ? 'special' : 'split')
    })

    return () => removeTool(TOOL_SPECS['split-view'].id)
  }, [hasSpecialView, viewMode, registerTool, removeTool, t])

  // 运行按钮
  useEffect(() => {
    if (!isExecutable) return

    registerTool({
      ...TOOL_SPECS.run,
      icon: isRunning ? <LoadingOutlined /> : <CirclePlay className="tool-icon" />,
      tooltip: t('code_block.run'),
      onClick: () => !isRunning && handleRunScript()
    })

    return () => isExecutable && removeTool(TOOL_SPECS.run.id)
  }, [isExecutable, isRunning, handleRunScript, registerTool, removeTool, t])

  // 源代码视图组件
  const sourceView = useMemo(() => {
    if (codeEditor.enabled) {
      return (
        <CodeEditor
          value={children}
          language={language}
          onSave={onSave}
          options={{ stream: true }}
          setTools={setTools}
        />
      )
    } else {
      return (
        <CodePreview language={language} setTools={setTools}>
          {children}
        </CodePreview>
      )
    }
  }, [children, codeEditor.enabled, language, onSave, setTools])

  // 特殊视图组件映射
  const specialView = useMemo(() => {
    const SpecialView = SPECIAL_VIEW_COMPONENTS[language as keyof typeof SPECIAL_VIEW_COMPONENTS]

    if (!SpecialView) return null

    // PlantUML 语法验证
    if (language === 'plantuml' && !isValidPlantUML(children)) {
      return null
    }

    return (
      <SpecialView ref={specialViewRef} setTools={setTools}>
        {children}
      </SpecialView>
    )
  }, [children, language])

  const renderHeader = useMemo(() => {
    const langTag = '<' + language.toUpperCase() + '>'
    return <CodeHeader $isInSpecialView={isInSpecialView}>{isInSpecialView ? '' : langTag}</CodeHeader>
  }, [isInSpecialView, language])

  // 根据视图模式和语言选择组件，优先展示特殊视图，fallback是源代码视图
  const renderContent = useMemo(() => {
    const showSpecialView = specialView && ['special', 'split'].includes(viewMode)
    const showSourceView = !specialView || viewMode !== 'special'

    return (
      <SplitViewWrapper className="split-view-wrapper">
        {showSpecialView && specialView}
        {showSourceView && sourceView}
      </SplitViewWrapper>
    )
  }, [specialView, sourceView, viewMode])

  // HTML 代码块特殊处理 - 在所有 hooks 调用之后
  if (language === 'html' && isHtmlCode(children)) {
    return <HtmlArtifactsCard html={children} />
  }

  return (
    <CodeBlockWrapper className="code-block" $isInSpecialView={isInSpecialView}>
      {renderHeader}
      <CodeToolbar tools={tools} />
      {renderContent}
      {isExecutable && executionResult && (
        <StatusBar>
          {executionResult.text}
          {executionResult.image && (
            <ImageViewer src={executionResult.image} alt="Matplotlib plot" style={{ cursor: 'pointer' }} />
          )}
        </StatusBar>
      )}
    </CodeBlockWrapper>
  )
})

const CodeBlockWrapper = styled.div<{ $isInSpecialView: boolean }>`
  position: relative;
  width: 100%;
  /* FIXME: 最小宽度用于解决两个问题。
   * 一是 CodePreview 在气泡样式下的用户消息中无法撑开气泡，
   * 二是 代码块内容过少时 toolbar 会和 title 重叠。
   */
  min-width: 45ch;

  .code-toolbar {
    background-color: ${(props) => (props.$isInSpecialView ? 'transparent' : 'var(--color-background-mute)')};
    border-radius: ${(props) => (props.$isInSpecialView ? '0' : '4px')};
    opacity: 0;
    transition: opacity 0.2s ease;
    transform: translateZ(0);
    will-change: opacity;
    &.show {
      opacity: 1;
    }
  }
  &:hover {
    .code-toolbar {
      opacity: 1;
    }
  }
`

const CodeHeader = styled.div<{ $isInSpecialView: boolean }>`
  display: flex;
  align-items: center;
  color: var(--color-text);
  font-size: 14px;
  line-height: 1;
  font-weight: bold;
  padding: 0 10px;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  margin-top: ${(props) => (props.$isInSpecialView ? '6px' : '0')};
  height: ${(props) => (props.$isInSpecialView ? '16px' : '34px')};
`

const SplitViewWrapper = styled.div`
  display: flex;

  > * {
    flex: 1 1 auto;
    width: 100%;
  }

  &:not(:has(+ [class*='Container'])) {
    border-radius: 0 0 8px 8px;
    overflow: hidden;
  }
`
