import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/solid/segmented-control";
import { createSignal, For, onCleanup } from "solid-js";

const tones = [
  { id: "mono", label: "モノ" },
  { id: "craft", label: "クラフト" },
  { id: "night", label: "ナイト" },
] as const;
type Tone = (typeof tones)[number]["id"];

const toneKey = "yorimichi-tone-v1";

function savedTone(): Tone {
  try {
    const saved = localStorage.getItem(toneKey);
    return tones.find(({ id }) => id === saved)?.id ?? "mono";
  } catch {
    return "mono";
  }
}

export function ToneSwitcher() {
  const [tone, setTone] = createSignal(savedTone());
  const root = document.documentElement;
  // Root-level tokens also reach any UI SDK content rendered outside the app root.
  root.dataset.marketTone = tone();
  onCleanup(() => delete root.dataset.marketTone);

  function selectTone(next: Tone | null) {
    if (next === null) return;
    setTone(next);
    root.dataset.marketTone = next;
    try {
      localStorage.setItem(toneKey, next);
    } catch {
      // The active page can still change its appearance.
    }
  }

  return (
    <SegmentedControl class="tone-switcher" aria-label="トンマナ" value={tone()} onValueChange={selectTone}>
      <For each={tones}>{({ id, label }) => (
        <SegmentedControlItem class="tone-option" value={id}>{label}</SegmentedControlItem>
      )}</For>
    </SegmentedControl>
  );
}
