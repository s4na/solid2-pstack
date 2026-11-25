import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/solid/segmented-control";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui-sdk/solid/select";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { extraTones, loadTone, quickTones, saveTone, tones, type Tone } from "./tones";

export function ToneSwitcher(props: { initialTone: Tone }) {
  const [tone, setTone] = createSignal(props.initialTone);
  const quickTone = () => quickTones.includes(tone()) ? tone() : null;
  const extraTone = () => quickTone() === null ? tone() : null;
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

  function keepCurrentTone(id: Tone) {
    if (id === tone()) void selectTone(id);
  }

  return (
    <div class="tone-controls">
      <div class="tone-pickers">
        <SegmentedControl<Tone> class="tone-switcher" aria-label="トンマナ" value={quickTone()}
          onValueChange={(next) => void selectTone(next)}>
          <For each={quickTones}>{(id) => (
            <SegmentedControlItem class="tone-option" value={id} onClick={() => keepCurrentTone(id)}>
              {tones[id].label}
            </SegmentedControlItem>
          )}</For>
        </SegmentedControl>
        <Select<Tone> value={extraTone()} itemToLabel={(id) => tones[id].label} onValueChange={(next) => void selectTone(next)}>
          <SelectTrigger class="tone-more" aria-label={extraTone() ? `ほかのトンマナ（${tones[tone()].label}）` : "ほかのトンマナ"}
            data-tone-selected={extraTone() ? "" : undefined}>
            <SelectValue placeholder="ほか" />
            <span aria-hidden="true">▾</span>
          </SelectTrigger>
          <SelectContent class="tone-list" aria-label="追加のトンマナ" align="end" sideOffset={7}>
            <For each={extraTones}>{(id) => (
              <SelectItem class="tone-list-option" value={id} onClick={() => keepCurrentTone(id)}>{tones[id].label}</SelectItem>
            )}</For>
          </SelectContent>
        </Select>
      </div>
      <Show when={loadFailed()}>
        <p class="tone-load-error" role="status">読み込めませんでした</p>
      </Show>
    </div>
  );
}
