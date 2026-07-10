/**
 * Coquille web : le panneau partagé (src/ui/ResolverPanel) branché sur
 * l'API serveur /api/resolve (la résolution ne peut pas se faire dans le
 * navigateur à cause du CORS des plateformes).
 */
import { ResolverPanel } from "../../src/ui/ResolverPanel";
import type { ResolveResponse } from "../../src/shared/types";

async function resolveViaApi(url: string): Promise<ResolveResponse> {
  try {
    const res = await fetch(`/api/resolve?url=${encodeURIComponent(url)}`);
    if (!res.ok) return { ok: false, error: `The server responded ${res.status}.` };
    return (await res.json()) as ResolveResponse;
  } catch {
    return { ok: false, error: "Could not reach the server — are you offline?" };
  }
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
        <ResolverPanel resolveLink={resolveViaApi} />
      </main>

      <footer className="mt-6 text-[11px] text-zinc-600">Powered by Odesli</footer>
    </div>
  );
}
