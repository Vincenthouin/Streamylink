/**
 * test-chain.ts — teste la chaîne de résolution multi-plateformes en console.
 *
 * Usage : npx tsx test-chain.ts <url>
 *   ex : npx tsx test-chain.ts https://open.qobuz.com/track/4847493
 *
 * Entrées acceptées : Qobuz, Spotify, Apple Music, Deezer.
 *
 * Architecture (adaptée après tests — voir rapport d'étape 1) :
 * 1. Métadonnées (titre / artiste / ISRC / pochette) :
 *    - Qobuz, Spotify : fetch de la page avec un UA de bot (les OG tags ne
 *      sont servis qu'aux crawlers). La page Qobuz expose même music:isrc.
 *    - Deezer : API publique api.deezer.com/track/{id} (donne l'ISRC).
 *    - Apple Music : API iTunes lookup?id={id}.
 * 2. Résolution de chaque plateforme cible en direct :
 *    - Deezer : par ISRC (exact) puis recherche texte, tracks lisibles only.
 *    - Apple Music : iTunes Search API (publique, sans clé).
 *    - Spotify / Qobuz : pas d'API publique sans clé → lien de recherche
 *      (en attente de décision, cf. rapport).
 * 3. Odesli en bonus pour les autres plateformes (Tidal, Amazon…).
 *    NB : Odesli ne fournit plus Spotify / Apple Music / YouTube en 2026.
 */

const BOT_UA = "facebookexternalhit/1.1";

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

function fail(msg: string): never {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
}

// ─── Parsing HTML / OG ───────────────────────────────────────────────

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

async function fetchAsBot(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": BOT_UA } });
  if (!res.ok) fail(`${new URL(url).hostname} a répondu ${res.status}`);
  return res.text();
}

// ─── Détection de la plateforme d'entrée ─────────────────────────────

type Platform = "qobuz" | "spotify" | "appleMusic" | "deezer";

function detectPlatform(url: string): Platform {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    fail(`Lien invalide : "${url}"`);
  }
  if (/(^|\.)qobuz\.com$/.test(host)) return "qobuz";
  if (/(^|\.)spotify\.com$/.test(host)) return "spotify";
  if (/(^|\.)music\.apple\.com$/.test(host)) return "appleMusic";
  if (/(^|\.)deezer\.(com|page\.link)$/.test(host)) return "deezer";
  fail(`Plateforme non reconnue : ${host} (attendu : Qobuz, Spotify, Apple Music ou Deezer)`);
}

// ─── Extraction des métadonnées selon la plateforme ──────────────────

async function getQobuzTrackInfo(url: string): Promise<TrackInfo> {
  const html = await fetchAsBot(url);
  const ogTitle = extractMeta(html, "og:title"); // "Imagine by John Lennon is on Qobuz.com"
  const artist = extractMeta(html, "twitter:audio:artist_name");
  const isrc = extractMeta(html, "music:isrc");
  const image = extractMeta(html, "og:image");

  if (!ogTitle) fail("Impossible d'extraire og:title de la page Qobuz (lien invalide ?)");

  let title: string | undefined;
  if (artist && ogTitle.endsWith(` by ${artist} is on Qobuz.com`)) {
    title = ogTitle.slice(0, -` by ${artist} is on Qobuz.com`.length);
  } else {
    title = ogTitle.match(/^(.*) by .* is on Qobuz\.com$/)?.[1];
  }
  const finalArtist = artist ?? ogTitle.match(/^.* by (.*) is on Qobuz\.com$/)?.[1];
  if (!title || !finalArtist) fail(`Format og:title Qobuz inattendu : "${ogTitle}"`);

  return { title, artist: finalArtist, isrc, image };
}

async function getSpotifyTrackInfo(url: string): Promise<TrackInfo> {
  const html = await fetchAsBot(url);
  const title = extractMeta(html, "og:title");
  const desc = extractMeta(html, "og:description"); // "Daft Punk · Discovery · Song · 2001"
  const image = extractMeta(html, "og:image");
  const artist = desc?.split(" · ")[0];
  if (!title || !artist) fail("Impossible d'extraire titre/artiste de la page Spotify");
  return { title, artist, image };
}

