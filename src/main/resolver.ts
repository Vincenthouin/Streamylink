/**
 * Résolution d'un lien de partage musical vers les autres plateformes.
 *
 * - Métadonnées (titre / artiste / ISRC / pochette) extraites de la page du
 *   lien collé : OG tags servis aux crawlers pour Qobuz et Spotify, APIs
 *   publiques pour Deezer (api.deezer.com) et Apple Music (iTunes lookup).
 * - Deezer résolu par ISRC (match exact) puis recherche texte en fallback,
 *   en ignorant les tracks retirés du catalogue (readable: false).
 * - Apple Music résolu via l'API iTunes Search (publique, sans clé).
 * - Spotify et Qobuz (sens inverse) : liens de recherche — pas d'API
 *   publique sans clé, et Odesli ne fournit plus Spotify depuis 2025.
 * - Odesli fournit les liens bonus (Tidal, Amazon Music, …).
 */
import type { PlatformLink, ResolveResult } from "../shared/types";

const BOT_UA = "facebookexternalhit/1.1";
const FETCH_TIMEOUT_MS = 15_000;

export class ResolveError extends Error {}

interface TrackInfo {
  title: string;
  artist: string;
  isrc?: string;
  image?: string;
}

interface DeezerTrack {
  id: number;
  link: string;
  title: string;
  artistName: string;
  isrc?: string;
  cover?: string;
}

// ─── Helpers HTTP / HTML ─────────────────────────────────────────────

