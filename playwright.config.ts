import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
/** 公開済みのサイトを確かめるとき: BASE_URL=https://daisuke-awaji.github.io/soccer8-referee-quiz/ npm run e2e */
const BASE_URL = process.env.BASE_URL;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL ?? `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      // ヘッドレスでも 3D（WebGL）を描けるように、ソフトウェア描画を使う
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  projects: [
    { name: 'phone-small', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { name: 'phone', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
    { name: 'phone-landscape', use: { ...devices['Desktop Chrome'], viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } },
  ],
  webServer: BASE_URL
    ? undefined
    : {
        command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
