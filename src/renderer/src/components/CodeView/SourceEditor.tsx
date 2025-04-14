import { Annotation } from '@codemirror/state'
import { useToolbar } from '@renderer/components/CodeView/context'
import { useCodeStyle } from '@renderer/context/CodeStyleProvider'
import { useSettings } from '@renderer/hooks/useSettings'
import * as cmThemes from '@uiw/codemirror-themes-all'
import CodeMirror, { EditorView, Extension, ReactCodeMirrorProps, ViewUpdate } from '@uiw/react-codemirror'
import diff from 'fast-diff'
import {
  ChevronsDownUp,
  ChevronsUpDown,
  Save as SaveIcon,
  Text as UnWrapIcon,
  WrapText as WrapIcon
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import React, { memo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

// 标记非用户编辑的变更
const External = Annotation.define<boolean>()

interface Props {
  children: string
  language: string
  onSave?: (newContent: string) => void
}

/**
 * 源代码编辑器，基于 CodeMirror
 */
const SourceEditor = ({
  children,
  language,
  onSave,
  ref
}: Props & { ref?: React.RefObject<HTMLDivElement | null> }) => {
  const { fontSize, codeShowLineNumbers, codeCollapsible, codeWrappable, codeEditor } = useSettings()
  const { currentTheme, languageMap } = useCodeStyle()
  const [isExpanded, setIsExpanded] = useState(!codeCollapsible)
  const [isUnwrapped, setIsUnwrapped] = useState(!codeWrappable)
  const initialContent = useRef(children?.trimEnd() ?? '')
  const [extensions, setExtensions] = useState<Extension[]>([])
  const editorRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const [showExpandButton, setShowExpandButton] = useState(false)
  const showExpandButtonRef = useRef(false)
  const shouldAutoScrollRef = useRef<boolean>(true)
  const { t } = useTranslation()

  // 合并引用
  React.useImperativeHandle(ref, () => editorRef.current!, [])

  const { registerTool, removeTool } = useToolbar()

  // 加载语言
  useEffect(() => {
    let normalizedLang = languageMap[language as keyof typeof languageMap] || language.toLowerCase()

    // 如果语言名包含 `-`，转换为驼峰命名法
    if (normalizedLang.includes('-')) {
      normalizedLang = normalizedLang.replace(/-([a-z])/g, (_, char) => char.toUpperCase())
    }

    import('@uiw/codemirror-extensions-langs')
      .then(({ loadLanguage }) => {
        const extension = loadLanguage(normalizedLang as any)
        if (extension) {
          setExtensions([extension])
        }
      })
      .catch((error) => {
        console.error(`Failed to load language: ${normalizedLang}`, error)
      })
  }, [language, languageMap])

  // 展开/折叠工具
  useEffect(() => {
    registerTool({
      id: 'expand',
      type: 'quick',
      icon: isExpanded ? <ChevronsDownUp className="icon" /> : <ChevronsUpDown className="icon" />,
      tooltip: isExpanded ? t('code_block.collapse') : t('code_block.expand'),
      visible: () => codeCollapsible && showExpandButton,
      onClick: () => {
        const newExpanded = !isExpanded
        setIsExpanded(newExpanded)
      },
      order: 1
    })

    return () => removeTool('expand')
  }, [codeCollapsible, isExpanded, registerTool, removeTool, showExpandButton, t])

  // 自动换行工具
  useEffect(() => {
    registerTool({
      id: 'wrap',
      type: 'quick',
      icon: isUnwrapped ? <WrapIcon className="icon" /> : <UnWrapIcon className="icon" />,
      tooltip: isUnwrapped ? t('code_block.wrap.on') : t('code_block.wrap.off'),
      visible: () => codeWrappable,
      onClick: () => {
        const newUnwrapped = !isUnwrapped
        setIsUnwrapped(newUnwrapped)
      },
      order: 0
    })

    return () => removeTool('wrap')
  }, [codeWrappable, isUnwrapped, registerTool, removeTool, t])

  // 保存按钮
  useEffect(() => {
    registerTool({
      id: 'save',
      type: 'core',
      icon: <SaveIcon className="icon" />,
      tooltip: t('code_block.edit.save'),
      onClick: () => {
        const currentDoc = editorViewRef.current?.state.doc.toString() ?? ''
        onSave?.(currentDoc)
      },
      order: 3
    })

    return () => removeTool('save')
  }, [onSave, registerTool, removeTool, t])

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (!editorViewRef.current) return

    // 获取文档的末尾位置
    const docLength = editorViewRef.current.state.doc.length

    editorViewRef.current.dispatch({
      effects: EditorView.scrollIntoView(docLength)
    })
  }, [])

  // 流式响应过程中计算 changes 来更新 EditorView
  // 无法处理用户在流式响应过程中编辑代码的情况（应该也不必处理）
  useEffect(() => {
    if (!editorViewRef.current) return

    const newContent = children?.trimEnd() ?? ''
    const currentDoc = editorViewRef.current.state.doc.toString()

    const changes = prepareCodeChanges(currentDoc, newContent)

    if (changes && changes.length > 0) {
      editorViewRef.current.dispatch({
        changes,
        annotations: [External.of(true)]
      })

      // 如果需要自动滚动，在下一帧执行滚动
      if (shouldAutoScrollRef.current) {
        requestAnimationFrame(scrollToBottom)
      }
    }
  }, [children, scrollToBottom])

  // 处理滚动事件，判断是否需要继续自动滚动
  const handleScroll = useCallback(() => {
    if (!editorViewRef.current) {
      shouldAutoScrollRef.current = false
      return
    }

    const scroller = editorViewRef.current.scrollDOM
    const { scrollTop, scrollHeight, clientHeight } = scroller

    shouldAutoScrollRef.current = scrollHeight - (scrollTop + clientHeight) < 50
  }, [])

  // 创建滚动监听扩展
  const scrollListener = useMemo(() => {
    return EditorView.updateListener.of((update: ViewUpdate) => {
      // 检查视图更新
      if (update.viewportChanged) {
        handleScroll()
      }
    })
  }, [handleScroll])

  // 检查编辑器高度并决定是否显示展开按钮
  useEffect(() => {
    if (!editorRef.current) return

    // 等待 DOM 更新完成后检查高度
    setTimeout(() => {
      const editorElement = editorRef.current?.querySelector('.cm-scroller')
      if (!editorElement) return

      const isShowExpandButton = editorElement.scrollHeight > 350
      if (showExpandButtonRef.current === isShowExpandButton) return

      showExpandButtonRef.current = isShowExpandButton
      setShowExpandButton(isShowExpandButton)
    }, 100)
  }, [])

  useEffect(() => {
    setIsExpanded(!codeCollapsible)
  }, [codeCollapsible])

  useEffect(() => {
    setIsUnwrapped(!codeWrappable)
  }, [codeWrappable])

  const cmTheme = useMemo(() => {
    const _cmTheme = currentTheme as ReactCodeMirrorProps['theme']
    return cmThemes[_cmTheme as keyof typeof cmThemes] || _cmTheme
  }, [currentTheme])

  return (
    <CodemirrorWarpper ref={editorRef}>
      <CodeMirror
        // 维持一个稳定值，避免触发 CodeMirror 重置
        value={initialContent.current}
        width="100%"
        maxHeight={codeCollapsible && !isExpanded ? '350px' : 'none'}
        editable={true}
        // @ts-ignore 强制使用，见 react-codemirror 的 Example.tsx
        theme={cmTheme}
        extensions={[...extensions, ...(isUnwrapped ? [] : [EditorView.lineWrapping]), scrollListener]}
        onCreateEditor={(view: EditorView) => (editorViewRef.current = view)}
        basicSetup={{
          lineNumbers: codeShowLineNumbers,
          highlightActiveLineGutter: codeEditor.highlightActiveLine,
          foldGutter: codeEditor.foldGutter,
          dropCursor: true,
          allowMultipleSelections: true,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: codeEditor.autocompletion,
          rectangularSelection: true,
          crosshairCursor: true,
          highlightActiveLine: codeEditor.highlightActiveLine,
          highlightSelectionMatches: true,
          closeBracketsKeymap: codeEditor.keymap,
          searchKeymap: codeEditor.keymap,
          foldKeymap: codeEditor.keymap,
          completionKeymap: codeEditor.keymap,
          lintKeymap: codeEditor.keymap
        }}
        style={{
          fontSize: `${fontSize - 1}px`,
          overflow: codeCollapsible && !isExpanded ? 'auto' : 'visible'
        }}
      />
    </CodemirrorWarpper>
  )
}

SourceEditor.displayName = 'SourceEditor'

const CodemirrorWarpper = styled.div`
  position: relative;
  height: 100%;
  width: 100%;
  border: 0.5px solid var(--color-code-background);
  margin-top: 0;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
`

/**
 * 使用 fast-diff 计算代码变更，再转换为 CodeMirror 的 changes。
 * 可以处理所有类型的变更，不过流式响应过程中多是插入操作。
 * @param oldCode 旧的代码内容
 * @param newCode 新的代码内容
 * @returns 用于 EditorView.dispatch 的 changes 数组
 */
function prepareCodeChanges(oldCode: string, newCode: string) {
  const diffResult = diff(oldCode, newCode)

  const changes: { from: number; to: number; insert: string }[] = []
  let offset = 0

  // operation: 1=插入, -1=删除, 0=相等
  for (const [operation, text] of diffResult) {
    if (operation === 1) {
      changes.push({
        from: offset,
        to: offset,
        insert: text
      })
    } else if (operation === -1) {
      changes.push({
        from: offset,
        to: offset + text.length,
        insert: ''
      })
      offset += text.length
    } else {
      offset += text.length
    }
  }

  return changes
}

export default memo(SourceEditor)