async function get(url: string, headers?: Record<string, string>): Promise<Response> {
  try {
    return await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (e: any) {
    if (e?.name === "TimeoutError") {
      throw new ResolveError(`Délai dépassé en contactant ${new URL(url).hostname}`);
    }
    throw new ResolveError(`Impossible de joindre ${new URL(url).hostname} (hors ligne ?)`);
  }
}

async function fetchAsBot(url: string): Promise<string> {
  const res = await get(url, { "User-Agent": BOT_UA });
  if (!res.ok) {
    throw new ResolveError(`${new URL(url).hostname} a répondu ${res.status} — lien invalide ?`);
  }
  return res.text();
}

function extractMeta(html: string, key: string): string | undefined {
  // <meta property="key" content="..."> ou <meta name="key" content="...">
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return undefined;
  const content = tag.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeHtmlEntities(content) : undefined;
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

// ─── Détection de la plateforme d'entrée ─────────────────────────────

type SourcePlatform = "qobuz" | "spotify" | "appleMusic" | "deezer";

function detectPlatform(url: string): SourcePlatform {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new ResolveError("Ce n'est pas un lien valide.");
  }
  if (/(^|\.)qobuz\.com$/.test(host)) return "qobuz";
  if (/(^|\.)spotify\.com$/.test(host)) return "spotify";
  if (/(^|\.)music\.apple\.com$/.test(host)) return "appleMusic";
  if (/(^|\.)deezer\.(com|page\.link)$/.test(host)) return "deezer";
  throw new ResolveError(
    "Plateforme non reconnue — colle un lien Qobuz, Spotify, Apple Music ou Deezer.",
  );
}

// ─── Extraction des métadonnées selon la plateforme ──────────────────

async function getQobuzTrackInfo(url: string): Promise<TrackInfo> {
  const html = await fetchAsBot(url);
  const ogTitle = extractMeta(html, "og:title"); // "Imagine by John Lennon is on Qobuz.com"
  const artist = extractMeta(html, "twitter:audio:artist_name");
  const isrc = extractMeta(html, "music:isrc");
  const image = extractMeta(html, "og:image");

  if (!ogTitle) {
    throw new ResolveError("Titre introuvable sur la page Qobuz — le lien pointe-t-il vers un morceau ?");
  }

  let title: string | undefined;
  if (artist && ogTitle.endsWith(` by ${artist} is on Qobuz.com`)) {
    title = ogTitle.slice(0, -` by ${artist} is on Qobuz.com`.length);
  } else {
    title = ogTitle.match(/^(.*) by .* is on Qobuz\.com$/)?.[1];
  }
  const finalArtist = artist ?? ogTitle.match(/^.* by (.*) is on Qobuz\.com$/)?.[1];
  if (!title || !finalArtist) {
    throw new ResolveError(`Métadonnées Qobuz inattendues : "${ogTitle}"`);
  }

  return { title, artist: finalArtist, isrc, image };
}

async function getSpotifyTrackInfo(url: string): Promise<TrackInfo> {
  const html = await fetchAsBot(url);
  const title = extractMeta(html, "og:title");
  const desc = extractMeta(html, "og:description"); // "Daft Punk · Discovery · Song · 2001"
  const image = extractMeta(html, "og:image");
  const artist = desc?.split(" · ")[0];
  if (!title || !artist) {
    throw new ResolveError("Titre/artiste introuvables sur la page Spotify — le lien pointe-t-il vers un morceau ?");
  }
  return { title, artist, image };
}

async function getDeezerTrackInfo(url: string): Promise<TrackInfo & { deezer: DeezerTrack }> {
  const id = url.match(/\/track\/(\d+)/)?.[1];
  if (!id) throw new ResolveError("Lien Deezer non reconnu (attendu : …/track/<id>).");
  const res = await get(`https://api.deezer.com/track/${id}`);
  const data = (await res.json()) as any;
  if (data.error) throw new ResolveError("Morceau introuvable chez Deezer — lien invalide ?");
  return {
    title: data.title,
    artist: data.artist?.name,
    isrc: data.isrc,
    image: data.album?.cover_xl ?? data.album?.cover_big,
    deezer: toDeezerTrack(data),
  };
}

async function getAppleMusicTrackInfo(url: string): Promise<TrackInfo & { appleUrl: string }> {
  const u = new URL(url);
  const id = u.searchParams.get("i") ?? u.pathname.match(/\/song\/[^/]+\/(\d+)/)?.[1];
  if (!id) {
    throw new ResolveError("Lien Apple Music non reconnu — utilise un lien de morceau (pas d'album).");
  }
  const res = await get(`https://itunes.apple.com/lookup?id=${id}&entity=song&country=FR`);
  const data = (await res.json()) as any;
  const song = data?.results?.find((r: any) => r.wrapperType === "track");
  if (!song) throw new ResolveError("Morceau introuvable chez Apple Music — lien invalide ?");
  return {
    title: song.trackName,
    artist: song.artistName,
    image: song.artworkUrl100?.replace("100x100", "500x500"),
    appleUrl: song.trackViewUrl,
  };
}

// ─── Résolution Deezer ───────────────────────────────────────────────

function toDeezerTrack(data: any): DeezerTrack {
  return {
    id: data.id,
    link: data.link ?? `https://www.deezer.com/track/${data.id}`,
    title: data.title,
    artistName: data.artist?.name ?? "?",
    isrc: data.isrc,
    cover: data.album?.cover_xl ?? data.album?.cover_big ?? data.album?.cover_medium,
  };
}

/** ISRC exact d'abord, puis recherche stricte, puis souple. Les tracks
 *  retirés du catalogue (readable: false) sont ignorés car Odesli ne
 *  peut pas les résoudre. */
async function findDeezer(info: TrackInfo): Promise<DeezerTrack | null> {
  if (info.isrc) {
    const res = await get(`https://api.deezer.com/track/isrc:${encodeURIComponent(info.isrc)}`);
    const data = (await res.json()) as any;
    if (!data.error && data.readable !== false) return toDeezerTrack(data);
  }

  const queries = [
    `artist:"${info.artist}" track:"${info.title}"`,
    `${info.artist} ${info.title}`,
  ];
  for (const q of queries) {
    const res = await get(`https://api.deezer.com/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) continue;
    const data = (await res.json()) as any;
    const hit = data?.data?.find((t: any) => t.readable !== false);
    if (hit) return toDeezerTrack(hit);
  }
  return null;
}

// ─── Résolution Apple Music (iTunes Search API) ──────────────────────

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function findAppleMusic(info: TrackInfo): Promise<string | null> {
  const term = encodeURIComponent(`${info.artist} ${info.title}`);
  const res = await get(
    `https://itunes.apple.com/search?term=${term}&entity=song&limit=10&country=FR`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const results: any[] = data?.results ?? [];
  if (!results.length) return null;

  const nArtist = normalize(info.artist);
  const nTitle = normalize(info.title);
  const scored = results
    .map((r) => {
      const a = normalize(r.artistName ?? "");
      const t = normalize(r.trackName ?? "");
      let score = 0;
      if (a === nArtist) score += 2;
      else if (a.includes(nArtist) || nArtist.includes(a)) score += 1;
      if (t === nTitle) score += 2;
      else if (t.startsWith(nTitle) || nTitle.startsWith(t)) score += 1;
      return { r, score };
    })
    .sort((x, y) => y.score - x.score);

  // score < 2 = ni l'artiste ni le titre ne matchent vraiment : on préfère
  // ne rien renvoyer qu'un mauvais morceau
  const best = scored[0];
  return best.score >= 2 ? best.r.trackViewUrl : null;
}

// ─── Odesli (liens bonus) ────────────────────────────────────────────

const ODESLI_NAMES: Record<string, string> = {
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

async function getOdesliBonus(url: string): Promise<PlatformLink[]> {
  try {
    const res = await get(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&songIfSingle=true`,
    );
    if (!res.ok) return [];
    const data = (await res.json()) as any;
    const links: PlatformLink[] = [];
    for (const [platform, entry] of Object.entries<any>(data.linksByPlatform ?? {})) {
      if (ODESLI_NAMES[platform] && entry?.url) {
        links.push({ platform, name: ODESLI_NAMES[platform], url: entry.url, kind: "direct" });
      }
    }
    return links;
  } catch {
    return []; // les bonus ne doivent jamais faire échouer la résolution
  }
}

// ─── Liens de recherche (fallback sans API) ──────────────────────────

function spotifySearchUrl(info: TrackInfo): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${info.artist} ${info.title}`)}`;
}

function qobuzSearchUrl(info: TrackInfo): string {
  return `https://www.qobuz.com/fr-fr/search?q=${encodeURIComponent(`${info.artist} ${info.title}`)}`;
}

// ─── Point d'entrée ──────────────────────────────────────────────────

export async function resolveLink(rawUrl: string): Promise<ResolveResult> {
  const url = rawUrl.trim();
  const platform = detectPlatform(url);

  let info: TrackInfo;
  let deezer: DeezerTrack | null = null;
  let appleUrl: string | null = null;

  switch (platform) {
    case "qobuz":
      info = await getQobuzTrackInfo(url);
      break;
    case "spotify":
      info = await getSpotifyTrackInfo(url);
      break;
    case "deezer": {
      const r = await getDeezerTrackInfo(url);
      info = r;
      deezer = r.deezer;
      break;
    }
    case "appleMusic": {
      const r = await getAppleMusicTrackInfo(url);
      info = r;
      appleUrl = r.appleUrl;
      break;
    }
  }

  [deezer, appleUrl] = await Promise.all([
    deezer ?? findDeezer(info),
    appleUrl ?? findAppleMusic(info),
  ]);

  const bonus = await getOdesliBonus(deezer?.link ?? url);

  const links: PlatformLink[] = [];
  const push = (platformId: string, name: string, u: string | null, kind: "direct" | "search") => {
    if (u) links.push({ platform: platformId, name, url: u, kind });
  };

  push("spotify", "Spotify", platform === "spotify" ? url : spotifySearchUrl(info), platform === "spotify" ? "direct" : "search");
  push("appleMusic", "Apple Music", appleUrl, "direct");
  push("deezer", "Deezer", deezer?.link ?? null, "direct");
  push("qobuz", "Qobuz", platform === "qobuz" ? url : qobuzSearchUrl(info), platform === "qobuz" ? "direct" : "search");

  return {
    title: info.title,
    artist: info.artist,
    image: info.image ?? deezer?.cover,
    sourcePlatform: platform,
    links,
    bonus,
  };
}
