import { expect, test } from "@playwright/test";
import axe from "axe-core";

declare global {
  interface Window {
    axe: typeof axe;
  }
}

for (const state of ["off", "on"] as const) {
  test(`通知が ${state} の Story を視覚とアクセシビリティの両面で確認する`, async ({ page }, testInfo) => {
    await page.goto(`/iframe.html?id=settings-notifications--${state}&viewMode=story`);
    const region = page.getByRole("region", { name: "通知設定" });
    await expect(region.getByRole("button", { name: "通知を受け取る" })).toHaveAttribute(
      "aria-pressed",
      String(state === "on"),
    );

    await page.addScriptTag({ content: axe.source });
    const violations = await page.evaluate(async () => {
      return (await window.axe.run("#storybook-root")).violations;
    });
    expect(violations).toEqual([]);

    await expect(region.getByTestId("notification-indicator")).toHaveScreenshot(`indicator-${state}.png`);
    await testInfo.attach(`notifications-${state}`, {
      body: await region.screenshot(),
      contentType: "image/png",
    });
  });
}
