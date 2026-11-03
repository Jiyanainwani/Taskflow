import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'

test('user can sign up, sign in, create a task, and see it in a second tab', async ({
  page,
  context,
}) => {
  const email = `week4-${randomUUID()}@example.com`
  const password = 'TaskFlow-Playwright-Password-123!'
  const taskTitle = `Realtime acceptance ${randomUUID()}`

  await page.goto('/auth/signup')
  await page.getByLabel('Name').fill('Week Four E2E')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/auth\/login\?registered=1/)

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.getByRole('heading', { name: 'Tasks' })).toBeVisible()

  const secondTab = await context.newPage()
  await secondTab.goto('/dashboard')
  await expect(secondTab.getByRole('heading', { name: 'Tasks' })).toBeVisible()

  await page.getByLabel(/Title/).fill(taskTitle)
  await page.getByRole('button', { name: 'Create Task' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Task created successfully.' })).toBeVisible()
  await expect(secondTab.getByText(taskTitle, { exact: true })).toBeVisible({ timeout: 15_000 })
})
