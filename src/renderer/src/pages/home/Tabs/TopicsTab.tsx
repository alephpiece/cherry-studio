import { PartitionOutlined } from '@ant-design/icons'
import Scrollbar from '@renderer/components/Scrollbar'
import { useAssistants } from '@renderer/hooks/useAssistant'
import { modelGenerating } from '@renderer/hooks/useRuntime'
import { useSettings } from '@renderer/hooks/useSettings'
import { useTopics } from '@renderer/hooks/useTopic'
import { getDefaultTopic } from '@renderer/services/AssistantService'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import { Topic } from '@renderer/types'
import { Tooltip } from 'antd'
import { FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import AssistantTopics from './AssistantTopics'
import TopicList from './TopicList'

interface Props {
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
}

const Topics: FC<Props> = ({ activeTopic, setActiveTopic }) => {
  const { topicPosition } = useSettings()
  const { assistants } = useAssistants()
  const { topics, removeTopic, updateTopic } = useTopics()
  const { t } = useTranslation()
  const [isGroupedByAssistant, setIsGroupedByAssistant] = useState(false)
  const [collapsedAssistants, setCollapsedAssistants] = useState<Record<string, boolean>>({})

  // 在分组模式下计算助手话题数量
  const assistantTopicCounts = useMemo(() => {
    if (!isGroupedByAssistant) return {}

    const counts: Record<string, number> = {}
    topics.forEach((topic) => {
      counts[topic.assistantId] = (counts[topic.assistantId] || 0) + 1
    })
    return counts
  }, [topics, isGroupedByAssistant])

  const toggleAssistantCollapse = (assistantId: string) => {
    setCollapsedAssistants((prev) => ({
      ...prev,
      [assistantId]: !prev[assistantId]
    }))
  }

  const deleteTopic = useCallback(
    async (topic: Topic) => {
      await modelGenerating()

      // 如果只剩一个话题，重置为默认话题而不是删除
      if (topics.length === 1) {
        const defaultTopic = getDefaultTopic()
        const resetTopic = {
          ...defaultTopic,
          assistantId: topic.assistantId
        }

        updateTopic(resetTopic)
        setActiveTopic(resetTopic)
        return
      }

      removeTopic(topic)
    },
    [topics, removeTopic, updateTopic, setActiveTopic]
  )

  useEffect(() => {
    EventEmitter.on(EVENT_NAMES.DELETE_TOPIC, deleteTopic)

    return () => {
      EventEmitter.off(EVENT_NAMES.DELETE_TOPIC, deleteTopic)
    }
  }, [deleteTopic])

  return (
    <Container right={topicPosition === 'right'} className="topics-tab">
      <TabNavBar>
        <Tooltip title={t('topics.tab.group_by_assistant')} mouseEnterDelay={0.5}>
          <TabNavBarItem active={isGroupedByAssistant} onClick={() => setIsGroupedByAssistant(!isGroupedByAssistant)}>
            <PartitionOutlined />
          </TabNavBarItem>
        </Tooltip>
      </TabNavBar>

      {isGroupedByAssistant ? (
        <AssistantTopicsContainer>
          {assistants.map((assistant) => (
            <AssistantTopics
              key={assistant.id}
              assistant={assistant}
              isCollapsed={!!collapsedAssistants[assistant.id]}
              topicCount={assistantTopicCounts[assistant.id] || 0}
              activeTopic={activeTopic}
              setActiveTopic={setActiveTopic}
              onToggleCollapse={() => toggleAssistantCollapse(assistant.id)}
            />
          ))}
        </AssistantTopicsContainer>
      ) : (
        <div>
          <TopicList activeTopic={activeTopic} setActiveTopic={setActiveTopic} />
          <div style={{ minHeight: '10px' }}></div>
        </div>
      )}
    </Container>
  )
}

const Container = styled(Scrollbar)`
  display: flex;
  flex-direction: column;
  padding: 10px;
`

const TabNavBar = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 36px;
  padding: 0 10px;
`

const TabNavBarItem = styled.div<{ active: boolean }>`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 10px 0 10px 0;
  width: 26px;
  height: 26px;
  border-radius: 4px;
  color: ${(props) => (props.active ? 'var(--color-primary)' : 'var(--color-text-3)')};
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background-color: var(--color-background-soft);
  }
`

const AssistantTopicsContainer = styled.div`
  display: flex;
  flex-direction: column;
`

export default Topics
