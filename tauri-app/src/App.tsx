/**
 * Coquille Tauri : le panneau partagé (src/ui/ResolverPanel) avec la
 * résolution exécutée dans la WebView (fetch Tauri injecté dans main.tsx),
 * la fenêtre dont la hauteur suit le contenu, et la copie riche via une
 * commande Rust.
 */
import { useEffect, useRef } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
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

  // Échap pour masquer, focus de l'input à l'affichage
  useEffect(() => {
    const win = getCurrentWindow();
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") win.hide();
    };
    const un = win.onFocusChanged(({ payload: focused }) => {
      if (focused) inputRef.current?.focus();
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
      if (href && /^https?:/.test(href)) {
        e.preventDefault();
        openUrl(href);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <div ref={contentRef}>
      <ResolverPanel resolveLink={resolve} inputRef={inputRef} copyRich={copyRich} />
    </div>
  );
}
