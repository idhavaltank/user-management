import { expect, test } from '@playwright/test';
import { ADMIN, URLS } from '../config/test.config';

test('admin can inspect the organization administration surface', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('401 (Unauthorized)')) {
      consoleErrors.push(`${message.text()} @ ${message.location().url}`);
    }
  });
  page.on('response', (response) => {
    if (response.status() === 404) consoleErrors.push(`HTTP 404: ${response.url()}`);
  });

  await page.goto(URLS.FRONTEND);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().startsWith(`${URLS.API}/api/v1/auth/login`) && response.request().method() === 'POST'
  );
  await page.getByLabel('Email address').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  expect((await loginResponsePromise).status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'User Management', level: 4 })).toBeVisible();

  await page.goto(`${URLS.FRONTEND}/admin`);
  await expect(page.getByRole('heading', { name: 'Organization administration' })).toBeVisible();
  await expect(page.getByText('Organization settings')).toBeVisible();

  for (const tabName of ['Roles & permissions', 'Teams', 'Invitations', 'Audit', 'API keys', 'Data operations']) {
    await page.getByRole('tab', { name: tabName }).click();
  }
  await expect(page.getByText('CSV import/export')).toBeVisible();
  await expect(page.getByText('Recent jobs')).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
