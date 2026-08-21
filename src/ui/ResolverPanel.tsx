/**
 * Panneau complet de résolution (input, onboarding, paramètres, résultats),
 * partagé entre l'app Electron (overlay barre de menus) et la page web.
 * Chaque coquille fournit sa fonction `resolveLink` (IPC côté Electron,
 * fetch vers /api/resolve côté web). Interface en anglais.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlatformLink, ResolveResponse, ResolveResult } from "../shared/types";
import { BONUS_PLATFORMS, MAIN_PLATFORMS, PLATFORM_NAMES } from "../shared/platforms";
import { APP_SCHEME_PLATFORMS, appSchemeUrl } from "../shared/appLinks";
import { CheckIcon, CopyIcon, PLATFORM_COLOR, PLATFORM_LOGO } from "./logos";
import {
  hasStoredSettings,
  loadOpenInApp,
  loadSettings,
  saveOpenInApp,
  saveSettings,
  type EnabledPlatforms,
  type OpenInApp,
} from "./settings";

const APP_CAPABLE = new Set<string>(APP_SCHEME_PLATFORMS);

/** URL effective d'un lien selon la préférence web/app de la plateforme. */
function effectiveUrl(link: PlatformLink, openInApp: OpenInApp): string {
  if (openInApp[link.platform]) {
    return appSchemeUrl(link.platform, link.url) ?? link.url;
  }
  return link.url;
}

/** Applique la préférence web/app à une liste de liens. */
function withEffectiveUrls(links: PlatformLink[], openInApp: OpenInApp): PlatformLink[] {
  return links.map((l) => ({ ...l, url: effectiveUrl(l, openInApp) }));
}

const ALL_PLATFORMS = [...MAIN_PLATFORMS, ...BONUS_PLATFORMS];

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; result: ResolveResult };

export interface ResolverPanelProps {
  resolveLink: (url: string) => Promise<ResolveResponse>;
  /** fourni par la coquille Electron pour redonner le focus à l'affichage */
  inputRef?: React.RefObject<HTMLInputElement | null>;
  /** copie riche (HTML + texte) — Electron la fournit via IPC ; sur le web
   *  on retombe sur l'API Clipboard du navigateur */
  copyRich?: (html: string, text: string) => Promise<void>;
}

