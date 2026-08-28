/**
 * Panneau complet de résolution (input, onboarding, paramètres, résultats),
 * partagé entre l'app Electron (overlay barre de menus) et la page web.
 * Chaque coquille fournit sa fonction `resolveLink` (IPC côté Electron,
 * fetch vers /api/resolve côté web). Interface en anglais.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlatformLink, ResolveResponse, ResolveResult } from "../shared/types";
import { BONUS_PLATFORMS, MAIN_PLATFORMS, PLATFORM_NAMES } from "../shared/platforms";
import { CheckIcon, CopyIcon, PLATFORM_COLOR, PLATFORM_LOGO } from "./logos";
import {
  hasStoredSettings,
  loadSettings,
  saveSettings,
  type EnabledPlatforms,
} from "./settings";

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
  /** version de l'app, affichée en bas des paramètres */
  version?: string;
  /** lien reçu via la cible de partage (web) : résolu automatiquement au chargement */
  initialUrl?: string;
}

export function ResolverPanel({
  resolveLink,
  inputRef,
  copyRich,
  version,
  initialUrl,
}: ResolverPanelProps) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [enabled, setEnabled] = useState<EnabledPlatforms>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  // onboarding : au premier lancement d'une recherche, l'utilisateur choisit
  // ses plateformes ; on ne persiste qu'à partir de la validation
  const [stored, setStored] = useState(hasStoredSettings);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    if (stored) saveSettings(enabled);
  }, [enabled, stored]);


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

  // lien reçu via la cible de partage : pré-remplit et résout une fois
  useEffect(() => {
    if (initialUrl) {
      setInput(initialUrl);
      resolve(initialUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    setInput(text);
    setShowSettings(false);
    resolve(text);
    e.preventDefault();
  };

  // bouton « Coller » : lit le presse-papier (sur iOS, affiche la confirmation
  // native). On ne peut PAS savoir à l'avance s'il contient quelque chose.
  // Restreint au mobile (appareils tactiles) : sur desktop on utilise ⌘V.
  const canPaste =
    typeof navigator !== "undefined" &&
    !!navigator.clipboard?.readText &&
    navigator.maxTouchPoints > 0;
  const pasteFromClipboard = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (text) {
        setInput(text);
        setShowSettings(false);
        resolve(text);
      }
    } catch {
      /* refusé ou vide : on ne fait rien */
    }
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
            placeholder=""
            aria-label="Paste a Spotify, Apple Music, Deezer or Qobuz link"
            onChange={(e) => setInput(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => e.key === "Enter" && resolve(input)}
            className={`w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3.5 text-[13px] text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-white/25 focus:bg-white/[0.07] ${
              !input && canPaste ? "pr-[68px]" : "pr-8"
            }`}
          />
          {!input && <RotatingPlaceholder rightGap={canPaste} />}
          {input ? (
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
          ) : canPaste ? (
            <button
              onClick={pasteFromClipboard}
              className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-[11px] font-medium text-zinc-300 transition hover:bg-white/15 hover:text-zinc-100"
              title="Paste from clipboard"
            >
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Paste
            </button>
          ) : null}
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
          <PlatformToggleList enabled={enabled} setEnabled={setEnabled} />
          {version && (
            <p className="pt-2 text-center text-[10px] text-zinc-600">Version {version}</p>
          )}
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
            <Result result={state.result} enabled={enabled} copyRich={copyRich} />
          )}
        </>
      )}
    </div>
  );
}

/** Placeholder animé : « Paste your <Platform> link » qui défile toutes les 2 s
 *  (le libellé courant glisse vers le haut, le suivant arrive du bas). */
const PLATFORM_PROMPTS = ["Spotify", "Apple Music", "Deezer", "Qobuz", "Amazon Music", "Tidal"];

