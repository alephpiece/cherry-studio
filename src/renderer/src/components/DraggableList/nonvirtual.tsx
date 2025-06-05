import {
  DragDropContext,
  Draggable,
  Droppable,
  DroppableProps,
  DropResult,
  OnDragEndResponder,
  OnDragStartResponder,
  ResponderProvided
} from '@hello-pangea/dnd'
import { droppableReorder } from '@renderer/utils'
import { List } from 'antd'
import { FC, memo, useMemo } from 'react'

// antd list grid 配置类型定义
interface GridConfig {
  gutter?: number
  column?: number
  xs?: number
  sm?: number
  md?: number
  lg?: number
  xl?: number
  xxl?: number
}

// 默认 grid 配置
const DEFAULT_GRID_CONFIG: GridConfig = {
  gutter: 16,
  xs: 1,
  sm: 1,
  md: 1,
  lg: 2,
  xl: 3,
  xxl: 4
}

interface Props<T> {
  list: T[]
  style?: React.CSSProperties
  listStyle?: React.CSSProperties
  children: (item: T, index: number) => React.ReactNode
  onUpdate: (list: T[]) => void
  onDragStart?: OnDragStartResponder
  onDragEnd?: OnDragEndResponder
  droppableProps?: Partial<DroppableProps>
  grid?: boolean | GridConfig
}

export const DraggableList: FC<Props<any>> = memo(
  ({ children, list, style, listStyle, droppableProps, onDragStart, onUpdate, onDragEnd, grid }) => {
    const finalGridConfig = useMemo(() => {
      if (grid === true) {
        return DEFAULT_GRID_CONFIG
      } else if (typeof grid === 'object' && grid !== null) {
        // 合并配置
        return { ...DEFAULT_GRID_CONFIG, ...grid }
      }
      return undefined
    }, [grid])

    const _onDragEnd = (result: DropResult, provided: ResponderProvided) => {
      onDragEnd?.(result, provided)
      if (result.destination) {
        const sourceIndex = result.source.index
        const destIndex = result.destination.index
        const reorderAgents = droppableReorder(list, sourceIndex, destIndex)
        onUpdate(reorderAgents)
      }
    }

    return (
      <DragDropContext onDragStart={onDragStart} onDragEnd={_onDragEnd}>
        <Droppable droppableId="droppable" {...droppableProps}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} style={style}>
              <List
                dataSource={list}
                rowKey={(item) => item.id || item}
                split={false}
                grid={finalGridConfig}
                renderItem={(item, index) => {
                  const id = item.id || item
                  return (
                    <Draggable key={`draggable_${id}_${index}`} draggableId={String(id)} index={index}>
                      {(provided) => (
                        <List.Item style={{ padding: 0, border: 'none' }}>
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{
                              ...listStyle,
                              ...provided.draggableProps.style,
                              marginBottom: finalGridConfig ? 0 : 8
                            }}>
                            {children(item, index)}
                          </div>
                        </List.Item>
                      )}
                    </Draggable>
                  )
                }}
              />
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    )
  }
)
