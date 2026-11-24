import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";

async function signUp(scope: Page | Locator, role: "購入者" | "出店者", label: string, email: string) {
  await scope.getByRole("button", { name: "新規登録" }).click();
  await scope.getByLabel("名前", { exact: true }).fill(label);
  await scope.getByLabel("メールアドレス").fill(email);
  await scope.getByLabel("パスワード").fill("test-marketplace-password");
  await scope.getByRole("button", { name: `${role}として登録する` }).click();
}

async function publish(page: Page, token: string, product: string, price: string) {
  await signUp(page, "出店者", `検証出店者 ${token}`, `seller-${token}@example.test`);
  await page.getByLabel("お店の名前").fill(`検証商店 ${token}`);
  await page.getByLabel("お店の紹介").fill("ローカルで購入の流れを確認するお店です。");
  await page.getByRole("button", { name: "出店する", exact: true }).click();
  await page.getByLabel("商品名", { exact: true }).fill(product);
  await page.getByLabel("商品説明").fill("注文の動作確認用に登録した商品です。");
  await page.getByLabel("カテゴリ").selectOption("table");
  await page.getByLabel("価格（円）").fill(price);
  await page.getByLabel("在庫（点）").fill("3");
  await page.getByRole("button", { name: "商品を公開する" }).click();
  await expect(page.getByText("商品を公開しました。")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: product })).toContainText("在庫 3 点");
}

test("別々のお店で商品を公開し、購入者がまとめて注文できる", async ({ page }) => {
  const token = randomUUID().slice(0, 8);
  const cup = `検証カップ ${token}`;
  const plate = `検証プレート ${token}`;
  await page.goto("/");
  await page.getByRole("button", { name: "出店者ページ" }).click();
  await publish(page, token + "-a", cup, "2600");
  await page.getByRole("button", { name: "ログアウト" }).click();
  await publish(page, token + "-b", plate, "1450");
  await page.getByRole("spinbutton", { name: `${plate}の新しい在庫` }).fill("4");
  await page.getByRole("button", { name: "更新", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: plate })).toContainText("在庫 4 点");

  await page.getByRole("button", { name: "商品", exact: true }).click();
  await page.getByRole("searchbox", { name: "商品やお店を検索" }).fill(token);
  await page.getByRole("checkbox", { name: `${cup}を選択` }).check();
  await page.getByRole("checkbox", { name: `${plate}を選択` }).check();
  await page.getByRole("button", { name: "選択した商品をカートに入れる（2）" }).click();

  await page.getByRole("button", { name: /^カート/ }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: `${plate}の数量を増やす` }).click();
  await drawer.getByRole("button", { name: "購入手続きへ" }).click();
  await expect(drawer.getByRole("heading", { name: "購入者アカウント" })).toBeVisible();
  await signUp(drawer, "購入者", `検証購入者 ${token}`, `buyer-${token}@example.test`);
  await drawer.getByLabel("郵便番号").fill("1000001");
  await drawer.getByLabel("住所").fill("東京都千代田区千代田1");
  await expect(drawer.getByText("￥5,500")).toBeVisible();
  await drawer.getByRole("button", { name: "注文を確定する" }).click();
  await expect(drawer.getByRole("heading", { name: "注文が確定しました" })).toBeVisible();
  const order = await drawer.getByText(/^注文 #/).innerText();
  await expect(drawer.getByText("3点 ・ ￥5,500")).toBeVisible();
  console.log(`${order} / 2店舗 / 3点 / ￥5,500`);

  await drawer.getByRole("button", { name: "注文履歴を見る" }).click();
  await expect(page.getByRole("heading", { name: "注文履歴" })).toBeVisible();
  await expect(page.getByText(order, { exact: true })).toBeVisible();
  await expect(page.getByText(cup, { exact: false })).toBeVisible();
  await expect(page.getByText(plate, { exact: false })).toBeVisible();
  await expect(page.getByText("〒100-0001 東京都千代田区千代田1")).toBeVisible();

  let releaseSession = () => {};
  const delayedSession = new Promise<void>((resolve) => { releaseSession = resolve; });
  await page.route("**/api/session", async (route) => {
    await delayedSession;
    await route.continue();
  }, { times: 1 });
  try {
    await page.reload();
    await page.getByRole("button", { name: "出店者ページ" }).click();
  } finally {
    releaseSession();
  }
  await expect(page.getByRole("heading", { name: `検証商店 ${token}-b` })).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "在庫 2 点" })).toContainText(plate);
  await expect(page.getByText(order, { exact: true })).toBeVisible();
  const sellerOrder = page.locator(".order-card").filter({ hasText: order });
  await expect(sellerOrder).toContainText(plate);
  await expect(sellerOrder).not.toContainText(cup);
});
