import { _electron as electron, type ElectronApplication, expect, type Page, test } from '@playwright/test'

let electronApp: ElectronApplication
let window: Page

test.beforeEach(async () => {
  electronApp = await electron.launch({ args: ['.'] })
  window = await electronApp.firstWindow()
  await window.waitForLoadState('domcontentloaded')
  await window.waitForLoadState('networkidle')
})

test.afterEach(async () => {
  await electronApp.close()
})

test.describe('App Lifecycle', () => {
  test('should launch the app successfully and display the main window', async () => {
    expect(window).toBeDefined()
    expect(await window.title()).toBe('Cherry Studio')
    await expect(window.getByRole('region', { name: 'Chat' })).toBeVisible()
  })

  test('should exit normally after closing the main window', async () => {
    await window.close()
    await electronApp.waitForEvent('close')
  })
})
