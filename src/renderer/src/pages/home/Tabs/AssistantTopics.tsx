import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons'
import { Assistant, Topic } from '@renderer/types'
import { FC, memo } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import TopicList from './TopicList'

interface AssistantTopicsProps {
  assistant: Assistant
  isCollapsed: boolean
  topicCount: number
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
  onToggleCollapse: () => void
}

const AssistantTopics: FC<AssistantTopicsProps> = ({
  assistant,
  isCollapsed,
  topicCount,
  activeTopic,
  setActiveTopic,
  onToggleCollapse
}) => {
  const { t } = useTranslation()

  return (
    <div style={{ marginBottom: 8 }}>
      <AssistantHeader onClick={onToggleCollapse}>
        {isCollapsed ? <CaretRightOutlined /> : <CaretDownOutlined />}
        {assistant.emoji && <AssistantEmojiSpan>{assistant.emoji}</AssistantEmojiSpan>}
        <AssistantName>{assistant.name}</AssistantName>
        <TopicCountBadge>{topicCount}</TopicCountBadge>
      </AssistantHeader>

      {!isCollapsed &&
        (topicCount > 0 ? (
          <TopicList activeTopic={activeTopic} setActiveTopic={setActiveTopic} assistant={assistant} />
        ) : (
          <EmptyTopicsMessage>{t('topics.tab.no_topics')}</EmptyTopicsMessage>
        ))}
    </div>
  )
}

const AssistantHeader = styled.div`
  display: flex;
  align-items: center;
  padding: 8px 6px;
  border-radius: 6px;
  font-weight: 500;
  color: var(--color-text-2);
`

const AssistantEmojiSpan = styled.span`
  margin-right: 8px;
  margin-left: 4px;
  font-size: 14px;
`

const AssistantName = styled.span`
  font-size: 14px;
  flex-grow: 1;
`

const TopicCountBadge = styled.span`
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
  background-color: var(--color-background-soft);
  color: var(--color-text-3);
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  padding: 0 6px;
`

const EmptyTopicsMessage = styled.div`
  padding: 8px 0;
  color: var(--color-text-3);
  font-size: 13px;
  font-style: italic;
`

export default memo(AssistantTopics)
