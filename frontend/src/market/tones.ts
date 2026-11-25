import craftStyles from "./tones/craft.css?url&no-inline";
import monoStyles from "./tones/mono.css?url&no-inline";
import nightStyles from "./tones/night.css?url&no-inline";

export const tones = {
  mono: { label: "モノ", href: monoStyles },
  craft: { label: "クラフト", href: craftStyles },
  night: { label: "ナイト", href: nightStyles },
} as const;
export type Tone = keyof typeof tones;
export const toneIds = Object.keys(tones) as Tone[];

const defaultTone: Tone = "mono";
const toneKey = "yorimichi-tone-v1";
const stylesheets = new Map<Tone, Promise<void>>();

function savedTone(): Tone {
  try {
    const saved = localStorage.getItem(toneKey);
    return toneIds.find((tone) => tone === saved) ?? defaultTone;
  } catch {
    return defaultTone;
  }
}

export function saveTone(tone: Tone) {
  try {
    localStorage.setItem(toneKey, tone);
  } catch {
    // Storage can be unavailable while the current page still changes appearance.
  }
}

export function loadTone(tone: Tone): Promise<void> {
  const existing = stylesheets.get(tone);
  if (existing) return existing;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = tones[tone].href;
  const loading = new Promise<void>((resolve, reject) => {
    link.addEventListener("load", () => resolve(), { once: true });
    link.addEventListener("error", () => {
      link.remove();
      stylesheets.delete(tone);
      reject(new Error(`Failed to load the ${tone} stylesheet`));
    }, { once: true });
  });
  stylesheets.set(tone, loading);
  document.head.append(link);
  return loading;
}

export async function loadInitialTone(): Promise<Tone> {
  const preferred = savedTone();
  try {
    await loadTone(preferred);
    return preferred;
  } catch (error) {
    if (preferred === defaultTone) throw error;
    await loadTone(defaultTone);
    return defaultTone;
  }
}
