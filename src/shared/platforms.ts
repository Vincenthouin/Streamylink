/** Liste canonique des plateformes, partagée entre main et renderer. */

export const MAIN_PLATFORMS = ["spotify", "appleMusic", "deezer", "qobuz"] as const;

/** Plateformes bonus fournies par Odesli. */
export const BONUS_PLATFORMS = [
  "tidal",
  "amazonMusic",
  "youtube",
  "youtubeMusic",
  "napster",
  "pandora",
  "anghami",
  "boomplay",
  "audius",
  "yandex",
  "soundcloud",
] as const;

export const PLATFORM_NAMES: Record<string, string> = {
  spotify: "Spotify",
  appleMusic: "Apple Music",
  deezer: "Deezer",
  qobuz: "Qobuz",
  tidal: "TIDAL",
  amazonMusic: "Amazon Music",
  youtube: "YouTube",
  youtubeMusic: "YouTube Music",
  napster: "Napster",
  pandora: "Pandora",
  anghami: "Anghami",
  boomplay: "Boomplay",
  audius: "Audius",
  yandex: "Yandex Music",
  soundcloud: "SoundCloud",
};
