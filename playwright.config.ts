import { defineConfig } from "@playwright/test";

const port = Number(process.env.E2E_PORT || 43123);
const baseURL = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    channel: process.env.E2E_CHROME_PATH ? undefined : "chrome",
    launchOptions: process.env.E2E_CHROME_PATH
      ? { executablePath: process.env.E2E_CHROME_PATH }
      : undefined,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next dev -p ${port} -H 127.0.0.1`,
        url: `${baseURL}/UK`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
