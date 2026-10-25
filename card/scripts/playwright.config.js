import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "../tests/browser",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
