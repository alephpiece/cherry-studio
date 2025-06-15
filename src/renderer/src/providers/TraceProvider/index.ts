import Logger from '@renderer/config/logger'
import { Message } from '@renderer/types'
import { BaseObservationSpec, BaseTraceSpec, TraceProviderType } from '@renderer/types/trace'

import BaseTraceProvider from './BaseTraceProvider'
import TraceProviderFactory from './TraceProviderFactory'

export default class TraceProvider {
  private sdk: BaseTraceProvider

  constructor(provider: TraceProviderType) {
    this.sdk = TraceProviderFactory.create(provider)
  }

  public createTrace(contextMessages?: Message[], spec?: BaseTraceSpec): Promise<void> {
    try {
      return this.sdk.createTrace(contextMessages, spec)
    } catch (error) {
      Logger.warn('Failed to create trace:', error)
      return Promise.resolve()
    }
  }

  public startObservation(contextMessages: Message[], spec?: BaseObservationSpec): Promise<void> {
    try {
      return this.sdk.startObservation(contextMessages, spec)
    } catch (error) {
      Logger.warn('Failed to start observation:', error)
      return Promise.resolve()
    }
  }

  public stopObservation(messageId: string): Promise<void> {
    try {
      return this.sdk.stopObservation(messageId)
    } catch (error) {
      Logger.warn('Failed to stop observation:', error)
      return Promise.resolve()
    }
  }

  public close(): Promise<void> {
    try {
      return this.sdk.close()
    } catch (error) {
      Logger.warn('Failed to close trace provider:', error)
      return Promise.resolve()
    }
  }
}
