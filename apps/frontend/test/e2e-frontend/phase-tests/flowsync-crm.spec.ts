import { expect, test } from '@playwright/test';
import { ADMIN, URLS } from '../config/test.config';

test('admin can use the FlowSync online CRM foundation', async ({ page }) => {
  const failures: string[] = [];
  page.on('console', (message) => {
    // The invalid-file journey intentionally produces a browser-level 422
    // resource error; the API response assertion below verifies that case.
    if (
      message.type() === 'error'
      && !message.text().includes('401 (Unauthorized)')
      && !message.text().includes('status of 422 (Unprocessable Entity)')
    ) {
      failures.push(message.text());
    }
  });
  page.on('requestfailed', (request) => failures.push(`request failed: ${request.url()}`));
  page.on('dialog', (dialog) => dialog.accept());

  await page.goto(URLS.FRONTEND);
  await page.getByLabel('Email address').fill(ADMIN.email);
  await page.getByLabel('Password').fill(ADMIN.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: /Good morning, welcome back/ })).toBeVisible();
  await page.getByRole('button', { name: 'Open sync diagnostics' }).click();
  await expect(page.getByRole('dialog', { name: 'Sync diagnostics' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();

  const dashboardResponse = page.waitForResponse(
    (response) => response.url().includes('/crm/dashboard') && response.request().method() === 'GET'
  );
  await page.reload();
  expect((await dashboardResponse).status()).toBe(200);

  await page.getByRole('button', { name: 'Accounts' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();
  await page.getByRole('button', { name: 'Add account' }).click();
  const accountName = `FlowSync Browser Account ${Date.now()}`;
  await page.getByLabel('Account name').fill(accountName);
  const createResponse = page.waitForResponse(
    (response) => response.url().includes('/accounts') && response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: 'Save' }).click();
  expect((await createResponse).status()).toBe(201);
  await expect(page.getByText(accountName)).toBeVisible();

  await page.getByRole('row').filter({ hasText: accountName }).click();
  await expect(page.getByRole('heading', { name: 'Account detail' })).toBeVisible();
  await expect(page.getByText('Profile image', { exact: true })).toBeVisible();

  // A valid 32x32 orange PNG makes the successful upload visually distinct
  // in the captured browser artifact, not merely MIME/signature-valid.
  const validPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAL0lEQVR4nO3OIQEAAAgDMCKRkJT0gRg3E/Ornb6kEhAQEBAQEBAQEBAQEBAQSAcepZwEl/4vsXsAAAAASUVORK5CYII=',
    'base64',
  );
  const uploadResponse = page.waitForResponse(
    (response) => response.url().includes('/profile-image') && response.request().method() === 'POST'
  );
  const accountImageResponse = page.waitForResponse(
    (response) => response.url().includes('/profile-image') && response.request().method() === 'GET'
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: 'account.png',
    mimeType: 'image/png',
    buffer: validPng,
  });
  expect((await uploadResponse).status()).toBe(200);
  expect((await accountImageResponse).status()).toBe(200);
  await expect(page.locator('img[alt="Profile image"]')).toHaveAttribute('src', /profile-image/);
  await page.screenshot({ path: 'test-results/profile-image-upload.png', fullPage: true });

  const invalidUploadResponse = page.waitForResponse(
    (response) => response.url().includes('/profile-image') && response.request().method() === 'POST'
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: 'not-an-image.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('not-an-image'),
  });
  expect((await invalidUploadResponse).status()).toBe(422);
  await expect(page.getByText(/supported image|JPEG, PNG, and WebP/i)).toBeVisible();

  const deleteImageResponse = page.waitForResponse(
    (response) => response.url().includes('/profile-image') && response.request().method() === 'DELETE'
  );
  await page.getByRole('button', { name: 'Remove' }).click();
  expect((await deleteImageResponse).status()).toBe(204);
  await expect(page.locator('img[alt="Profile image"]')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/profile-image-removed.png', fullPage: true });
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible();

  await page.getByRole('button', { name: 'Contacts' }).click();
  await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible();
  const contactRow = page.getByRole('row').nth(1);
  await expect(contactRow).toBeVisible();
  await contactRow.click();
  await expect(page.getByRole('heading', { name: 'Contact detail' })).toBeVisible();
  const contactUploadResponse = page.waitForResponse(
    (response) => response.url().includes('/profile-image') && response.request().method() === 'POST'
  );
  const contactImageResponse = page.waitForResponse(
    (response) => response.url().includes('/profile-image') && response.request().method() === 'GET'
  );
  await page.locator('input[type="file"]').setInputFiles({
    name: 'contact.png',
    mimeType: 'image/png',
    buffer: validPng,
  });
  expect((await contactUploadResponse).status()).toBe(200);
  expect((await contactImageResponse).status()).toBe(200);
  await expect(page.locator('img[alt="Profile image"]')).toHaveAttribute('src', /profile-image/);
  await page.screenshot({ path: 'test-results/contact-profile-image-upload.png', fullPage: true });

  const contactDeleteImageResponse = page.waitForResponse(
    (response) => response.url().includes('/profile-image') && response.request().method() === 'DELETE'
  );
  await page.getByRole('button', { name: 'Remove' }).click();
  expect((await contactDeleteImageResponse).status()).toBe(204);
  await expect(page.locator('img[alt="Profile image"]')).toHaveCount(0);
  await page.getByRole('button', { name: '← Back' }).click();
  await expect(page.getByRole('heading', { name: 'Contacts', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Deals' }).click();
  await expect(page.getByRole('heading', { name: 'Deals', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Activities' }).click();
  await expect(page.getByRole('heading', { name: 'Activities', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Accounts' }).click();
  const row = page.getByRole('row').filter({ hasText: accountName });
  const deleteResponse = page.waitForResponse(
    (response) => response.url().includes('/accounts/') && response.request().method() === 'DELETE'
  );
  await row.getByRole('button', { name: 'Delete' }).click();
  expect((await deleteResponse).status()).toBe(204);
  await expect(page.getByText(accountName)).not.toBeVisible();
  expect(failures).toEqual([]);
});
