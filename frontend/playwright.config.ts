import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  fullyParallel: true,
  updateSnapshots: "none",
  use: {
    browserName: "chromium",
    viewport: { width: 800, height: 600 },
    deviceScaleFactor: 1,
    screenshot: "only-on-failure",
  },
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  webServer: [
    {
      command: "vite preview --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173/",
    },
    {
      command: "vite preview --outDir storybook-static --host 127.0.0.1 --port 4174 --strictPort",
      url: "http://127.0.0.1:4174/",
    },
  ],
  projects: [
    { name: "app", testMatch: "app.spec.ts", use: { baseURL: "http://127.0.0.1:4173" } },
    { name: "storybook", testMatch: "storybook.spec.ts", use: { baseURL: "http://127.0.0.1:4174" } },
  ],
});