async function getDeezerTrackInfo(url: string): Promise<TrackInfo & { deezer: DeezerTrack }> {
  const id = url.match(/\/track\/(\d+)/)?.[1];
  if (!id) fail("Lien Deezer non reconnu (attendu : …/track/<id>)");
  const res = await fetch(`https://api.deezer.com/track/${id}`);
  const data = (await res.json()) as any;
  if (data.error) fail(`Track Deezer introuvable : ${data.error.message ?? id}`);
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
  if (!id) fail("Lien Apple Music non reconnu (attendu : …album/…?i=<id> ou …/song/…/<id>)");
  const res = await fetch(`https://itunes.apple.com/lookup?id=${id}&entity=song&country=FR`);
  const data = (await res.json()) as any;
  const song = data?.results?.find((r: any) => r.wrapperType === "track");
  if (!song) fail(`Morceau Apple Music introuvable (id ${id})`);
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

/** Candidats Deezer par ordre de confiance : ISRC exact, puis recherche
 *  stricte, puis souple. Les tracks non lisibles (retirés du catalogue)
 *  sont ignorés. */
async function findDeezer(info: TrackInfo): Promise<DeezerTrack | null> {
  if (info.isrc) {
    const res = await fetch(
      `https://api.deezer.com/track/isrc:${encodeURIComponent(info.isrc)}`,
    );
    const data = (await res.json()) as any;
    if (!data.error && data.readable !== false) return toDeezerTrack(data);
    if (!data.error) console.log(`  (match ISRC ${data.id} indisponible chez Deezer, ignoré)`);
  }

  const queries = [
    `artist:"${info.artist}" track:"${info.title}"`,
    `${info.artist} ${info.title}`,
  ];
  for (const q of queries) {
    const res = await fetch(`https://api.deezer.com/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) continue;
    const data = (await res.json()) as any;
    const hit = data?.data?.find((t: any) => t.readable !== false);
    if (hit) return toDeezerTrack(hit);
  }
  return null;
}

// ─── Résolution Apple Music (iTunes Search API, publique) ────────────

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
  const res = await fetch(
    `https://itunes.apple.com/search?term=${term}&entity=song&limit=10&country=FR`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as any;
  const results: any[] = data?.results ?? [];
  if (!results.length) return null;

  const nArtist = normalize(info.artist);
  const nTitle = normalize(info.title);
  // meilleur score : artiste identique + titre identique > artiste identique > premier résultat
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

  const best = scored[0];
  return best.score >= 2 ? best.r.trackViewUrl : null;
}

// ─── Odesli (bonus : Tidal, Amazon, etc.) ────────────────────────────

async function getOdesliLinks(url: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(
      `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url)}&songIfSingle=true`,
    );
    if (!res.ok) {
      console.log(`  (Odesli a répondu ${res.status}, liens bonus ignorés)`);
      return {};
    }
    const data = (await res.json()) as any;
    const links: Record<string, string> = {};
    for (const [platform, entry] of Object.entries<any>(data.linksByPlatform ?? {})) {
      links[platform] = entry.url;
    }
    return links;
  } catch {
    return {};
  }
}

// ─── Liens de recherche (fallback sans API) ──────────────────────────

function spotifySearchUrl(info: TrackInfo): string {
  return `https://open.spotify.com/search/${encodeURIComponent(`${info.artist} ${info.title}`)}`;
}

function qobuzSearchUrl(info: TrackInfo): string {
  return `https://www.qobuz.com/fr-fr/search?q=${encodeURIComponent(`${info.artist} ${info.title}`)}`;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  const url = process.argv[2];
  if (!url) fail("Usage : npx tsx test-chain.ts <url>");

  const platform = detectPlatform(url);
  console.log(`\n▸ Plateforme d'entrée : ${platform}`);

  console.log("▸ Extraction des métadonnées…");
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
  console.log(`  Titre   : ${info.title}`);
  console.log(`  Artiste : ${info.artist}`);
  console.log(`  ISRC    : ${info.isrc ?? "(absent)"}`);

  console.log("▸ Résolution Deezer + Apple Music…");
  const [deezerResult, appleResult] = await Promise.all([
    deezer ? Promise.resolve(deezer) : findDeezer(info),
    appleUrl ? Promise.resolve(appleUrl) : findAppleMusic(info),
  ]);
  deezer = deezerResult;
  appleUrl = appleResult;
  if (deezer) {
    console.log(`  Deezer : "${deezer.title}" – ${deezer.artistName} (ISRC ${deezer.isrc ?? "?"})`);
  }

  console.log("▸ Interrogation Odesli (liens bonus)…");
  const odesli = await getOdesliLinks(deezer?.link ?? url);

  console.log(`\n═══ Résultat ═══`);
  console.log(`Titre    : ${info.title}`);
  console.log(`Artiste  : ${info.artist}`);
  console.log(`Pochette : ${info.image ?? deezer?.cover ?? "(aucune)"}`);
  console.log();

  const line = (name: string, link: string | null | undefined, note = "") =>
    console.log(`  ${name.padEnd(12)} : ${link ?? "— non trouvé —"}${note}`);

  line("Qobuz", platform === "qobuz" ? url : qobuzSearchUrl(info), platform === "qobuz" ? "" : "  (lien de recherche)");
  line("Spotify", platform === "spotify" ? url : spotifySearchUrl(info), platform === "spotify" ? "" : "  (lien de recherche)");
  line("Apple Music", appleUrl);
  line("Deezer", deezer?.link);

  const bonus = Object.entries(odesli).filter(
    ([p]) => !["spotify", "appleMusic", "deezer", "qobuz", "itunes"].includes(p),
  );
  if (bonus.length) {
    console.log(`\n  Bonus Odesli :`);
    for (const [p, l] of bonus) line(p, l);
  }
}

main().catch((e) => fail(e?.message ?? String(e)));
