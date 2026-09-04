/**
 * Ligne de liste app-spécifique (lib « Music Share DLS » → composant Figma
 * « List item »). Miroir 1:1 : `Platform` (desktop 48px / mobile 64px) × `State`
 * (default / notfound). Générique par slots (logo/label/badge/action) : les
 * logos de plateforme et le bouton copie sont injectés par l'app.
 *
 * Stylée via les utilitaires tokens (`src/ui/theme.css`). La plateforme vient du
 * contexte `usePlatform` par défaut (surchargée par la prop `platform`).
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { usePlatformContext, type Platform } from "./usePlatform";

export interface ListItemProps {
  /** Hauteur/cible tactile. Défaut : contexte plateforme. */
  platform?: Platform;
  state?: "default" | "notfound";
  /** Slot logo/pictogramme de tête (l'app fournit le logo plateforme, 24px). */
  logo?: ReactNode;
  label: ReactNode;
  /** Badge « search » (état default, après le label). */
  badge?: ReactNode;
  /** Action de fin de ligne (ex. bouton copie), état default uniquement. */
  action?: ReactNode;
  /** Libellé de fin de ligne en état notfound. */
  notFoundLabel?: ReactNode;
  /** Rend la zone logo+label+badge cliquable (état default). */
  href?: string;
  linkProps?: AnchorHTMLAttributes<HTMLAnchorElement>;
}

export function ListItem({
  platform,
  state = "default",
  logo,
  label,
  badge,
  action,
  notFoundLabel = "Not found",
  href,
  linkProps,
}: ListItemProps) {
  const ctx = usePlatformContext();
  const p = platform ?? ctx;
  // hauteurs Figma : desktop 48 (min-h-12) / mobile 64 (min-h-16), centré vertical
  const minH = p === "mobile" ? "min-h-16" : "min-h-12";

  // Plateforme vérifiable (Deezer/Apple) où le morceau exact est absent :
  // ligne grisée, non cliquable, sans copie.
  if (state === "notfound") {
    return (
      <div
        className={`flex items-center gap-3 rounded-xl border border-line bg-card px-3.5 opacity-55 ${minH}`}
      >
        <span className="shrink-0 grayscale">{logo}</span>
        <span className="flex-1 truncate text-[13px] font-medium text-muted">{label}</span>
        <span className="shrink-0 text-[11px] text-faint">{notFoundLabel}</span>
      </div>
    );
  }

  const main = (
    <>
      <span className="shrink-0">{logo}</span>
      <span className="truncate text-[13px] font-medium text-fg">{label}</span>
      {badge}
    </>
  );

  return (
    <div
      className={`group flex items-center gap-3 rounded-xl border border-line bg-card pl-3.5 pr-1.5 transition hover:bg-card-hover ${minH}`}
    >
      {href ? (
        <a href={href} className="flex min-w-0 flex-1 items-center gap-3" {...linkProps}>
          {main}
        </a>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{main}</div>
      )}
      {action}
    </div>
  );
}
