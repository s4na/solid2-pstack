import { page } from "vitest/browser";
import { render } from "@solidjs/web";
import { afterEach, beforeEach, expect, test } from "vitest";
import { NotificationSettings } from "../src/NotificationSettings";
import "../src/reset.css";

let dispose: () => void;
let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  dispose = render(() => <NotificationSettings />, container);
});

afterEach(() => {
  dispose();
  container.remove();
});

test("クリックで公開された押下状態と表示が切り替わる", async () => {
  const toggle = page.getByRole("button", { name: "通知を受け取る" });
  const status = page.getByRole("status");

  await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.element(status).toHaveTextContent("通知はオフです");

  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.element(status).toHaveTextContent("通知はオンです");

  await toggle.click();
  await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.element(status).toHaveTextContent("通知はオフです");
});
