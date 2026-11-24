import fc from "fast-check";
import { expect, test } from "vitest";
import { nextNotificationState } from "../src/notifications";

test("任意の操作列で最後のリセット以降の切り替え回数が状態を決める", () => {
  fc.assert(fc.property(
    fc.boolean(),
    fc.array(fc.constantFrom("toggle" as const, "reset" as const)),
    (initial, actions) => {
      const lastReset = actions.lastIndexOf("reset");
      const startingState = lastReset === -1 ? initial : false;
      const toggles = actions.length - lastReset - 1;
      const expected = toggles % 2 === 0 ? startingState : !startingState;

      expect(actions.reduce(nextNotificationState, initial)).toBe(expected);
    },
  ), { seed: 1 });
});
