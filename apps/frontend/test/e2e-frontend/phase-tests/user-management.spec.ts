import { expect, test } from '@playwright/test';
import { ADMIN, URLS } from '../config/test.config';

test('admin can create, refresh, search, and delete a user through the API-backed UI', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('401 (Unauthorized)')) {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(URLS.FRONTEND);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().startsWith(`${URLS.API}/api/v1/auth/login`) && response.request().method() === 'POST'
  );
  await page.getByLabel('Email address').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status()).toBe(200);

  const listResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/v1/users') && response.request().method() === 'GET'
  );
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
  const listResponse = await listResponsePromise;
  expect(listResponse.status()).toBe(200);

  const userName = `E2E User ${Date.now()}`;
  const userEmail = `e2e-${Date.now()}@example.com`;
  await page.getByRole('button', { name: 'New User' }).click();
  await page.getByLabel('Full Name').fill(userName);
  await page.getByLabel('Email Address').fill(userEmail);
  await page.getByLabel('Address', { exact: true }).fill('1 E2E Street');
  await page.getByLabel('College Name').fill('E2E College');
  await page.getByLabel('Birth Date').fill('1988-03-02');
  await page.getByLabel('Reading').check();
  await page.getByRole('radio', { name: 'Men', exact: true }).check();

  const createResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/users') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Create' }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.status()).toBe(201);
  await expect(page.getByText(userName)).toBeVisible();

  await page.reload();
  await expect(page.getByText(userName)).toBeVisible();
  await page.getByPlaceholder('Search user...').fill(userName);
  await expect(page.getByText(userEmail)).toBeVisible();

  const row = page.getByRole('row').filter({ hasText: userName });
  await row.getByRole('button').click();
  await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Full Name').fill(`${userName} Updated`);

  const updateResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/v1/users/') && response.request().method() === 'PATCH'
  );
  await page.getByRole('button', { name: 'Save' }).click();
  const updateResponse = await updateResponsePromise;
  expect(updateResponse.status()).toBe(200);
  await expect(page.getByText(`${userName} Updated`)).toBeVisible();

  const updatedRow = page.getByRole('row').filter({ hasText: `${userName} Updated` });
  await updatedRow.getByRole('button').click();
  await page.getByRole('menuitem', { name: /Delete/ }).click();

  const deleteResponsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/v1/users/') && response.request().method() === 'DELETE'
  );
  await page.getByRole('button', { name: 'YES' }).click();
  const deleteResponse = await deleteResponsePromise;
  expect(deleteResponse.status()).toBe(204);
  await expect(page.getByText(`${userName} Updated`)).not.toBeVisible();
  await expect(page.getByRole('menuitem', { name: /Delete/ })).not.toBeVisible();

  await page.screenshot({ path: 'test-results/user-management-final.png', fullPage: true });
  expect(consoleErrors).toEqual([]);
});
