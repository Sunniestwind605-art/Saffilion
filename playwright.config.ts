import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  fullyParallel: true,
  // The offline knowledge and rarity indexes are intentionally large. A single
  // browser worker avoids starving animation frames on ordinary CI laptops.
  workers: 1,
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
