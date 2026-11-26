import { defineConfig } from "@playwright/test";

const base = process.env.PAGES_BASE ?? "/solid2-pstack/";
const origin = "http://127.0.0.1:4185";

export default defineConfig({
  testDir: "./tests",
  testMatch: "tones.visual.ts",
  fullyParallel: true,
  workers: 2,
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report/market-styles", open: "never" }],
  ],
  use: {
    browserName: "chromium",
    baseURL: origin + base,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "スマホ 320px", use: { viewport: { width: 320, height: 800 } } },
    { name: "PC 1280px", use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: 'vite preview --outDir dist-pages --base "$PAGES_BASE" --host 127.0.0.1 --port 4185 --strictPort',
    env: { PAGES_BASE: base },
    url: origin + base,
  },
});
