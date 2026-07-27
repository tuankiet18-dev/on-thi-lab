import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.CI ? 2 : 6,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
      },
    },
  ],
  webServer: {
    command:
      "npx pnpm@10.13.1 --filter @onthilab/web dev --host 127.0.0.1 --port 4173 --strictPort",
    env: {
      ...process.env,
      VITE_API_URL: "",
      VITE_COGNITO_DOMAIN: "",
      VITE_COGNITO_CLIENT_ID: "",
      VITE_COGNITO_REDIRECT_URI: "",
      VITE_COGNITO_LOGOUT_URI: "",
    },
    port: 4173,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
