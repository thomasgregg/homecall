import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
  use: { viewport: { width: 800, height: 700 } },
  reporter: "list",
});
