import MermaidPreview from './MermaidPreview'
import PlantUmlPreview from './PlantUmlPreview'
import SvgPreview from './SvgPreview'

/**
 * 特殊视图语言列表
 */
export const SPECIAL_VIEWS = ['mermaid', 'plantuml', 'svg']

/**
 * 特殊视图组件映射表
 */
export const SPECIAL_VIEW_COMPONENTS = {
  mermaid: MermaidPreview,
  plantuml: PlantUmlPreview,
  svg: SvgPreview
} as const
