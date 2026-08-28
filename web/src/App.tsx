/**
 * Coquille web : le panneau partagé (src/ui/ResolverPanel) branché sur
 * l'API serveur /api/resolve (la résolution ne peut pas se faire dans le
 * navigateur à cause du CORS des plateformes).
 */
import { ResolverPanel } from "../../src/ui/ResolverPanel";
import { qobuzOgUrl, qobuzSingleTrackUrl } from "../../src/core/resolver";
import type { ResolveResponse } from "../../src/shared/types";

declare const __APP_VERSION__: string;

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
      className="group mt-4 flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:border-white/20 hover:bg-white/[0.06]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg text-zinc-200">
        {/* logo Apple */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M17.1 1.2c.06.63-.18 1.26-.6 1.74-.43.5-1.1.87-1.75.82-.07-.6.2-1.24.6-1.65.44-.48 1.18-.85 1.75-.91zm2.62 15.32c-.48 1.1-.71 1.6-1.33 2.57-.86 1.36-2.08 3.06-3.6 3.07-1.34.02-1.69-.88-3.51-.87-1.82.01-2.2.9-3.55.88-1.51-.01-2.66-1.54-3.53-2.9-2.43-3.8-2.68-8.26-1.18-10.63 1.06-1.69 2.74-2.68 4.32-2.68 1.6 0 2.61.9 3.94.9 1.29 0 2.07-.9 3.93-.9 1.4 0 2.89.78 3.95 2.13-3.47 1.95-2.91 7.01.56 8.43z" />
        </svg>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-zinc-100">Also available on Mac</p>
        <p className="text-[12px] text-zinc-500">
          Menu-bar app — paste from anywhere, no browser needed.
        </p>
      </div>
      <span className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-zinc-300 transition group-hover:border-white/25 group-hover:text-zinc-100">
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
  return (
    <div className="flex min-h-screen flex-col items-center px-4 pt-[10vh] pb-8">
      <header className="mb-5 flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl" aria-hidden>
            ♫
          </span>
          <h1 className="text-lg font-semibold tracking-wide text-zinc-100">Music Share</h1>
        </div>
        <p className="text-center text-[13px] text-zinc-500">One link, every platform.</p>
      </header>

      <main className="w-full max-w-md">
        <ResolverPanel resolveLink={resolveViaApi} version={__APP_VERSION__} />
      </main>

      {isMacDesktop() && <DesktopCard />}

      <footer className="mt-6 text-[11px] text-zinc-600">Powered by Odesli</footer>
    </div>
  );
}
