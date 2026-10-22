import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

const getBaseURL = (): string => process.env.FRONTEND_URL || 'http://127.0.0.1:3001';

export default defineConfig({
  testDir: './test/e2e-frontend',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: getBaseURL(),
    trace: 'on',
    screenshot: 'on',
    video: 'retain-on-failure',
    headless: true,
    ...devices['Desktop Chrome'],
    channel: 'chrome',
  },
});
