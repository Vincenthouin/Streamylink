import { BONUS_PLATFORMS, MAIN_PLATFORMS } from "../shared/platforms";

export type EnabledPlatforms = Record<string, boolean>;

const STORAGE_KEY = "musicshare.enabledPlatforms";

/** Pré-sélection de l'onboarding : Spotify, Apple Music et Deezer. */
export function defaultSettings(): EnabledPlatforms {
  const s: EnabledPlatforms = {};
  for (const p of MAIN_PLATFORMS) s[p] = p !== "qobuz";
  for (const p of BONUS_PLATFORMS) s[p] = false;
  return s;
}

/** true si l'utilisateur a déjà choisi ses plateformes (onboarding passé). */
export function hasStoredSettings(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
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
