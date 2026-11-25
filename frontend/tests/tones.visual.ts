import { readdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";
import axe from "axe-core";

const tones = readdirSync(new URL("../src/market/tones/", import.meta.url))
  .filter((file) => file.endsWith(".css"))
  .map((file) => file.slice(0, -4));
const product = "森色のマグ";
const event = "器のお手入れ会";

async function inspectScreen(page: Page, testInfo: TestInfo, screen: string) {
  await test.step(screen, async () => {
    await page.evaluate(async () => {
      await document.fonts.ready;
      window.scrollTo(0, 0);
    });
    await testInfo.attach(screen, {
      body: await page.screenshot({ animations: "disabled" }),
      contentType: "image/png",
    });

    const overflow = await page.evaluate(() => {
      const width = document.documentElement.clientWidth;
      const clipped = [...document.querySelectorAll<HTMLElement>(
        "header button, main button, main h1, main h2, main h3, .product-card, .town-event, .town-list > li",
      )].filter((element) => {
        const { left, right, height } = element.getBoundingClientRect();
        if (!height) return false;
        return left < -1 || right > width + 1 || element.scrollWidth > element.clientWidth + 1;
      }).map((element) => element.getAttribute("aria-label") ?? element.textContent?.trim());
      return {
        page: Math.max(0, document.documentElement.scrollWidth - width),
        clipped,
      };
    });
    expect.soft(overflow, `${screen}でコンテンツが横にはみ出さない`).toEqual({ page: 0, clipped: [] });

    const gutters = await page.locator(".town-events:visible, .town-saved:visible").evaluateAll((grids) =>
      grids.map((grid) => {
        const first = grid.children[0].getBoundingClientRect();
        const second = grid.children[1].getBoundingClientRect();
        return Math.max(second.left - first.right, second.top - first.bottom);
      }),
    );
    for (const gutter of gutters) {
      expect.soft(gutter, `${screen}の項目間の余白`).toBeGreaterThanOrEqual(12);
    }

    const violations = await page.evaluate(async () => {
      const { violations } = await window.axe.run();
      return violations.map(({ id, nodes }) => ({
        id,
        nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      }));
    });
    expect.soft(violations, `${screen}のコントラストとアクセシビリティ`).toEqual([]);
  });
}

for (const tone of tones) {
  test(tone, async ({ page }, testInfo) => {
    await page.addInitScript((value) => localStorage.setItem("yorimichi-tone-v1", value), tone);
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("data-market-tone", tone);
    await expect(page.getByRole("heading", { name: product, exact: true })).toBeVisible();
    await expect.poll(() => page.locator(".hero img").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await page.addScriptTag({ content: axe.source });

    await page.getByRole("button", { name: `${product}を保存` }).click();
    await inspectScreen(page, testInfo, "商品一覧");

    await page.getByRole("button", { name: "街", exact: true }).click();
    await page.getByRole("button", { name: `${event}の参加予定` }).click();
    await inspectScreen(page, testInfo, "街のイベント");

    await page.getByRole("tab", { name: "保存リスト" }).click();
    await expect(page.getByRole("heading", { name: product, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: event, exact: true })).toBeVisible();
    await inspectScreen(page, testInfo, "保存リスト");
  });
}
