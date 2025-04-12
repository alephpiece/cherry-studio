import React from 'react'
import styled from 'styled-components'

import { CodeStreamProvider } from './CodeStreamContext'
import CodeStreamRenderer from './CodeStreamRenderer'

interface CodePreviewProps {
  children: string
  language: string
}

/**
 * Shiki 代码高亮组件的入口
 *
 * 为了使用 shiki-stream，创建了能管理 stream 的组件层次。
 */
const CodePreview = ({
  ref,
  children,
  language
}: CodePreviewProps & { ref?: React.RefObject<HTMLDivElement | null> }) => {
  return (
    <CodeStreamProvider language={language}>
      <CodeViewContainer
        ref={ref}
        style={{
          border: '0.5px solid var(--color-code-background)',
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          marginTop: 0,
          position: 'relative'
        }}>
        <CodeStreamRenderer children={children} />
      </CodeViewContainer>
    </CodeStreamProvider>
  )
}

const CodeViewContainer = styled.div`
  .shiki {
    padding: 1em;
    background-color: var(--color-code-background);
    overflow: auto;
  }
`

CodePreview.displayName = 'CodePreview'

export default CodePreview
