import { BONUS_PLATFORMS, MAIN_PLATFORMS } from "../shared/platforms";

export type EnabledPlatforms = Record<string, boolean>;

const STORAGE_KEY = "musicshare.enabledPlatforms";

/** Par défaut : les 4 plateformes principales + TIDAL et Amazon Music. */
export function defaultSettings(): EnabledPlatforms {
  const s: EnabledPlatforms = {};
  for (const p of MAIN_PLATFORMS) s[p] = true;
  for (const p of BONUS_PLATFORMS) s[p] = p === "tidal" || p === "amazonMusic";
  return s;
}

export function loadSettings(): EnabledPlatforms {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    // fusion avec les défauts : les plateformes ajoutées dans une future
    // version apparaissent avec leur valeur par défaut
    return { ...defaultSettings(), ...JSON.parse(raw) };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(s: EnabledPlatforms): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}
