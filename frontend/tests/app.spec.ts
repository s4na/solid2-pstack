import { expect, test } from "@playwright/test";

test("キーボードだけで通知をオンにしてからリセットできる", async ({ page }) => {
  await page.goto("/notification-demo");
  const toggle = page.getByRole("button", { name: "通知を受け取る" });
  const reset = page.getByRole("button", { name: "リセット" });
  const status = page.getByRole("status");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");

  await page.keyboard.press("Tab");
  await expect(toggle).toBeFocused();
  await page.keyboard.press("Space");
  await expect(status).toHaveText("通知はオンです");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("Tab");
  await expect(reset).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(status).toHaveText("通知はオフです");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});

test("ページを開き直すと通知は初期状態に戻る", async ({ page }) => {
  await page.goto("/notification-demo");
  const toggle = page.getByRole("button", { name: "通知を受け取る" });

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
});
