import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/solid/segmented-control";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { loadTone, saveTone, toneIds, tones, type Tone } from "./tones";

export function ToneSwitcher(props: { initialTone: Tone }) {
  const [tone, setTone] = createSignal(props.initialTone);
  const [loadFailed, setLoadFailed] = createSignal(false);
  const root = document.documentElement;
  let request = 0;
  root.dataset.marketTone = props.initialTone;
  onCleanup(() => {
    request += 1;
    delete root.dataset.marketTone;
  });

  async function selectTone(next: Tone | null) {
    if (next === null) return;
    const currentRequest = ++request;
    setLoadFailed(false);
    try {
      await loadTone(next);
    } catch {
      if (currentRequest === request) setLoadFailed(true);
      return;
    }
    if (currentRequest !== request) return;

    root.dataset.marketTone = next;
    setTone(next);
    saveTone(next);
  }

  return (
    <div class="tone-controls">
      <SegmentedControl class="tone-switcher" aria-label="トンマナ" value={tone()} onValueChange={(next) => void selectTone(next)}>
        <For each={toneIds}>{(id) => (
          <SegmentedControlItem class="tone-option" value={id} onClick={() => {
            if (id === tone()) void selectTone(id);
          }}>{tones[id].label}</SegmentedControlItem>
        )}</For>
      </SegmentedControl>
      <Show when={loadFailed()}>
        <p class="tone-load-error" role="status">読み込めませんでした</p>
      </Show>
    </div>
  );
}
