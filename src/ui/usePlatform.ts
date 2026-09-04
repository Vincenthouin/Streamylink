/**
 * Source unique de vérité pour la plateforme DS (desktop / mobile).
 * Sert à choisir le variant Figma (`Platform`) de chaque composant : cible
 * tactile plus grande sur mobile (Input 16px, contrôles 48px, lignes 64px…).
 *
 * Signal principal : pointeur grossier (`pointer: coarse` = doigt) ; secours :
 * `navigator.maxTouchPoints`. Ainsi :
 *   - popover Tauri (souris macOS)  → desktop
 *   - web sur iPhone / iPad          → mobile (l'iPad se présente en « Macintosh »
 *                                      dans l'UA mais expose maxTouchPoints ≥ 1)
 *   - web sur Mac / PC de bureau     → desktop
 * Réactif : suit les changements de pointeur (rare, ex. tablette 2-en-1).
 */
import { createContext, useContext, useEffect, useState } from "react";

export type Platform = "desktop" | "mobile";

const COARSE = "(pointer: coarse)";

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";
  const coarse = window.matchMedia?.(COARSE).matches ?? false;
  const touch = (navigator.maxTouchPoints ?? 0) > 0;
  return coarse || touch ? "mobile" : "desktop";
}

export function usePlatform(): Platform {
  const [platform, setPlatform] = useState<Platform>(detectPlatform);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(COARSE);
    const onChange = () => setPlatform(detectPlatform());
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return platform;
}

/** Contexte pour diffuser la plateforme à toute l'UI partagée sans prop-drilling.
 *  Fourni une fois en tête de `ResolverPanel` ; lu via `usePlatformContext()`. */
const PlatformContext = createContext<Platform>("desktop");
export const PlatformProvider = PlatformContext.Provider;
export function usePlatformContext(): Platform {
  return useContext(PlatformContext);
}
