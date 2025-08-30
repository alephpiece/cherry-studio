import { DownOutlined, RightOutlined } from '@ant-design/icons'
import { DraggableList } from '@renderer/components/DraggableList'
import AddAssistantPopup from '@renderer/components/Popups/AddAssistantPopup'
import Scrollbar from '@renderer/components/Scrollbar'
import { useAgents } from '@renderer/hooks/useAgents'
import { useAssistants, useDefaultAssistant } from '@renderer/hooks/useAssistant'
import { useAssistantsTabSortType } from '@renderer/hooks/useStore'
import { useTags } from '@renderer/hooks/useTags'
import { Assistant, AssistantsSortType } from '@renderer/types'
import { uuid } from '@renderer/utils'
import { Tooltip, Typography } from 'antd'
import { Plus } from 'lucide-react'
import { FC, useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import AssistantItem from './components/AssistantItem'

interface AssistantsTabProps {
  activeAssistant: Assistant
  setActiveAssistant: (assistant: Assistant) => void
}
const Assistants: FC<AssistantsTabProps> = ({ activeAssistant, setActiveAssistant }) => {
  const { assistants, removeAssistant, addAssistant, copyAssistant, updateAssistants } = useAssistants()
  const { defaultAssistant } = useDefaultAssistant()
  const [dragging, setDragging] = useState(false)
  const { addAgent } = useAgents()
  const { t } = useTranslation()
  const { getGroupedAssistants, collapsedTags, toggleTagCollapse } = useTags()
  const { assistantsTabSortType = 'list', setAssistantsTabSortType } = useAssistantsTabSortType()
  const containerRef = useRef<HTMLDivElement>(null)

  const isActiveAssistant = useCallback(
    (assistant: Assistant) => assistant.id === activeAssistant?.id,
    [activeAssistant]
  )

  const onCreateAssistant = useCallback(async () => {
    const assistant = await AddAssistantPopup.show()
    assistant && setActiveAssistant(assistant)
  }, [setActiveAssistant])

  const onCreateDefaultAssistant = useCallback(() => {
    const assistant = { ...defaultAssistant, id: uuid() }
    addAssistant(assistant)
    setActiveAssistant(assistant)
  }, [addAssistant, defaultAssistant, setActiveAssistant])

  const onDelete = useCallback(
    (assistant: Assistant) => {
      const remaining = assistants.filter((a) => a.id !== assistant.id)
      if (isActiveAssistant(assistant)) {
        const newActive = remaining[remaining.length - 1]
        newActive ? setActiveAssistant(newActive) : onCreateDefaultAssistant()
      }
      removeAssistant(assistant.id)
    },
    [assistants, isActiveAssistant, onCreateDefaultAssistant, removeAssistant, setActiveAssistant]
  )

  const handleSortByChange = useCallback(
    (sortType: AssistantsSortType) => {
      setAssistantsTabSortType(sortType)
    },
    [setAssistantsTabSortType]
  )

  const handleGroupReorder = useCallback(
    (tag: string, newGroupList: Assistant[]) => {
      let insertIndex = 0
      const newGlobal = assistants.map((a) => {
        const tags = a.tags?.length ? a.tags : [t('assistants.tags.untagged')]
        if (tags.includes(tag)) {
          const replaced = newGroupList[insertIndex]
          insertIndex += 1
          return replaced
        }
        return a
      })
      updateAssistants(newGlobal)
    },
    [assistants, t, updateAssistants]
  )

  const renderAddAssistantButton = useMemo(() => {
    return (
      <AssistantAddItem onClick={onCreateAssistant}>
        <AddItemWrapper>
          <Plus size={16} style={{ marginRight: 4, flexShrink: 0 }} />
          <Typography.Text style={{ color: 'inherit' }} ellipsis={{ tooltip: t('chat.add.assistant.title') }}>
            {t('chat.add.assistant.title')}
          </Typography.Text>
        </AddItemWrapper>
      </AssistantAddItem>
    )
  }, [onCreateAssistant, t])

  if (assistantsTabSortType === 'tags') {
    return (
      <Container className="assistants-tab" role="region" aria-label="Assistants" ref={containerRef}>
        <div style={{ marginBottom: '8px' }}>
          {getGroupedAssistants.map((group) => (
            <TagsContainer key={group.tag}>
              {group.tag !== t('assistants.tags.untagged') && (
                <GroupTitle onClick={() => toggleTagCollapse(group.tag)}>
                  <Tooltip title={group.tag}>
                    <GroupTitleName>
                      {collapsedTags[group.tag] ? (
                        <RightOutlined style={{ fontSize: '10px', marginRight: '5px' }} />
                      ) : (
                        <DownOutlined style={{ fontSize: '10px', marginRight: '5px' }} />
                      )}
                      {group.tag}
                    </GroupTitleName>
                  </Tooltip>
                  <GroupTitleDivider />
                </GroupTitle>
              )}
              {!collapsedTags[group.tag] && (
                <div>
                  <DraggableList
                    list={group.assistants}
                    onUpdate={(newList) => handleGroupReorder(group.tag, newList)}
                    onDragStart={() => setDragging(true)}
                    onDragEnd={() => setDragging(false)}>
                    {(assistant) => (
                      <AssistantItem
                        role="listitem"
                        aria-label={`Assistant: ${assistant.name}`}
                        aria-selected={isActiveAssistant(assistant)}
                        key={assistant.id}
                        assistant={assistant}
                        isActive={isActiveAssistant(assistant)}
                        sortBy={assistantsTabSortType}
                        onSwitch={setActiveAssistant}
                        onDelete={onDelete}
                        addAgent={addAgent}
                        copyAssistant={copyAssistant}
                        onCreateDefaultAssistant={onCreateDefaultAssistant}
                        handleSortByChange={handleSortByChange}
                      />
                    )}
                  </DraggableList>
                </div>
              )}
            </TagsContainer>
          ))}
        </div>
        {renderAddAssistantButton}
      </Container>
    )
  }

  return (
    <Container className="assistants-tab" role="region" aria-label="Assistants" ref={containerRef}>
      <DraggableList
        role="list"
        aria-label="Assistant list"
        list={assistants}
        onUpdate={updateAssistants}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => setDragging(false)}>
        {(assistant) => (
          <AssistantItem
            role="listitem"
            aria-label={`Assistant: ${assistant.name}`}
            aria-selected={isActiveAssistant(assistant)}
            key={assistant.id}
            assistant={assistant}
            isActive={isActiveAssistant(assistant)}
            sortBy={assistantsTabSortType}
            onSwitch={setActiveAssistant}
            onDelete={onDelete}
            addAgent={addAgent}
            copyAssistant={copyAssistant}
            onCreateDefaultAssistant={onCreateDefaultAssistant}
            handleSortByChange={handleSortByChange}
          />
        )}
      </DraggableList>
      {!dragging && renderAddAssistantButton}
      <div style={{ minHeight: 10 }}></div>
    </Container>
  )
}

// 样式组件
const Container = styled(Scrollbar)`
  display: flex;
  flex-direction: column;
  padding: 10px;
  margin-top: 3px;
`

const TagsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`

const AssistantAddItem = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  padding: 7px 12px;
  position: relative;
  padding-right: 35px;
  border-radius: var(--list-item-border-radius);
  border: 0.5px solid transparent;
  cursor: pointer;

  &:hover {
    background-color: var(--color-list-item-hover);
  }
`

const GroupTitle = styled.div`
  color: var(--color-text-2);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  height: 24px;
  margin: 5px 0;
`

const GroupTitleName = styled.div`
  max-width: 50%;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  box-sizing: border-box;
  padding: 0 4px;
  color: var(--color-text);
  font-size: 13px;
  line-height: 24px;
  margin-right: 5px;
  display: flex;
`

const GroupTitleDivider = styled.div`
  flex: 1;
  border-top: 1px solid var(--color-border);
`

const AddItemWrapper = styled.div`
  color: var(--color-text-2);
  font-size: 13px;
  display: flex;
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
`

export default Assistants
