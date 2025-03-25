import i18n from '@renderer/i18n'
import { Topic } from '@renderer/types'
import { uuid } from '@renderer/utils'

/**
 * 获取默认话题（用默认助手）
 * @returns 默认话题对象
 */
export function getDefaultTopic(): Topic {
  return {
    id: uuid(),
    assistantId: 'default',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    name: i18n.t('chat.default.topic.name'),
    messages: [],
    isNameManuallyEdited: false
  }
}
