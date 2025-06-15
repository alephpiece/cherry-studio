import store from '@renderer/store'
import { Message } from '@renderer/types'
import { FileTypes } from '@renderer/types'
import { BaseObservationSpec, BaseTraceSpec, LangfuseSettings, TraceProviderType } from '@renderer/types/trace'
import {
  findFileBlocks,
  findImageBlocks,
  getMainTextContent,
  getThinkingContent
} from '@renderer/utils/messageUtils/find'
import { Langfuse, LangfuseGenerationClient, LangfuseTraceClient } from 'langfuse'

import BaseTraceProvider from './BaseTraceProvider'

type LangfuseMessage = {
  role: 'user' | 'assistant' | 'system'
  content:
    | string
    | Array<{
        type: 'text' | 'image_url'
        text?: string
        image_url?: { url: string }
      }>
}

type LangfuseResponse = {
  output: {
    content: string
  }
  thinking?: string
  usage?: {
    completionTokens?: number
    promptTokens?: number
    totalTokens?: number
  }
  metrics?: {
    time_to_first_token_ms?: number
    completion_time_ms?: number
    thinking_time_ms?: number
    tokens_per_second?: number
  }
  metadata?: Record<string, any>
}

export default class LangfuseProvider extends BaseTraceProvider {
  protected langfuse: Langfuse
  protected settings: LangfuseSettings
  protected trace: LangfuseTraceClient | null = null
  protected generation: LangfuseGenerationClient | null = null

  constructor(provider: TraceProviderType) {
    super(provider)

    this.settings = store.getState().trace.langfuse
    this.langfuse = new Langfuse({
      baseUrl: this.settings.baseUrl,
      publicKey: this.settings.publicKey,
      secretKey: this.settings.secretKey
    })
  }

  public async createTrace(contextMessages?: Message[], spec?: BaseTraceSpec): Promise<void> {
    const formattedMessages = await this.formatContext(contextMessages ?? [])

    this.trace = this.langfuse.trace({
      name: spec?.name ?? 'CherryStudio.Message',
      input: formattedMessages,
      ...spec
    })
  }

  public async startObservation(contextMessages: Message[], spec?: BaseObservationSpec): Promise<void> {
    if (!this.trace) {
      throw new Error('Cannot start observation before trace is created')
    }

    const formattedMessages = await this.formatContext(contextMessages)

    this.generation = this.trace.generation({
      name: 'chat-completion',
      input: formattedMessages,
      ...spec
    })
  }

  public async stopObservation(messageId: string): Promise<void> {
    if (!this.generation) {
      throw new Error('Cannot stop observation before it is started')
    }

    const response = store.getState().messages.entities[messageId]

    const formattedResponse = await this.formatResponse(response)

    console.log('Raw response', response)
    console.log('formattedResponse', formattedResponse)

    this.generation.end({
      ...formattedResponse
    })

    this.trace?.update({
      ...formattedResponse
    })
  }

  public async close(): Promise<void> {
    return await this.langfuse.shutdownAsync()
  }

  /**
   * 将发送的Message数组转换为自定义格式
   */
  protected async formatContext(messages: Message[]): Promise<LangfuseMessage[]> {
    const formattedMessages: LangfuseMessage[] = []

    for (const message of messages) {
      const langfuseMessage = await this.formatMessage(message)
      formattedMessages.push(langfuseMessage)
    }

    return formattedMessages
  }

  /**
   * 将响应Message转换为自定义格式
   */
  protected async formatResponse(response: Message): Promise<LangfuseResponse> {
    const mainText = getMainTextContent(response)
    const thinking = getThinkingContent(response)

    const result: LangfuseResponse = {
      output: {
        content: mainText
      }
    }

    // 添加思考内容（如果有）
    if (thinking) {
      result.thinking = thinking
    }

    // 添加token使用信息（如果有）
    if (response.usage) {
      result.usage = {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens
      }
    }

    // 添加其他元数据
    if (response.model) {
      result.metadata = {
        model: response.model,
        assistant_id: response.assistantId,
        created_at: response.createdAt
      }
    }

    // 集成性能指标
    if (response.metrics) {
      const performance: LangfuseResponse['metrics'] = {}

      // 首个token时间
      if (response.metrics.time_first_token_millsec && response.metrics.time_first_token_millsec > 0) {
        performance.time_to_first_token_ms = response.metrics.time_first_token_millsec
      }

      // 完成时间
      if (response.metrics.time_completion_millsec && response.metrics.time_completion_millsec > 0) {
        performance.completion_time_ms = response.metrics.time_completion_millsec
      }

      // 思考时间
      if (response.metrics.time_thinking_millsec && response.metrics.time_thinking_millsec > 0) {
        performance.thinking_time_ms = response.metrics.time_thinking_millsec
      }

      // 计算tokens per second - 使用metrics中的completion_tokens或usage中的completion_tokens
      const completionTokens = response.metrics.completion_tokens || response.usage?.completion_tokens
      if (
        completionTokens &&
        completionTokens > 0 &&
        response.metrics.time_completion_millsec &&
        response.metrics.time_completion_millsec > 0
      ) {
        performance.tokens_per_second = Math.round(completionTokens / (response.metrics.time_completion_millsec / 1000))
      }

      // 只有当有性能数据时才添加performance字段
      if (Object.keys(performance).length > 0) {
        result.metrics = performance
      }
    }

    return result
  }

  /**
   * 将单个Message转换为自定义Langfuse消息格式
   */
  private async formatMessage(message: Message): Promise<LangfuseMessage> {
    const content = getMainTextContent(message)
    const fileBlocks = findFileBlocks(message)
    const imageBlocks = findImageBlocks(message)

    // 简单情况：只有文本内容
    if (fileBlocks.length === 0 && imageBlocks.length === 0) {
      return {
        role: message.role === 'system' ? 'user' : message.role,
        content
      }
    }

    // 复杂情况：多模态内容
    const parts: Array<{
      type: 'text' | 'image_url'
      text?: string
      image_url?: { url: string }
    }> = []

    if (content) {
      parts.push({ type: 'text', text: content })
    }

    // 处理图片
    for (const imageBlock of imageBlocks) {
      if (imageBlock.file) {
        const image = await window.api.file.base64Image(imageBlock.file.id + imageBlock.file.ext)
        parts.push({
          type: 'image_url',
          image_url: { url: image.data }
        })
      } else if (imageBlock.url && imageBlock.url.startsWith('data:')) {
        parts.push({
          type: 'image_url',
          image_url: { url: imageBlock.url }
        })
      }
    }

    // 处理文件（将文件内容作为文本添加）
    for (const fileBlock of fileBlocks) {
      const file = fileBlock.file
      if (!file) continue

      if ([FileTypes.TEXT, FileTypes.DOCUMENT].includes(file.type)) {
        const fileContent = await (await window.api.file.read(file.id + file.ext)).trim()
        parts.push({
          type: 'text',
          text: `File: ${file.origin_name}\n\n${fileContent}`
        })
      }
    }

    return {
      role: message.role === 'system' ? 'user' : message.role,
      content: parts
    }
  }
}
