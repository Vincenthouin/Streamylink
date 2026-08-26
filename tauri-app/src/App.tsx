/**
 * Coquille Tauri : le panneau partagé (src/ui/ResolverPanel) avec la
 * résolution exécutée dans la WebView (fetch Tauri injecté dans main.tsx),
 * la fenêtre dont la hauteur suit le contenu, et la copie riche via une
 * commande Rust.
 */
import { useEffect, useRef, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ResolverPanel } from "../../src/ui/ResolverPanel";
import { resolveLink, ResolveError } from "../../src/core/resolver";
import type { ResolveResponse } from "../../src/shared/types";

async function resolve(url: string): Promise<ResolveResponse> {
  try {
    return { ok: true, result: await resolveLink(url) };
  } catch (e) {
    if (e instanceof ResolveError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Unexpected error while resolving." };
  }
}

async function copyRich(html: string, text: string): Promise<void> {
  await invoke("copy_rich", { html, text });
}

export default function App() {
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => {});
  }, []);

  // la fenêtre adopte la hauteur du contenu
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const win = getCurrentWindow();
    const ro = new ResizeObserver(() => {
      win.setSize(new LogicalSize(440, Math.min(620, Math.max(66, el.offsetHeight))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Échap pour masquer, focus + sélection de l'input à l'affichage (pour
  // remplacer directement le texte présent)
  useEffect(() => {
    const win = getCurrentWindow();
    const focusInput = () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    focusInput();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") win.hide();
    };
    const un = win.onFocusChanged(({ payload: focused }) => {
      if (focused) focusInput();
    });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      un.then((f) => f());
    };
  }, []);

  // les liens (plateformes) s'ouvrent dans le navigateur / l'app de streaming
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest("a");
      const href = a?.getAttribute("href");
      if (href && /^https?:/i.test(href)) {
        e.preventDefault();
        invoke("open_external", { url: href });
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={contentRef}>
      <UpdateBanner />
      <ResolverPanel resolveLink={resolve} inputRef={inputRef} copyRich={copyRich} version={version} />
    </div>
  );
}

type UpdateState =
  | { status: "none" }
  | { status: "available"; update: Update }
  | { status: "downloading"; pct: number }
  | { status: "error"; detail?: string };

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 h
// à l'ouverture de la fenêtre : re-check quasi systématique (le manifeste ne
// pèse que ~700 o), throttle minimal juste pour éviter les doubles déclenchements
const FOCUS_THROTTLE_MS = 60 * 1000; // 1 min

function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ status: "none" });
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let cancelled = false;
    let lastCheck = 0;

    const runCheck = async () => {
      // ne pas déranger si une update est déjà proposée, en cours ou en échec
      if (stateRef.current.status !== "none") return;
      lastCheck = Date.now();
      try {
        const update = await check();
        if (!cancelled && update && stateRef.current.status === "none") {
          setState({ status: "available", update });
        }
      } catch {
        /* hors ligne / pas de manifeste : on ignore silencieusement */
      }
    };

    runCheck(); // au démarrage
    const id = setInterval(runCheck, CHECK_INTERVAL_MS); // périodique

    // re-vérifie quand l'utilisateur ouvre la fenêtre (app de barre de menus
    // rarement quittée), throttlé pour ne pas interroger GitHub trop souvent
    const un = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused && Date.now() - lastCheck > FOCUS_THROTTLE_MS) runCheck();
    });

    return () => {
      cancelled = true;
      clearInterval(id);
      un.then((f) => f());
    };
  }, []);

  if (state.status === "none") return null;

  const install = async (update: Update) => {
    try {
      let total = 0;
      let got = 0;
      setState({ status: "downloading", pct: 0 });
      await update.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? 0;
        else if (e.event === "Progress") {
          got += e.data.chunkLength;
          setState({ status: "downloading", pct: total ? Math.round((got / total) * 100) : 0 });
        }
      });
      await relaunch();
    } catch (err) {
      setState({ status: "error", detail: String(err) });
    }
  };

  return (
    <div className="px-3 pt-3">
      {state.status === "available" && (
        <button
          onClick={() => install(state.update)}
          className="flex w-full flex-col gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-left transition hover:bg-emerald-500/15"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-[12px] font-semibold text-emerald-300">
              New version {state.update.version} available
            </span>
            <span className="shrink-0 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
              Update
            </span>
          </span>
          <span className="block whitespace-pre-line text-[11px] leading-relaxed text-emerald-400/80">
            {state.update.body?.trim() || "Click to update and restart."}
          </span>
        </button>
      )}
      {state.status === "downloading" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5">
          <div className="mb-1.5 text-[12px] font-semibold text-emerald-300">
            Downloading update… {state.pct}%
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400 transition-all"
              style={{ width: `${state.pct}%` }}
            />
          </div>
        </div>
      )}
      {state.status === "error" && (
        <div className="flex flex-col gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5">
          <span className="text-[12px] text-red-300">
            Auto-update failed. Download the latest version directly:
          </span>
          <a
            href="https://github.com/Vincenthouin/Streamylink/releases/latest/download/Music-Share-mac.dmg"
            className="rounded-lg bg-white/10 px-2.5 py-1 text-center text-[11px] font-medium text-zinc-100 transition hover:bg-white/15"
          >
            Download the .dmg
          </a>
          {state.detail && (
            <span className="truncate text-[10px] text-red-400/60" title={state.detail}>
              {state.detail}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