export function ResolverPanel({ resolveLink, inputRef, copyRich }: ResolverPanelProps) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [enabled, setEnabled] = useState<EnabledPlatforms>(loadSettings);
  const [openInApp, setOpenInApp] = useState<OpenInApp>(loadOpenInApp);
  const [showSettings, setShowSettings] = useState(false);
  // onboarding : au premier lancement d'une recherche, l'utilisateur choisit
  // ses plateformes ; on ne persiste qu'à partir de la validation
  const [stored, setStored] = useState(hasStoredSettings);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (stored) saveSettings(enabled);
  }, [enabled, stored]);

  useEffect(() => saveOpenInApp(openInApp), [openInApp]);

  const doResolve = useCallback(
    async (url: string) => {
      const id = ++requestId.current;
      setState({ status: "loading" });
      const res = await resolveLink(url);
      if (id !== requestId.current) return; // une résolution plus récente est en cours
      setState(
        res.ok ? { status: "done", result: res.result } : { status: "error", message: res.error },
      );
    },
    [resolveLink],
  );

  const resolve = useCallback(
    (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      if (!stored) {
        setPendingUrl(trimmed); // onboarding d'abord, résolution à la validation
        return;
      }
      doResolve(trimmed);
    },
    [stored, doResolve],
  );

  const finishOnboarding = () => {
    setStored(true);
    saveSettings(enabled);
    const url = pendingUrl;
    setPendingUrl(null);
    if (url) doResolve(url);
  };

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    setInput(text);
    setShowSettings(false);
    resolve(text);
    e.preventDefault();
  };

  const onboarding = pendingUrl !== null;

  return (
    <div className="flex flex-col gap-3 p-3 text-zinc-200 antialiased">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={input}
            spellCheck={false}
            autoFocus
            placeholder="Paste a Qobuz, Spotify, Apple Music or Deezer link…"
            onChange={(e) => setInput(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => e.key === "Enter" && resolve(input)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3.5 pr-8 text-[13px] text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-white/25 focus:bg-white/[0.07]"
          />
          {input && (
            <button
              onClick={() => {
                setInput("");
                setPendingUrl(null);
                setState({ status: "idle" });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              title="Clear"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => setShowSettings((v) => !v)}
          className={`shrink-0 rounded-xl p-2.5 transition ${
            showSettings ? "bg-white/10 text-zinc-200" : "text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
          }`}
          title={showSettings ? "Close settings" : "Settings"}
        >
          {showSettings ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          )}
        </button>
      </div>

      {showSettings ? (
        <div className="flex flex-col gap-1.5">
          <p className="px-1 text-[10px] uppercase tracking-wider text-zinc-500">Music platforms</p>
          <PlatformToggleList
            enabled={enabled}
            setEnabled={setEnabled}
            openInApp={openInApp}
            setOpenInApp={setOpenInApp}
            showAppMode
          />
          <p className="px-1 pt-1 text-[10px] leading-relaxed text-zinc-600">
            « App » : les boutons ouvrent l'app de bureau (si installée). Les liens copiés
            en texte restent des liens web cliquables.
          </p>
        </div>
      ) : onboarding ? (
        <div className="flex flex-col gap-3">
          <div className="px-1">
            <p className="text-[13px] font-semibold text-zinc-100">
              Which platforms do you want links for?
            </p>
            <p className="pt-0.5 text-[12px] text-zinc-500">
              You can change this anytime in settings.
            </p>
          </div>
          <PlatformToggleList enabled={enabled} setEnabled={setEnabled} />
          <button
            onClick={finishOnboarding}
            className="rounded-xl bg-zinc-100 py-2.5 text-[13px] font-semibold text-zinc-900 transition hover:bg-white"
          >
            Continue
          </button>
        </div>
      ) : (
        <>
          {state.status === "loading" && (
            <div className="flex justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
            </div>
          )}

          {state.status === "error" && (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-3.5 py-2.5 text-[13px] leading-relaxed text-red-300">
              {state.message}
            </div>
          )}

          {state.status === "done" && (
            <Result
              result={state.result}
              enabled={enabled}
              openInApp={openInApp}
              copyRich={copyRich}
            />
          )}
        </>
      )}
    </div>
  );
}

function PlatformToggleList({
  enabled,
  setEnabled,
  openInApp,
  setOpenInApp,
  showAppMode = false,
}: {
  enabled: EnabledPlatforms;
  setEnabled: React.Dispatch<React.SetStateAction<EnabledPlatforms>>;
  openInApp?: OpenInApp;
  setOpenInApp?: React.Dispatch<React.SetStateAction<OpenInApp>>;
  showAppMode?: boolean;
}) {
  const toggle = (p: string) => setEnabled((s) => ({ ...s, [p]: !s[p] }));
  const toggleApp = (p: string) => setOpenInApp?.((s) => ({ ...s, [p]: !s[p] }));

  return (
    <div className="flex flex-col gap-1.5">
      {ALL_PLATFORMS.map((p) => (
        <div
          key={p}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 transition hover:border-white/20 hover:bg-white/[0.08]"
        >
          <span style={{ color: PLATFORM_COLOR[p] ?? "#a1a1aa" }} className="shrink-0">
            {PLATFORM_LOGO(p, "h-4.5 w-4.5")}
          </span>
          <span className="flex-1 truncate text-[13px] font-medium text-zinc-200">
            {PLATFORM_NAMES[p]}
          </span>

          {showAppMode && enabled[p] && APP_CAPABLE.has(p) && (
            <span className="flex shrink-0 overflow-hidden rounded-lg border border-white/10 text-[10px] font-medium">
              <button
                onClick={() => openInApp?.[p] && toggleApp(p)}
                className={`px-2 py-0.5 transition ${
                  openInApp?.[p] ? "text-zinc-500 hover:text-zinc-300" : "bg-white/15 text-zinc-100"
                }`}
              >
                Web
              </button>
              <button
                onClick={() => !openInApp?.[p] && toggleApp(p)}
                className={`px-2 py-0.5 transition ${
                  openInApp?.[p] ? "bg-white/15 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                App
              </button>
            </span>
          )}

          <button
            onClick={() => toggle(p)}
            title={enabled[p] ? "Désactiver" : "Activer"}
            className={`relative h-5 w-9 shrink-0 rounded-full transition ${
              enabled[p] ? "bg-emerald-500/80" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                enabled[p] ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}

function Result({
  result,
  enabled,
  openInApp,
  copyRich,
}: {
  result: ResolveResult;
  enabled: EnabledPlatforms;
  openInApp: OpenInApp;
  copyRich?: (html: string, text: string) => Promise<void>;
}) {
  // liens web (https, toujours cliquables) et versions "app" (schéma de bureau)
  const webLinks = result.links.filter((l) => enabled[l.platform]);
  const webBonus = result.bonus.filter((l) => enabled[l.platform]);
  const links = withEffectiveUrls(webLinks, openInApp); // boutons : respectent le réglage
  const bonus = withEffectiveUrls(webBonus, openInApp);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-2.5">
        {result.image ? (
          <img
            src={result.image}
            alt=""
            className="h-12 w-12 shrink-0 rounded-lg object-cover shadow-lg shadow-black/40"
            draggable={false}
          />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white/10 text-lg">
            🎵
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-zinc-100" title={result.title}>
            {result.title}
          </p>
          <p className="truncate text-[12px] text-zinc-400" title={result.artist}>
            {result.artist}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {links.map((link) => (
          <PlatformRow key={link.platform} link={link} />
        ))}
      </div>

      {bonus.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {bonus.map((link) => (
            <BonusChip key={link.platform} link={link} />
          ))}
        </div>
      )}

      {links.length === 0 && bonus.length === 0 ? (
        <p className="py-1 text-center text-[13px] text-zinc-500">
          No platform enabled — open settings (gear icon).
        </p>
      ) : (
        <CopyAllButton
          result={result}
          webLinks={webLinks}
          webBonus={webBonus}
          appLinks={links}
          appBonus={bonus}
          copyRich={copyRich}
        />
      )}
    </div>
  );
}

/** Copie `text`, renvoie [copié?, déclencheur] avec retour visuel ~1,5 s */
function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };
  return [copied, copy];
}

function PlatformRow({ link }: { link: PlatformLink }) {
  const [copied, copy] = useCopy();
  const color = PLATFORM_COLOR[link.platform] ?? "#a1a1aa";
  const isWeb = /^https?:/i.test(link.url);

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-3.5 pr-1.5 transition hover:border-white/20 hover:bg-white/[0.08]">
      <a
        href={link.url}
        target={isWeb ? "_blank" : undefined}
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3"
        title={`Open in ${link.name}`}
      >
        <span style={{ color }} className="shrink-0">
          {PLATFORM_LOGO(link.platform, "h-4.5 w-4.5")}
        </span>
        <span className="truncate text-[13px] font-medium text-zinc-200">{link.name}</span>
        {link.kind === "search" && (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">
            search
          </span>
        )}
      </a>
      <button
        onClick={() => copy(link.url)}
        className={`shrink-0 rounded-lg p-2 transition ${
          copied ? "text-emerald-400" : "text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
        }`}
        title="Copy link"
      >
        {copied ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}

function BonusChip({ link }: { link: PlatformLink }) {
  const [copied, copy] = useCopy();
  return (
    <button
      onClick={() => copy(link.url)}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
        copied
          ? "border-emerald-500/40 text-emerald-400"
          : "border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200"
      }`}
      title={`Copy ${link.name} link`}
    >
      {copied ? "copied!" : link.name}
    </button>
  );
}

/** Pastille de couleur par plateforme principale, blanche pour les autres. */
const PLATFORM_HEART: Record<string, string> = {
  spotify: "🟢",
  appleMusic: "🔴",
  deezer: "🟣",
  qobuz: "⚫️",
  amazonMusic: "🔵",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Version texte brut (repli quand la cible n'accepte pas le HTML). */
function formatShareText(result: ResolveResult, links: PlatformLink[], bonus: PlatformLink[]): string {
  const lines = [`🎵 ${result.title} — ${result.artist}`, ""];
  for (const link of [...links, ...bonus]) {
    const heart = PLATFORM_HEART[link.platform] ?? "⚪️";
    lines.push(`${heart} ${link.name}: ${link.url}`);
  }
  return lines.join("\n");
}

/** Version HTML : titre en gras, nom de plateforme cliquable (URL masquée). */
function formatShareHtml(result: ResolveResult, links: PlatformLink[], bonus: PlatformLink[]): string {
  const rows = [...links, ...bonus].map((link) => {
    const heart = PLATFORM_HEART[link.platform] ?? "⚪️";
    return `${heart} <a href="${escapeHtml(link.url)}">${escapeHtml(link.name)}</a>`;
  });
  return (
    `🎵 <b>${escapeHtml(result.title)} — ${escapeHtml(result.artist)}</b>` +
    `<br><br>${rows.join("<br>")}`
  );
}

/** Écrit HTML + texte dans le presse-papiers. Electron passe par le main
 *  process (copyRich) ; le web utilise l'API Clipboard, avec repli texte. */
async function copyRichOrPlain(
  html: string,
  text: string,
  copyRich?: (html: string, text: string) => Promise<void>,
): Promise<void> {
  try {
    if (copyRich) return await copyRich(html, text);
    if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        }),
      ]);
      return;
    }
  } catch {
    // cible/permission sans copie riche : on retombe sur le texte brut
  }
  await navigator.clipboard.writeText(text);
}

function CopyAllButton({
  result,
  webLinks,
  webBonus,
  appLinks,
  appBonus,
  copyRich,
}: {
  result: ResolveResult;
  // texte brut : liens web https (cliquables partout, même en texte simple)
  webLinks: PlatformLink[];
  webBonus: PlatformLink[];
  // HTML : liens "app" (nom cliquable → ouvre l'app de bureau en contexte riche)
  appLinks: PlatformLink[];
  appBonus: PlatformLink[];
  copyRich?: (html: string, text: string) => Promise<void>;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onClick = async () => {
    await copyRichOrPlain(
      formatShareHtml(result, appLinks, appBonus),
      formatShareText(result, webLinks, webBonus),
      copyRich,
    );
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-xl py-2.5 text-[13px] font-semibold transition ${
        copied
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-zinc-100 text-zinc-900 hover:bg-white"
      }`}
    >
      {copied ? "Message copied!" : "Copy all"}
    </button>
  );
}
