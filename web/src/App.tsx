/**
 * Coquille web : le panneau partagé (src/ui/ResolverPanel) branché sur
 * l'API serveur /api/resolve (la résolution ne peut pas se faire dans le
 * navigateur à cause du CORS des plateformes).
 */
import { useEffect, useMemo, useState } from "react";
import { ResolverPanel } from "../../src/ui/ResolverPanel";
import { qobuzOgUrl, qobuzSingleTrackUrl } from "../../src/core/resolver";
import type { ResolveResponse } from "../../src/shared/types";

declare const __APP_VERSION__: string;

/** Lien reçu via la cible de partage PWA (?url=/?text=/?title=) : on en extrait
 *  le premier lien http, et on nettoie l'URL pour ne pas le rejouer au refresh. */
function consumeSharedLink(): string | undefined {
  if (typeof location === "undefined") return undefined;
  const p = new URLSearchParams(location.search);
  const link = [p.get("url"), p.get("text"), p.get("title")]
    .map((v) => v?.match(/https?:\/\/[^\s]+/)?.[0])
    .find(Boolean);
  if (p.has("url") || p.has("text") || p.has("title")) {
    history.replaceState(null, "", location.pathname);
  }
  return link ?? undefined;
}

/** Le CDN de Qobuz refuse les requêtes des IP de datacenter : le navigateur
 *  (IP résidentielle) fetch lui-même la page opengraph — servie avec CORS
 *  ouvert — et l'envoie au serveur, qui n'a plus qu'à la parser. */
async function fetchQobuzOgHtml(url: string): Promise<string | undefined> {
  const og = qobuzOgUrl(url.trim());
  if (!og) return undefined;
  try {
    let res = await fetch(og);
    if (!res.ok) return undefined;
    let html = await res.text();
    // single Qobuz (album 1 piste) : suivre la piste pour son ISRC — c'est le
    // navigateur qui fetch (Qobuz bloque l'IP du serveur)
    const trackUrl = qobuzSingleTrackUrl(html);
    const trackOg = trackUrl && qobuzOgUrl(trackUrl);
    if (trackOg) {
      res = await fetch(trackOg);
      if (res.ok) html = await res.text();
    }
    return html;
  } catch {
    return undefined; // le serveur retentera de son côté
  }
}

async function resolveViaApi(url: string): Promise<ResolveResponse> {
  const qobuzHtml = await fetchQobuzOgHtml(url);
  try {
    const res = await fetch("/api/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, qobuzHtml }),
    });
    if (!res.ok) return { ok: false, error: `The server responded ${res.status}.` };
    return (await res.json()) as ResolveResponse;
  } catch {
    return { ok: false, error: "Could not reach the server — are you offline?" };
  }
}

/** Lien de téléchargement direct du .dmg (nom stable, toujours la dernière
 *  release GitHub). */
const DMG_URL =
  "https://github.com/Vincenthouin/Streamylink/releases/latest/download/Music-Share-mac.dmg";

