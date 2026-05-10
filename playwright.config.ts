// SPDX-License-Identifier: Apache-2.0
import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the venous LE anatomy diagram + drawing layer
 * end-to-end tests.
 *
 * `webServer` boots `npm run dev` automatically. The dev server picks
 * the first free port starting at 3001 (vite config), so we point the
 * baseURL at 3001 and let Playwright's `webServer.url` health-check
 * the actual port.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,           // Single-encounter state needs serial execution
  workers: 1,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3001',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
