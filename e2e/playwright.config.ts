import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against a running stack (backend :8001, frontend :5173) in demo mode.
 *   cd backend && npm run dev      cd frontend && npm run dev      cd e2e && npm test
 * Uses the installed Google Chrome (no browser download). Override with E2E_BASE_URL / E2E_API_URL.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalTeardown: './teardown.ts',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1366, height: 900 },
    trace: 'retain-on-failure'
  }
});