/** Carte discrète invitant à installer l'app de barre de menus macOS. */
function DesktopCard() {
  return (
    <a
      href={DMG_URL}
      className="group flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-black p-3.5 transition hover:border-white/20 hover:bg-zinc-900"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg text-zinc-200">
        {/* logo Apple */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M17.1 1.2c.06.63-.18 1.26-.6 1.74-.43.5-1.1.87-1.75.82-.07-.6.2-1.24.6-1.65.44-.48 1.18-.85 1.75-.91zm2.62 15.32c-.48 1.1-.71 1.6-1.33 2.57-.86 1.36-2.08 3.06-3.6 3.07-1.34.02-1.69-.88-3.51-.87-1.82.01-2.2.9-3.55.88-1.51-.01-2.66-1.54-3.53-2.9-2.43-3.8-2.68-8.26-1.18-10.63 1.06-1.69 2.74-2.68 4.32-2.68 1.6 0 2.61.9 3.94.9 1.29 0 2.07-.9 3.93-.9 1.4 0 2.89.78 3.95 2.13-3.47 1.95-2.91 7.01.56 8.43z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-zinc-100">Also available on Mac</p>
        <p className="text-[12px] text-zinc-300">
          Menu-bar app — paste from anywhere, no browser needed.
        </p>
      </div>
      <span className="shrink-0 rounded-lg border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] font-medium text-zinc-100 transition group-hover:border-white/25 group-hover:text-zinc-100">
        Download
      </span>
    </a>
  );
}

/** La carte de téléchargement Mac n'a de sens que sur un Mac de bureau :
 *  on la masque sur mobile/tablette (et sur les autres OS). */
function isMacDesktop(): boolean {
  if (typeof navigator === "undefined") return false;
  // maxTouchPoints est fiable : 0 sur un Mac de bureau, ≥ 1 sur iPhone/iPad
  // (l'iPad se présente pourtant comme « Macintosh » dans l'UA).
  return /Macintosh|Mac OS X/.test(navigator.userAgent) && navigator.maxTouchPoints === 0;
}

export default function App() {
  const sharedUrl = useMemo(consumeSharedLink, []);
  // pochette du résultat courant : fond de page (noir + image floutée à 20 %)
  const [coverUrl, setCoverUrl] = useState<string | undefined>();
  // dernière pochette affichée, conservée pour rester visible pendant le fondu
  // de sortie (le conteneur reste monté et anime son opacité)
  const [shownCover, setShownCover] = useState<string | undefined>();
  useEffect(() => {
    if (coverUrl) setShownCover(coverUrl);
  }, [coverUrl]);
  return (
    <>
      {/* fond TOUJOURS monté, opacité animée → fondu entrant/sortant. Positionné
          (z-0) pour passer au-dessus du fond opaque du body ; le contenu
          (relative z-10) reste au-dessus. pochette à 20 % sur noir → contraste
          UI conforme WCAG AAA. scale-125 : le flou ne révèle pas les bords. */}
      <div
        className={`pointer-events-none fixed inset-0 z-0 bg-black transition-opacity duration-700 ${
          coverUrl ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      >
        {shownCover && (
          <img
            src={shownCover}
            alt=""
            className="h-full w-full scale-125 object-cover opacity-30 blur-lg"
          />
        )}
        {/* dégradé sombre en haut et en bas : ré-assombrit les zones header et
            footer (texte posé directement sur le fond) pour garder AAA à 30 %,
            sans toucher le centre (les cartes sont de toute façon opaques) */}
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.6)_0%,rgba(0,0,0,0)_28%,rgba(0,0,0,0)_72%,rgba(0,0,0,0.6)_100%)]" />
      </div>
      <div className="relative z-10 flex min-h-screen flex-col items-center px-4 pt-[10vh] pb-8">
      <header className="mb-5 flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl text-zinc-100" aria-hidden>
            {/* U+FE0E force la présentation « texte » monochrome (sinon rendu
                emoji noir sur certains systèmes → invisible sur fond sombre) */}
            {"♫︎"}
          </span>
          <h1 className="text-lg font-semibold tracking-wide text-zinc-100">Music Share</h1>
        </div>
        <p className="text-center text-[13px] text-zinc-300">
          Share your best songs, on every platform
        </p>
      </header>

      <main className="w-full max-w-md">
        <ResolverPanel
          resolveLink={resolveViaApi}
          version={__APP_VERSION__}
          initialUrl={sharedUrl}
          onResult={setCoverUrl}
        />
      </main>

      {/* bloc de bas de page : mt-auto le pousse au bas de la fenêtre quand le
          contenu est court, sous le contenu quand il est long */}
      <div className="mt-auto flex w-full max-w-md flex-col items-center gap-4 pt-8">
        {isMacDesktop() && <DesktopCard />}
        <footer className="text-[11px] text-zinc-300">Powered by Odesli</footer>
      </div>
      </div>
    </>
  );
}
