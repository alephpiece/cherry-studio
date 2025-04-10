import remarkParse from 'remark-parse'
import remarkStringify from 'remark-stringify'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

// 更彻底的查找方法，递归搜索所有子元素
export const findCitationInChildren = (children) => {
  if (!children) return null

  // 直接搜索子元素
  for (const child of Array.isArray(children) ? children : [children]) {
    if (typeof child === 'object' && child?.props?.['data-citation']) {
      return child.props['data-citation']
    }

    // 递归查找更深层次
    if (typeof child === 'object' && child?.props?.children) {
      const found = findCitationInChildren(child.props.children)
      if (found) return found
    }
  }

  return null
}

/**
 * 更新Markdown字符串中的代码块内容
 * @param content 原始Markdown字符串
 * @param index 代码块索引，从0开始
 * @param newContent 修改后的代码内容
 * @returns 替换后的Markdown字符串
 */
export function updateCodeBlock(content: string, index: number, newContent: string): string {
  const tree = unified().use(remarkParse).parse(content)

  let count = 0
  visit(tree, 'code', (node) => {
    if (count === index) {
      node.value = newContent
    }
    count++
  })

  return unified().use(remarkStringify).stringify(tree)
}
