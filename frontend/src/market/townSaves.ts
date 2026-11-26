import { createSignal } from "solid-js";

export const townEvents = [
  { id: "ceramics", title: "器のお手入れ会", time: "土曜 11:00", place: "土の音", detail: "普段使いの器を長く使うための洗い方やしまい方を聞けます。" },
  { id: "scent", title: "季節の香りを試す会", time: "土曜 14:00", place: "灯と森", detail: "木や草花の香りを試して、部屋に合う香りを探します。" },
  { id: "linen", title: "リネンの端切れ交換会", time: "日曜 10:30", place: "布の間", detail: "余った布を持ち寄り、小さな敷物や包み方のアイデアを交換します。" },
] as const;

export type TownEvent = (typeof townEvents)[number];
type Saves = { products: number[]; events: TownEvent["id"][] };

function readSaves(key: string): Saves {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "{}") as Partial<Saves> | null;
    const products = Array.isArray(value?.products)
      ? [...new Set(value.products.filter((id) => Number.isSafeInteger(id) && id > 0))]
      : [];
    const events = townEvents.filter(({ id }) => Array.isArray(value?.events) && value.events.includes(id)).map(({ id }) => id);
    return { products, events };
  } catch {
    return { products: [], events: [] };
  }
}

function withMembership<T>(items: T[], item: T, included: boolean): T[] {
  if (!included) return items.filter((entry) => entry !== item);
  return items.includes(item) ? items : [...items, item];
}

export function createTownSaves(preview: boolean) {
  const key = preview ? "yorimichi-preview-saves-v1" : "yorimichi-saves-v1";
  const [saves, setSaves] = createSignal(readSaves(key));

  function update(next: Saves) {
    setSaves(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // The current page can still keep the user's selections.
    }
  }

  return {
    saves,
    saveProduct(id: number, included: boolean) {
      update({ ...saves(), products: withMembership(saves().products, id, included) });
    },
    planEvent(id: TownEvent["id"], included: boolean) {
      update({ ...saves(), events: withMembership(saves().events, id, included) });
    },
  };
}
