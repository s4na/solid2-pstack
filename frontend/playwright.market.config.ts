import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "market.e2e.ts",
  timeout: 45_000,
  use: {
    browserName: "chromium",
    baseURL: process.env.MARKET_URL ?? "http://127.0.0.1:8088",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
