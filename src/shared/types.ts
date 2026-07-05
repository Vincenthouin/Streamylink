export type PlatformId =
  | "spotify"
  | "appleMusic"
  | "deezer"
  | "qobuz"
  | string; // plateformes bonus Odesli (tidal, amazonMusic, …)

export interface PlatformLink {
  platform: PlatformId;
  name: string;
  url: string;
  /** "direct" = lien vers le morceau exact, "search" = lien de recherche */
  kind: "direct" | "search";
}

export interface ResolveResult {
  title: string;
  artist: string;
  image?: string;
  sourcePlatform: PlatformId;
  /** Les 4 plateformes principales, toujours dans le même ordre */
  links: PlatformLink[];
  /** Autres plateformes trouvées via Odesli (Tidal, Amazon Music, …) */
  bonus: PlatformLink[];
}

export type ResolveResponse =
  | { ok: true; result: ResolveResult }
  | { ok: false; error: string };
