import CodeView from '@renderer/components/CodeView'
import React, { memo } from 'react'

interface Props {
  children: string
  className?: string
  id?: string
  onSave?: (id: string, newContent: string) => void
  [key: string]: any
}

const CodeBlock: React.FC<Props> = ({ children, className, id, onSave }) => {
  const match = /language-(\w+)/.exec(className || '') || children?.includes('\n')
  const language = match?.[1] ?? 'text'

  return match ? (
    <CodeView language={language} id={id} onSave={onSave}>
      {children}
    </CodeView>
  ) : (
    <code className={className} style={{ textWrap: 'wrap' }}>
      {children}
    </code>
  )
}

export default memo(CodeBlock)
