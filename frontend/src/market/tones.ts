import aisleStyles from "./tones/aisle.css?url&no-inline";
import atlasStyles from "./tones/atlas.css?url&no-inline";
import craftStyles from "./tones/craft.css?url&no-inline";
import deskStyles from "./tones/desk.css?url&no-inline";
import fieldStyles from "./tones/field.css?url&no-inline";
import galleryStyles from "./tones/gallery.css?url&no-inline";
import journalStyles from "./tones/journal.css?url&no-inline";
import monoStyles from "./tones/mono.css?url&no-inline";
import nightStyles from "./tones/night.css?url&no-inline";
import pulseStyles from "./tones/pulse.css?url&no-inline";
import studioStyles from "./tones/studio.css?url&no-inline";
import terminalStyles from "./tones/terminal.css?url&no-inline";
import workbenchStyles from "./tones/workbench.css?url&no-inline";

export const tones = {
  mono: { label: "モノ", href: monoStyles },
  craft: { label: "クラフト", href: craftStyles },
  night: { label: "ナイト", href: nightStyles },
  aisle: { label: "売り場", href: aisleStyles },
  journal: { label: "技術誌", href: journalStyles },
  workbench: { label: "作業台", href: workbenchStyles },
  studio: { label: "ストア", href: studioStyles },
  pulse: { label: "パルス", href: pulseStyles },
  terminal: { label: "ターミナル", href: terminalStyles },
  atlas: { label: "アトラス", href: atlasStyles },
  desk: { label: "デスク", href: deskStyles },
  gallery: { label: "ギャラリー", href: galleryStyles },
  field: { label: "フィールド", href: fieldStyles },
} as const;
export type Tone = keyof typeof tones;
const toneIds = Object.keys(tones) as Tone[];
export const quickTones: readonly Tone[] = ["mono", "craft", "night"];
export const extraTones = toneIds.filter((tone) => !quickTones.includes(tone));

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