function RotatingPlaceholder({ rightGap }: { rightGap: boolean }) {
  const [i, setI] = useState(0);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    const id = setInterval(() => setI((n) => n + 1), 2000);
    return () => clearInterval(id);
  }, []);

  // boucle sans à-coup : on duplique le 1er libellé en fin de rouleau, et
  // arrivé dessus on revient à 0 sans transition
  const items = [...PLATFORM_PROMPTS, PLATFORM_PROMPTS[0]];
  const onTransitionEnd = () => {
    if (i === PLATFORM_PROMPTS.length) {
      setAnimate(false);
      setI(0);
    }
  };
  useEffect(() => {
    if (!animate) {
      const r = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(r);
    }
  }, [animate]);

  return (
    <div
      aria-hidden
      className={`rotating-ph pointer-events-none absolute left-3.5 top-1/2 flex -translate-y-1/2 items-center overflow-hidden whitespace-nowrap text-[13px] text-zinc-500 ${
        rightGap ? "right-[68px]" : "right-8"
      }`}
    >
      Paste your&nbsp;
      {/* seul le nom de plateforme défile ; « Paste your » et « link » restent fixes */}
      <span className="inline-block h-[1.4em] overflow-hidden align-middle">
        <span
          className="block"
          style={{
            transform: `translateY(-${i * 1.4}em)`,
            transition: animate ? "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
          }}
          onTransitionEnd={onTransitionEnd}
        >
          {items.map((p, idx) => (
            <span key={idx} className="block h-[1.4em] leading-[1.4em]">
              {p}
            </span>
          ))}
        </span>
      </span>
      &nbsp;link
    </div>
  );
}

function PlatformToggleList({
  enabled,
  setEnabled,
}: {
  enabled: EnabledPlatforms;
  setEnabled: React.Dispatch<React.SetStateAction<EnabledPlatforms>>;
}) {
  const toggle = (p: string) => setEnabled((s) => ({ ...s, [p]: !s[p] }));

  return (
    <div className="flex flex-col gap-1.5">
      {ALL_PLATFORMS.map((p) => (
        <button
          key={p}
          onClick={() => toggle(p)}
          className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-left transition hover:border-white/20 hover:bg-white/[0.08]"
        >
          <span style={{ color: PLATFORM_COLOR[p] ?? "#a1a1aa" }} className="shrink-0">
            {PLATFORM_LOGO(p, "h-4.5 w-4.5")}
          </span>
          <span className="flex-1 truncate text-[13px] font-medium text-zinc-200">
            {PLATFORM_NAMES[p]}
          </span>
          <span
            className={`relative h-5 w-9 shrink-0 rounded-full transition ${
              enabled[p] ? "bg-emerald-500/80" : "bg-white/15"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                enabled[p] ? "left-[18px]" : "left-0.5"
              }`}
            />
          </span>
        </button>
      ))}
    </div>
  );
}

function Result({
  result,
  enabled,
  copyRich,
}: {
  result: ResolveResult;
  enabled: EnabledPlatforms;
  copyRich?: (html: string, text: string) => Promise<void>;
}) {
  const links = result.links.filter((l) => enabled[l.platform]);
  const bonus = result.bonus.filter((l) => enabled[l.platform]);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
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
        <div className="flex flex-col gap-2">
          {canShare && <ShareButton result={result} links={links} bonus={bonus} />}
          <CopyAllButton
            result={result}
            links={links}
            bonus={bonus}
            copyRich={copyRich}
            secondary={canShare}
          />
        </div>
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

/** Bouton de partage natif (feuille de partage iOS/Android/macOS via Web Share API). */
function ShareButton({
  result,
  links,
  bonus,
}: {
  result: ResolveResult;
  links: PlatformLink[];
  bonus: PlatformLink[];
}) {
  const onShare = async () => {
    try {
      await navigator.share({
        title: `${result.title} — ${result.artist}`,
        text: formatShareText(result, links, bonus),
      });
    } catch {
      /* partage annulé par l'utilisateur */
    }
  };
  return (
    <button
      onClick={onShare}
      className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 py-2.5 text-[13px] font-semibold text-zinc-900 transition hover:bg-white"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
      Share
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
  links,
  bonus,
  copyRich,
  secondary = false,
}: {
  result: ResolveResult;
  // toujours des liens web https : seuls eux sont cliquables dans les
  // messageries (Teams, Slack…), qui bloquent les schémas d'app
  links: PlatformLink[];
  bonus: PlatformLink[];
  copyRich?: (html: string, text: string) => Promise<void>;
  /** style discret quand un bouton « Share » primaire est présent au-dessus */
  secondary?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onClick = async () => {
    await copyRichOrPlain(
      formatShareHtml(result, links, bonus),
      formatShareText(result, links, bonus),
      copyRich,
    );
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  const base = copied
    ? "bg-emerald-500/15 text-emerald-400"
    : secondary
      ? "border border-white/10 bg-white/5 text-zinc-200 hover:bg-white/10"
      : "bg-zinc-100 text-zinc-900 hover:bg-white";

  return (
    <button
      onClick={onClick}
      className={`rounded-xl py-2.5 text-[13px] font-semibold transition ${base}`}
    >
      {copied ? "Message copied!" : "Copy all"}
    </button>
  );
}
