import { expect, test } from '@playwright/test';
import { ADMIN, URLS } from '../config/test.config';

test('CRM creates a local outbox mutation when the browser goes offline', async ({ page, context }) => {
  await page.goto(URLS.FRONTEND);
  await page.getByLabel('Email address').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Good morning, welcome back/ })).toBeVisible();

  await page.getByRole('button', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  const accountName = `Offline FlowSync Account ${Date.now()}`;

  await context.setOffline(true);
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Add account' }).click();
  await page.getByLabel('Account name').fill(accountName);
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(/CRM changes are saved locally and queued for sync\./)).toBeVisible();
  await expect(page.getByText(accountName)).toBeVisible();
  await expect(page.getByText(/pending/)).toBeVisible();

  // Restore transport only for importing the Vite module used to inspect and
  // clean the test tenant; the mutation above was created while offline.
  await context.setOffline(false);
  const pendingCount = await page.evaluate(async () => {
    const module = await import('/src/offline/indexedDbStorageAdapter.ts');
    const organizationId = localStorage.getItem('flowsync.active-organization-id');
    if (!organizationId) throw new Error('Active organization was not cached');
    const adapter = new module.IndexedDbStorageAdapter();
    await adapter.open();
    const pending = await adapter.pendingOutbox(organizationId);
    await adapter.clearOrganization(organizationId);
    adapter.close();
    return pending.filter((operation) => operation.kind === 'upsert').length;
  });

  expect(pendingCount).toBeGreaterThanOrEqual(1);
});

