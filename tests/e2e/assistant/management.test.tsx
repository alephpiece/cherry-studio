import type { ElectronApplication, Page } from '@playwright/test'
import { _electron as electron, expect, test } from '@playwright/test'

let electronApp: ElectronApplication
let window: Page

// Helper to create a new assistant and wait for it to be created and active
const createAssistant = async (page: Page, assistantName: string) => {
  const assistantList = page.getByRole('list', { name: 'Assistant list' })
  const initialCount = await assistantList.getByRole('listitem').count()

  // 1. Click the "Add assistant" button
  await page.getByRole('button', { name: 'Add assistant' }).click()

  // 2. Find the search input in the modal and type the new assistant's name
  const modal = page.getByRole('dialog')
  await modal.getByRole('searchbox', { name: 'Search agent' }).fill(assistantName)

  // 3. Click the first item in the agent list, which is now the new assistant to be created
  await modal.getByRole('list', { name: 'Agent list' }).getByRole('listitem').first().click()

  // 4. Wait for the new assistant to appear in the main assistant list
  await expect(assistantList.getByRole('listitem')).toHaveCount(initialCount + 1)

  // 5. Get the newly created assistant and verify it is visible and selected
  const newAssistant = assistantList.getByRole('listitem', { name: `Assistant: ${assistantName}` })
  await expect(newAssistant).toBeVisible()
  await expect(newAssistant).toHaveAttribute('aria-selected', 'true')
  return newAssistant
}

test.beforeEach(async () => {
  electronApp = await electron.launch({ args: ['.'] })
  window = await electronApp.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  // Wait for the assistants region to be visible
  await expect(window.getByRole('region', { name: 'Assistants' })).toBeVisible()
})

test.afterEach(async () => {
  if (electronApp) {
    await electronApp.close()
  }
})

test.describe('Assistant Management', () => {
  test('should create a new custom assistant successfully', async () => {
    const assistantList = window.getByRole('list', { name: 'Assistant list' })
    const initialCount = await assistantList.getByRole('listitem').count()
    const assistantName = 'My First Assistant'

    const newAssistant = await createAssistant(window, assistantName)

    await expect(assistantList.getByRole('listitem')).toHaveCount(initialCount + 1)
    await expect(newAssistant).toHaveAttribute('aria-selected', 'true')
    expect(await newAssistant.getAttribute('aria-label')).toBe(`Assistant: ${assistantName}`)
  })

  test('should reorder assistants via drag and drop', async () => {
    const assistantList = window.getByRole('list', { name: 'Assistant list' })
    const assistantNameA = 'Assistant A'
    const assistantNameB = 'Assistant B'

    // Create two assistants to reorder
    await createAssistant(window, assistantNameA)
    await createAssistant(window, assistantNameB)
    await expect(assistantList.getByRole('listitem')).toHaveCount(3) // Including default

    const firstAssistant = assistantList.getByRole('listitem').nth(1) // nth(0) is default
    const lastAssistant = assistantList.getByRole('listitem').last()
    const firstAssistantLabel = await firstAssistant.getAttribute('aria-label')

    await firstAssistant.dragTo(lastAssistant)

    // Assert that the dragged item is now the last one
    const newLastAssistantLabel = await assistantList.getByRole('listitem').last().getAttribute('aria-label')
    expect(newLastAssistantLabel).toBe(firstAssistantLabel)
  })

  test('should delete an inactive assistant and persist the change', async () => {
    const assistantList = window.getByRole('list', { name: 'Assistant list' })
    const assistantName = 'Assistant to Delete'
    await createAssistant(window, assistantName)
    await expect(assistantList.getByRole('listitem')).toHaveCount(2)

    const inactiveAssistant = assistantList.getByRole('listitem', { selected: false }).first()
    const activeAssistant = assistantList.getByRole('listitem', { selected: true })

    const inactiveAssistantLabel = await inactiveAssistant.getAttribute('aria-label')
    const activeAssistantLabel = await activeAssistant.getAttribute('aria-label')

    await inactiveAssistant.click({ button: 'right' })
    await window.getByRole('menuitem', { name: 'Delete' }).click()
    await window.getByRole('button', { name: 'OK' }).click()

    // Verify deletion in the current session
    await expect(assistantList.getByRole('listitem', { name: inactiveAssistantLabel! })).not.toBeVisible()
    await expect(assistantList.getByRole('listitem')).toHaveCount(1)
    await expect(activeAssistant).toBeVisible()
    await expect(activeAssistant).toHaveAttribute('aria-selected', 'true')
    expect(await activeAssistant.getAttribute('aria-label')).toBe(activeAssistantLabel)

    // Verify persistence
    await electronApp.close()
    electronApp = await electron.launch({ args: ['.'] })
    window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    const persistentAssistantList = window.getByRole('list', { name: 'Assistant list' })
    await expect(persistentAssistantList.getByRole('listitem')).toHaveCount(1)
    await expect(persistentAssistantList.getByRole('listitem', { name: inactiveAssistantLabel! })).not.toBeVisible()
    const persistentActiveAssistant = persistentAssistantList.getByRole('listitem', { selected: true })
    expect(await persistentActiveAssistant.getAttribute('aria-label')).toBe(activeAssistantLabel)
  })

  test('should delete the active assistant and persist the change', async () => {
    const assistantList = window.getByRole('list', { name: 'Assistant list' })
    const assistantNameToActivate = 'Assistant to Activate'
    const assistantNameToDelete = 'Assistant to Delete'
    await createAssistant(window, assistantNameToActivate)
    await createAssistant(window, assistantNameToDelete)
    await expect(assistantList.getByRole('listitem')).toHaveCount(3)

    const newActiveAssistant = assistantList.getByRole('listitem', { name: `Assistant: ${assistantNameToActivate}` })
    const activeAssistant = assistantList.getByRole('listitem', { name: `Assistant: ${assistantNameToDelete}` })

    const newActiveAssistantLabel = await newActiveAssistant.getAttribute('aria-label')

    await activeAssistant.click({ button: 'right' })
    await window.getByRole('menuitem', { name: 'Delete' }).click()
    await window.getByRole('button', { name: 'OK' }).click()

    // Verify deletion and activation change in the current session
    await expect(activeAssistant).not.toBeVisible()
    await expect(assistantList.getByRole('listitem')).toHaveCount(2)
    const newlyActivated = assistantList.getByRole('listitem', { selected: true })
    expect(await newlyActivated.getAttribute('aria-label')).toBe(newActiveAssistantLabel)

    // Verify persistence
    await electronApp.close()
    electronApp = await electron.launch({ args: ['.'] })
    window = await electronApp.firstWindow()
    await window.waitForLoadState('domcontentloaded')

    const persistentAssistantList = window.getByRole('list', { name: 'Assistant list' })
    await expect(persistentAssistantList.getByRole('listitem')).toHaveCount(2)
    await expect(
      persistentAssistantList.getByRole('listitem', { name: `Assistant: ${assistantNameToDelete}` })
    ).not.toBeVisible()
    const persistentActiveAssistant = persistentAssistantList.getByRole('listitem', { selected: true })
    expect(await persistentActiveAssistant.getAttribute('aria-label')).toBe(newActiveAssistantLabel)
  })
})
