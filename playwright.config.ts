import { defineConfig, devices } from "@playwright/test";

const port = 4321;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    // Set PW_CHROMIUM to a chrome binary to run with a locally installed browser.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}",
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      animations: "disabled",
      // the record line under the header names the newest observation, which moves every night
      stylePath: "tests/e2e/screenshot.css",
    },
  },
  webServer: {
    command: `pnpm astro preview --port ${port}`,
    port,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "light", use: { ...devices["Desktop Chrome"], colorScheme: "light" } },
    { name: "dark", use: { ...devices["Desktop Chrome"], colorScheme: "dark" } },
    { name: "phone", use: { ...devices["Pixel 7"], colorScheme: "light" } },
  ],
});
