import { loggerService } from '@logger'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import FileManager from '@renderer/services/FileManager'
import { checkRateLimit, getUserMessage } from '@renderer/services/MessagesService'
import { spanManagerService } from '@renderer/services/SpanManagerService'
import { estimateUserPromptUsage } from '@renderer/services/TokenService'
import store from '@renderer/store'
import { updateAssistantTodo } from '@renderer/store/assistants'
import { selectMessagesForTopic } from '@renderer/store/newMessage'
import { selectActiveTodoExecutorSet } from '@renderer/store/runtime'
import { sendMessage as _sendMessage } from '@renderer/store/thunk/messageThunk'
import { TodoAction, TodoStatus, type UserMessageTodo } from '@renderer/types/todos'

const logger = loggerService.withContext('AssistantTodoService')

/**
 * AssistantTodoService manages the execution of assistant todos
 * It processes pending todos and executes them based on their type
 */
export class AssistantTodoService {
  private static instance: AssistantTodoService
  private inFlight = new Set<string>() // key: `${assistantId}:${topicId}`

  private constructor() {
    return
  }

  /**
   * Get the singleton instance of AssistantTodoService
   */
  public static getInstance(): AssistantTodoService {
    if (!AssistantTodoService.instance) {
      AssistantTodoService.instance = new AssistantTodoService()
    }
    return AssistantTodoService.instance
  }

  /**
   * Get the key for tracking in-flight todos
   */
  private getKey(assistantId: string, topicId: string): string {
    return `${assistantId}:${topicId}`
  }

  /**
   * Process the next pending todo for a specific assistant and topic
   */
  public async processNext(assistantId: string, topicId: string): Promise<void> {
    const key = this.getKey(assistantId, topicId)
    if (this.inFlight.has(key)) return
    this.inFlight.add(key)

    const state = store.getState()
    const active = selectActiveTodoExecutorSet(state)
    if (!active.has(assistantId)) {
      this.inFlight.delete(key)
      return
    }
    const assistant = (state.assistants.assistants || []).find((a) => a.id === assistantId)
    const todosByAssistant = assistant?.todos
    const list = todosByAssistant?.[topicId] || []
    const next = list.find((t) => t.action === TodoAction.SendMessage && t.status === TodoStatus.Pending) as
      | UserMessageTodo
      | undefined

    if (!next) {
      // No pending todo: release the in-flight flag immediately
      this.inFlight.delete(key)
      return
    }

    try {
      if (checkRateLimit(next.assistant)) {
        // Backoff and retry current topic chain later
        setTimeout(() => this.processNext(assistantId, topicId), 2000)
        return
      }

      // mark processing
      store.dispatch(
        updateAssistantTodo({ assistantId, topicId, todoId: next.id, changes: { status: TodoStatus.Processing } })
      )

      // UserMessageTodo
      if (next.action === TodoAction.SendMessage) {
        // upload files lazily
        const uploadedFiles = await FileManager.uploadFiles(next.context.message.files || [])

        const baseUserMessage = {
          assistant: next.assistant,
          topic: next.context.topic,
          content: next.context.message.content,
          files: uploadedFiles || undefined,
          mentions: next.context.message.mentions,
          messageId: next.context.message.id,
          usage: await estimateUserPromptUsage({
            content: next.context.message.content,
            files: uploadedFiles || undefined
          })
        }

        const parent = spanManagerService.startTrace(
          { topicId, name: next.action, inputs: baseUserMessage.content },
          baseUserMessage.mentions && baseUserMessage.mentions.length > 0
            ? baseUserMessage.mentions
            : next.assistant.model
              ? [next.assistant.model]
              : []
        )

        const { message, blocks } = getUserMessage(baseUserMessage)
        message.traceId = parent?.spanContext().traceId

        EventEmitter.emit(EVENT_NAMES.SEND_MESSAGE, { topicId: topicId, traceId: message.traceId })

        // Await full completion (queue drains in sendMessage's finally)
        await store.dispatch(_sendMessage(message, blocks, next.assistant, topicId))

        // Wait until all assistant messages for this askId are completed (success or error)
        const askId = message.id
        await this.waitForAskIdCompletion(topicId, askId, undefined, 250)
      }

      // done -> mark as completed (do not remove)
      store.dispatch(
        updateAssistantTodo({ assistantId, topicId, todoId: next.id, changes: { status: TodoStatus.Done } })
      )
    } catch (error) {
      logger.error('Failed to process todo', error as Error)
      // mark failed
      store.dispatch(
        updateAssistantTodo({
          assistantId,
          topicId,
          todoId: next.id || 'unknown',
          changes: { status: TodoStatus.Failed, error: error as Error }
        })
      )
    } finally {
      // Release in-flight and immediately try to process the subsequent pending todo
      this.inFlight.delete(this.getKey(assistantId, topicId))
      // Chain next if any
      try {
        const stateAfter = store.getState()
        const assistantAfter = (stateAfter.assistants.assistants || []).find((a) => a.id === assistantId)
        const listAfter = assistantAfter?.todos?.[topicId] || []
        const hasPending = listAfter.some((t) => t.status === 'pending')
        if (hasPending) {
          // Fire-and-forget; guard inFlight prevents overlap
          this.processNext(assistantId, topicId)
        }
      } catch (_) {
        // swallow
      }
    }
  }

  /**
   * Wait until all assistant messages for the askId are no longer in-progress states
   */
  private async waitForAskIdCompletion(topicId: string, askId: string, timeoutMs?: number, intervalMs = 300) {
    const start = Date.now()
    const isInProgressStatus = (status?: string) => !!status && status.includes('ing')

    // If timeoutMs is undefined, wait indefinitely until completion
    while (timeoutMs === undefined || Date.now() - start < timeoutMs) {
      const state = store.getState()
      const all = selectMessagesForTopic(state, topicId)
      const assistants = all.filter((m) => m && m.role === 'assistant' && m.askId === askId)
      // Wait if no assistant messages have been generated yet
      if (assistants.length === 0) {
        await new Promise((r) => setTimeout(r, intervalMs))
        continue
      }
      const anyInProgress = assistants.some((m) => isInProgressStatus(m.status))
      if (!anyInProgress) return
      await new Promise((r) => setTimeout(r, intervalMs))
    }
    // timeout: treat as completion to avoid deadlock
  }
}

// Export singleton instance
export default AssistantTodoService.getInstance()
