import { expect, test } from '@playwright/test';
import { URLS } from '../config/test.config';

test('Chrome can use the FlowSync IndexedDB adapter for local CRM data and outbox state', async ({ page }) => {
  await page.goto(URLS.FRONTEND);

  const result = await page.evaluate(async () => {
    const module = await import('/src/offline/indexedDbStorageAdapter.ts');
    const adapter = new module.IndexedDbStorageAdapter();
    await adapter.open();
    const organizationId = `browser-organization-${Date.now()}`;
    await adapter.writeLocal('accounts', {
      id: 'browser-account-1',
      organizationId,
      name: 'Browser account',
      status: 'prospect',
      createdAt: '2026-10-23T00:00:00.000Z',
      updatedAt: '2026-10-23T00:00:00.000Z',
    }, {
      operationId: 'browser-operation-1',
      deviceId: 'browser-device-1',
      organizationId,
      entity: 'accounts',
      entityId: 'browser-account-1',
      kind: 'upsert',
      changes: { name: 'Browser account' },
      schemaVersion: 1,
    });

    const records = await adapter.list('accounts', organizationId);
    const pending = await adapter.pendingOutbox(organizationId);
    await adapter.acknowledgeOutbox('browser-operation-1');
    const acknowledged = await adapter.pendingOutbox(organizationId);
    await adapter.clearOrganization(organizationId);
    adapter.close();

    return {
      recordName: records[0]?.name,
      pendingOperation: pending[0]?.operationId,
      acknowledgedCount: acknowledged.length,
    };
  });

  expect(result).toEqual({
    recordName: 'Browser account',
    pendingOperation: 'browser-operation-1',
    acknowledgedCount: 0,
  });
});

