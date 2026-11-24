import { readFile } from "node:fs/promises";
import { check } from "tla-ts";
import { expect, test } from "vitest";
import { nextNotificationState, type NotificationAction } from "../src/notifications";

test("通知の状態遷移が TLA+ モデルと全入力で一致する", async () => {
  const source = await readFile(new URL("../models/Notifications.tla", import.meta.url), "utf8");
  const edges: [name: string, enabled: boolean, action: NotificationAction][] = [
    ["ToggleOff", false, "toggle"],
    ["ToggleOn", true, "toggle"],
    ["ResetOff", false, "reset"],
    ["ResetOn", true, "reset"],
  ];
  const constants = edges.map(([name, enabled, action]) => {
    const value = nextNotificationState(enabled, action) ? "TRUE" : "FALSE";
    return `  ${name} = ${value}`;
  });
  const config = [
    "INIT Init",
    "NEXT Next",
    "INVARIANT TypeOK ImplementationAgrees",
    "CONSTANTS",
    ...constants,
  ].join("\n");

  const result = await check({ source, config });

  expect(result.status, JSON.stringify(result)).toBe("success");
});
