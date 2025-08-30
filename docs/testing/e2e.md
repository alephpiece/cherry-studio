# E2E (端到端) 测试计划

本文档旨在为 CherryStudio 项目制定一套全面且系统化的端到端（E2E）测试策略。其目标是确保应用的质量与稳定性，同时使团队成员能够高效地参与测试用例的编写。

## 1. 技术栈与项目结构

在编写测试用例前，了解项目的技术背景和代码组织方式至关重要。

- **技术栈**:

  - **核心框架**: [Electron](https://www.electronjs.org/)，用于构建跨平台桌面应用。
  - **前端**: [React](https://react.dev/) (使用 [Vite](https://vitejs.dev/) 作为构建工具)。
  - **测试框架**: [Playwright](https://playwright.dev/) 用于 E2E 测试，[Vitest](https://vitest.dev/) 用于单元和组件测试。遵守 playwright 理念，充分利用 locator, id, role, aria-label
  - **语言**: TypeScript。

- **代码结构**:
  项目源代码位于 `src/` 目录下，主要分为三个部分：
  - **`src/main`**: Electron 的主进程代码。负责窗口管理、系统集成、后台服务和渲染进程的通信（IPC）。
  - **`src/preload`**: Preload 脚本，作为主进程和渲染进程之间的安全桥梁，暴露特定 API 给前端使用。
  - **`src/renderer`**: 渲染进程代码，即应用的前端 UI。所有 React 组件、页面、Hooks 和状态管理逻辑都位于此目录。

## 2. 测试理念与范围

E2E 测试旨在模拟真实用户的完整工作流程，是自动化测试策略中最顶层、最重要的一环。

- **E2E 测试范围**: 专注于验证跨越多个模块、涉及UI交互、主进程逻辑和持久化存储的复杂用户旅程。
- **非 E2E 测试范围**: 对于可以被隔离测试的纯业务逻辑、数据转换或单一UI组件的渲染，应优先使用**单元测试**或**组件测试**。

注意：测试名称（例如 `describe(...)` 和 `it(...)`）必须使用**英文**。

## 3. 应用核心交互模型

所有测试场景都围绕应用的核心交互模型进行组织：`助手 (Assistant) -> 主题 (Topic) -> 消息 (Message)`。

---

## 4. 按功能模块划分的测试场景

### 模块一：应用生命周期 (Lifecycle)

#### P0: 核心场景

- **`it('应能成功启动应用并显示主窗口')`**
  - **测试路径**: 启动应用 -> 验证主窗口可见且标题正确。
  - **相关代码**: `src/main/index.ts` (主窗口创建), `src/main/bootstrap.ts` (应用启动流程)
- **`it('关闭主窗口后，应用能正常退出')`**
  - **测试路径**: 启动应用 -> 点击窗口关闭按钮 -> 验证应用进程已退出。
  - **相关代码**: `src/main/index.ts` (窗口关闭事件处理)

### 模块二：助手管理 (Assistant)

测试文件路径：`tests/e2e/assistant/`

#### P0: 核心场景

- **`it('应能成功创建一个自定义助手')`**
  - **测试路径**: 点击“添加助手” -> 选择“自定义助手” -> 确认新助手出现在列表中并可激活。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/home/Tabs/AssistantsTab.tsx`
    - **逻辑**: `src/renderer/src/hooks/useAssistant.ts` (`addAssistant`)
- **`it('应能通过拖拽调整助手列表的顺序')`**
  - **测试路径**: 拖拽一个助手到新位置 -> 验证顺序更新 -> 重启应用验证顺序持久化。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/home/Tabs/AssistantsTab.tsx`
    - **组件**: `src/renderer/src/components/DraggableList/index.tsx`
    - **逻辑**: `src/renderer/src/hooks/useAssistant.ts` (`updateAssistants`)
- **`it('应能删除一个非激活的自定义助手')`**
  - **测试路径**: 创建至少两个助手 -> 激活其中一个 -> 右键点击另一个（非激活的）助手 -> 选择“删除” -> 确认 -> 验证助手从列表中消失，且当前激活的助手保持不变。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/home/Tabs/components/AssistantItem.tsx`
    - **逻辑**: `src/renderer/src/pages/home/Tabs/AssistantsTab.tsx` (`onDelete`)
    - **Hook**: `src/renderer/src/hooks/useAssistant.ts` (`removeAssistant`)
- **`it('应能删除当前激活的自定义助手')`**
  - **测试路径**: 创建至少两个助手 -> 激活其中一个 -> 右键点击当前激活的助手 -> 选择“删除” -> 确认 -> 验证助手从列表中消失，并自动激活列表中的另一个助手。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/home/Tabs/components/AssistantItem.tsx`
    - **逻辑**: `src/renderer/src/pages/home/Tabs/AssistantsTab.tsx` (`onDelete`)
    - **Hook**: `src/renderer/src/hooks/useAssistant.ts` (`removeAssistant`)

### 模块三：主题管理 (Topic)

测试文件路径：`tests/e2e/topic/`

#### P0: 核心场景

- **`it('应能在指定的助手下创建一个新的主题')`**
  - **测试路径**: 激活一个助手 -> 点击“新话题” -> 验证新主题出现并被激活。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/home/Navbar.tsx`
    - **逻辑**: `src/renderer/src/hooks/useAssistant.ts` (`addTopic`)
- **`it('应能重命名一个主题')`**
  - **测试路径**: 右键点击主题 -> 选择“编辑话题名” -> 输入新名称并回车 -> 验证名称更新。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/home/Tabs/TopicsTab.tsx`
    - **逻辑**: `src/renderer/src/hooks/useTopic.ts`, `src/renderer/src/hooks/useAssistant.ts` (`updateTopic`)
- **`it('应能通过拖拽调整主题列表顺序')`**
  - **测试路径**: 在主题列表中拖拽一个主题到新位置 -> 验证顺序更新。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/home/Tabs/TopicsTab.tsx`
    - **逻辑**: `src/renderer/src/hooks/useAssistant.ts` (`updateTopics`)
- **`it('应能移动一个主题到另一个助手下')`**
  - **测试路径**: 右键点击主题 -> 选择“移动到” -> 选择另一个助手 -> 验证主题在新助手中出现。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/home/Tabs/TopicsTab.tsx`
    - **逻辑**: `src/renderer/src/hooks/useAssistant.ts` (`moveTopic`)
- **`it('应能删除一个非激活的主题')`**
  - **测试路径**: 创建至少两个主题 -> 激活其中一个 -> 右键点击另一个（非激活的）主题 -> 选择“删除” -> 确认 -> 验证主题从列表中消失，且当前激活的主题保持不变。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/home/Tabs/TopicsTab.tsx`
    - **逻辑**: `src/renderer/src/pages/home/Tabs/TopicsTab.tsx` (`handleConfirmDelete`)
    - **Hook**: `src/renderer/src/hooks/useAssistant.ts` (`removeTopic`)
- **`it('应能删除当前激活的主题')`**
  - **测试路径**: 创建至少两个主题 -> 激活其中一个 -> 右键点击当前激活的主题 -> 选择“删除” -> 确认 -> 验证主题从列表中消失，并自动激活列表中的另一个主题。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/home/Tabs/TopicsTab.tsx`
    - **逻辑**: `src/renderer/src/pages/home/Tabs/TopicsTab.tsx` (`handleConfirmDelete`)
    - **Hook**: `src/renderer/src/hooks/useAssistant.ts` (`removeTopic`)
- **`it('删除最后一个主题时，应仅清空消息而非删除主题')`**
  - **测试路径**: 确保某个助手下只有一个主题 -> 右键点击该主题 -> 选择“删除” -> 确认 -> 验证主题依然存在，但其内容（消息列表）已被清空。
  - **相关代码**:
    - **逻辑**: `src/renderer/src/pages/home/Tabs/TopicsTab.tsx` (`handleConfirmDelete`)
    - **事件**: `src/renderer/src/services/EventService.ts` (`CLEAR_MESSAGES`)

### 模块四：聊天与消息 (Chat)

测试文件路径：`tests/e2e/chat/`

#### P0: 核心场景

- **`it('在主题中发送消息，应能成功接收到 AI 回复')`**
  - **测试路径**: 选择一个已配置好有效 API Key 的助手和主题 -> 输入文本并发送 -> 验证用户消息出现 -> 验证助手消息块最终状态为“完成”。
- **`it('对于返回的消息块，应能执行复制和重新生成操作')`**
  - **测试路径**: 悬停于助手消息块 -> 点击“复制” -> 验证剪贴板内容 -> 点击“重新生成” -> 验证消息块被替换并重新生成。

### 模块五：知识库 (Knowledge)

测试文件路径：`tests/e2e/knowledge/`

#### P0: 核心场景

- **`it('应能创建知识库并上传文件')`**
  - **测试路径**: 进入“知识库”页面 -> 创建新知识库 -> 拖拽文件上传 -> 验证文件状态为“已完成”。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/knowledge/KnowledgePage.tsx`, `src/renderer/src/pages/knowledge/components/AddKnowledgePopup.tsx`
    - **逻辑**: `src/renderer/src/hooks/useKnowledge.ts`
    - **服务**: `src/renderer/src/services/KnowledgeService.ts`
- **`it('在对话中启用知识库后，应能得到基于其内容的准确回答')`**
  - **测试路径**: 将含特定信息的知识库关联到助手 -> 启用知识库并发起提问 -> 验证回答包含特定信息及引用标识。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/home/Inputbar/Inputbar.tsx`
    - **逻辑**: `src/renderer/src/hooks/useChatContext.ts`

### 模块六：应用设置 (Settings)

测试文件路径：`tests/e2e/settings/`

#### 子模块 6.1: 服务商设置 (Provider)

- **P0: `it('应能成功添加、编辑和删除一个自定义服务商')`**

  - **测试路径**:
    1. 进入设置 -> 服务商设置 -> 点击列表底部的“添加”按钮。
    2. 在弹窗中输入服务商名称，选择类型，点击确认。
    3. 验证新的自定义服务商出现在列表中。
    4. 在新服务商上右键，选择“编辑”，修改名称并保存，验证名称已更新。
    5. 在该服务商上右键，选择“删除”，确认后验证其已从列表中消失。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/settings/ProviderSettings/index.tsx`
    - **逻辑**: `src/renderer/src/hooks/useProvider.ts`

- **P0: `it('修改 API Key 或 Host 后切换服务商应能自动保存')`**

  - **测试路径**:
    1. 选择一个服务商，在 API Key 输入框中输入 "key123"。
    2. 不做任何其他操作，直接点击左侧列表中的另一个服务商。
    3. 再次点击第一个服务商。
    4. 验证 API Key 输入框中的值仍然是 "key123"。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/settings/ProviderSettings/ProviderSetting.tsx`

- **P1: `it('应能通过弹窗管理多个 API Key')`**
  - **核心功能确认**: `ApiKeyListPopup` 组件及其子组件 (`ApiKeyList`, `ApiKeyItem`) 提供了对 API Key 的完整增删改查（CRUD）功能，并支持对 Key 的有效性进行连接检查。
  - **测试路径**:
    1. 在服务商设置页面，点击 API Key 输入框旁边的“设置”图标，打开 `ApiKeyListPopup` 弹窗。
    2. 在弹窗中，点击“新增”按钮，输入一个新的 API Key 并保存。
    3. 验证新 Key 出现在列表中。
    4. 关闭弹窗，再次打开，验证新添加的 Key 依然存在。
    5. 在弹窗中，删除一个 Key，验证其从列表中消失。
  - **相关代码**:
    - **UI**: `src/renderer/src/components/Popups/ApiKeyListPopup/popup.tsx`
    - **逻辑**: `src/renderer/src/components/Popups/ApiKeyListPopup/hook.ts`

#### 子模块 6.2: 外观设置 (Display)

- **P1: `it('应能切换主题并立即生效')`**
  - **测试路径**: 进入设置 -> 外观设置 -> 点击“暗色”主题 -> 验证应用主界面变为暗色模式。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/settings/DisplaySettings`
    - **逻辑**: `src/renderer/src/hooks/useTheme.ts`
- **P1: `it('应能调整话题列表位置')`**
  - **测试路径**: 进入设置 -> 外观设置 -> 将“话题位置”从“左侧”切换为“右侧” -> 返回主界面 -> 验证话题列表显示在界面右侧。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/settings/DisplaySettings`
    - **逻辑**: `src/renderer/src/hooks/useSettings.ts` (`setTopicPosition`)

#### 子模块 6.3: 快捷键设置 (Shortcut)

- **P1: `it('应能成功修改快捷键并使其生效')`**
  - **测试路径**: 进入设置 -> 快捷键设置 -> 修改“新建话题”快捷键 -> 保存 -> 按下新快捷键 -> 验证成功创建新话题。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/settings/ShortcutSettings.tsx`
    - **逻辑**: `src/renderer/src/hooks/useHotkeys.ts`, `src/main/services/ShortcutService.ts`

#### 子模块 6.4: 数据管理 (Data)

- **P1: `it('应能成功导入和导出应用数据')`**
  - **测试路径**: 创建一些数据 -> 进入设置 -> 通用设置 -> 数据备份 -> 点击“导出备份” -> 点击“清空并导入备份” -> 选择刚导出的文件 -> 验证数据被成功恢复。
  - **相关代码**:
    - **UI**: `src/renderer/src/pages/settings/GeneralSettings.tsx`
    - **逻辑**: `src/main/services/DataService.ts`, `src/main/ipc.ts`

## 5. 测试实施指南

- **位置**: 所有 E2E 测试代码均应放置在 `tests/e2e` 目录下，并按功能模块分子目录。
- **命名**: 测试文件应以功能模块命名，格式为 `[feature].test.tsx`。
- **工具**: 我们使用 [Playwright](https://playwright.dev/) 作为测试框架。
- **执行流程**:
  1. **构建应用**: `yarn build`
  2. **运行测试**: `yarn test:e2e`
