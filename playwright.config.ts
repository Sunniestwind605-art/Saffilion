import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // The Phase 3 knowledge index is intentionally large. Bound parallel browser
  // contexts so CI and ordinary laptops do not duplicate it across many workers.
  workers: 2,
  retries: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173/Saffilion/', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm run build && pnpm exec vite preview --host 127.0.0.1', port: 4173, reuseExistingServer: true, timeout: 120000 },
  projects: [
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'] } },
    { name: 'desktop-chrome', use: { ...devices['Desktop Chrome'] } },
  ],
});
