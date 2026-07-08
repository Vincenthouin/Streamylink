/**
 * Coquille Electron : le panneau partagé (src/ui/ResolverPanel) branché sur
 * l'IPC, plus les comportements propres à l'overlay — hauteur de fenêtre
 * pilotée par le contenu, focus de l'input à l'affichage, Échap pour masquer.
 */
import { useEffect, useRef } from "react";
import { ResolverPanel } from "../../ui/ResolverPanel";

export default function App() {
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // la fenêtre adopte la hauteur du contenu (bornée par le main process)
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => window.musicShare?.setHeight?.(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // focus de l'input à l'affichage depuis la barre de menus, Échap pour masquer
  useEffect(() => {
    const offShown = window.musicShare?.onShown?.(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.musicShare?.hide?.();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      offShown?.();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div ref={contentRef}>
      <ResolverPanel resolveLink={(url) => window.musicShare.resolveLink(url)} inputRef={inputRef} />
    </div>
  );
}
