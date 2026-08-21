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

// ─── Ouvrir dans l'app de bureau (par plateforme) ────────────────────

export type OpenInApp = Record<string, boolean>;

const OPEN_IN_APP_KEY = "musicshare.openInApp";

/** Par défaut : tout en web (universel). L'utilisateur active « app » au cas par cas. */
export function loadOpenInApp(): OpenInApp {
  try {
    const raw = localStorage.getItem(OPEN_IN_APP_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveOpenInApp(s: OpenInApp): void {
  localStorage.setItem(OPEN_IN_APP_KEY, JSON.stringify(s));
}
