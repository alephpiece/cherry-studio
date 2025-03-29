import { useAssistants } from '@renderer/hooks/useAssistant'
import { useSettings } from '@renderer/hooks/useSettings'
import { useActiveTopic } from '@renderer/hooks/useTopic'
import NavigationService from '@renderer/services/NavigationService'
import { useAppDispatch } from '@renderer/store'
import { setActiveTopic as setActiveTopicAction } from '@renderer/store/topics'
import { Assistant } from '@renderer/types'
import { FC, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import styled from 'styled-components'

import Chat from './Chat'
import Navbar from './Navbar'
import HomeTabs from './Tabs'

let _selectedAssistant: Assistant | null

const HomePage: FC = () => {
  const { assistants } = useAssistants()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()

  const location = useLocation()
  const state = location.state

  const { activeTopic, setActiveTopic } = useActiveTopic()

  const activeAssistant = useMemo(
    () =>
      activeTopic?.assistantId
        ? assistants.find((a) => a.id === activeTopic.assistantId) || assistants[0]
        : assistants[0],
    [activeTopic, assistants]
  )

  const { showAssistants, showTopics, topicPosition } = useSettings()

  // 兼容旧版本，仅仅用于筛选话题
  const [selectedAssistant, setSelectedAssistant] = useState(state?.assistant || _selectedAssistant || null)

  _selectedAssistant = selectedAssistant

  useEffect(() => {
    NavigationService.setNavigate(navigate)
  }, [navigate])

  useEffect(() => {
    state?.topic && dispatch(setActiveTopicAction(state.topic))
  }, [state, dispatch])

  useEffect(() => {
    const canMinimize = topicPosition == 'left' ? !showAssistants : !showAssistants && !showTopics
    window.api.window.setMinimumSize(canMinimize ? 520 : 1080, 600)

    return () => {
      window.api.window.resetMinimumSize()
    }
  }, [showAssistants, showTopics, topicPosition])

  return (
    <Container id="home-page">
      <Navbar activeTopic={activeTopic} />
      <ContentContainer id="content-container">
        {showAssistants && (
          <HomeTabs
            selectedAssistant={selectedAssistant}
            setSelectedAssistant={setSelectedAssistant}
            activeAssistant={activeAssistant}
            activeTopic={activeTopic}
            setActiveTopic={setActiveTopic}
            position="left"
          />
        )}
        <Chat assistant={activeAssistant} activeTopic={activeTopic} setActiveTopic={setActiveTopic} />
        {topicPosition === 'right' && showTopics && (
          <HomeTabs
            selectedAssistant={selectedAssistant}
            setSelectedAssistant={setSelectedAssistant}
            activeAssistant={activeAssistant}
            activeTopic={activeTopic}
            setActiveTopic={setActiveTopic}
            position="right"
          />
        )}
      </ContentContainer>
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  max-width: calc(100vw - var(--sidebar-width));
`

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  overflow: hidden;
`

export default HomePage
