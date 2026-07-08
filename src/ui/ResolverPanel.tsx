/**
 * Panneau complet de résolution (input, paramètres, résultats), partagé
 * entre l'app Electron (overlay barre de menus) et la page web. Chaque
 * coquille fournit sa fonction `resolveLink` (IPC côté Electron, fetch
 * vers /api/resolve côté web).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlatformLink, ResolveResponse, ResolveResult } from "../shared/types";
import { BONUS_PLATFORMS, MAIN_PLATFORMS, PLATFORM_NAMES } from "../shared/platforms";
import { CheckIcon, CopyIcon, PLATFORM_COLOR, PLATFORM_LOGO } from "./logos";
import { loadSettings, saveSettings, type EnabledPlatforms } from "./settings";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; result: ResolveResult };

export interface ResolverPanelProps {
  resolveLink: (url: string) => Promise<ResolveResponse>;
  /** fourni par la coquille Electron pour redonner le focus à l'affichage */
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export function ResolverPanel({ resolveLink, inputRef }: ResolverPanelProps) {
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const [enabled, setEnabled] = useState<EnabledPlatforms>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const requestId = useRef(0);

  useEffect(() => saveSettings(enabled), [enabled]);

  const resolve = useCallback(
    async (url: string) => {
      const trimmed = url.trim();
      if (!trimmed) return;
      const id = ++requestId.current;
      setState({ status: "loading" });
      const res = await resolveLink(trimmed);
      if (id !== requestId.current) return; // une résolution plus récente est en cours
      setState(
        res.ok ? { status: "done", result: res.result } : { status: "error", message: res.error },
      );
    },
    [resolveLink],
  );

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    setInput(text);
    setShowSettings(false);
    resolve(text);
    e.preventDefault();
  };

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
            placeholder="Colle un lien Qobuz, Spotify, Apple Music, Deezer…"
            onChange={(e) => setInput(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => e.key === "Enter" && resolve(input)}
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3.5 pr-8 text-[13px] text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-white/25 focus:bg-white/[0.07]"
          />
          {input && (
            <button
              onClick={() => {
                setInput("");
                setState({ status: "idle" });
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              title="Effacer"
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
          title={showSettings ? "Fermer les paramètres" : "Paramètres"}
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
        <Settings enabled={enabled} setEnabled={setEnabled} />
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

          {state.status === "done" && <Result result={state.result} enabled={enabled} />}
        </>
      )}
    </div>
  );
}

function Settings({
  enabled,
  setEnabled,
}: {
  enabled: EnabledPlatforms;
  setEnabled: React.Dispatch<React.SetStateAction<EnabledPlatforms>>;
}) {
  const toggle = (p: string) => setEnabled((s) => ({ ...s, [p]: !s[p] }));

  const row = (p: string) => (
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
  );

  return (
    <div className="flex flex-col gap-1.5">
      <p className="px-1 text-[10px] uppercase tracking-wider text-zinc-500">
        Plateformes principales
      </p>
      {MAIN_PLATFORMS.map(row)}
      <p className="px-1 pt-2 text-[10px] uppercase tracking-wider text-zinc-500">
        Autres plateformes
      </p>
      {BONUS_PLATFORMS.map(row)}
    </div>
  );
}

function Result({ result, enabled }: { result: ResolveResult; enabled: EnabledPlatforms }) {
  const links = result.links.filter((l) => enabled[l.platform]);
  const bonus = result.bonus.filter((l) => enabled[l.platform]);
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
          Aucune plateforme activée — ouvre les paramètres (roue dentée).
        </p>
      ) : (
        <CopyAllButton result={result} links={links} bonus={bonus} />
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

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-3.5 pr-1.5 transition hover:border-white/20 hover:bg-white/[0.08]">
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3"
        title={`Ouvrir dans ${link.name}`}
      >
        <span style={{ color }} className="shrink-0">
          {PLATFORM_LOGO(link.platform, "h-4.5 w-4.5")}
        </span>
        <span className="truncate text-[13px] font-medium text-zinc-200">{link.name}</span>
        {link.kind === "search" && (
          <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-zinc-500">
            recherche
          </span>
        )}
      </a>
      <button
        onClick={() => copy(link.url)}
        className={`shrink-0 rounded-lg p-2 transition ${
          copied ? "text-emerald-400" : "text-zinc-500 hover:bg-white/10 hover:text-zinc-200"
        }`}
        title="Copier le lien"
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
      title={`Copier le lien ${link.name}`}
    >
      {copied ? "copié !" : link.name}
    </button>
  );
}

function formatShareMessage(result: ResolveResult, links: PlatformLink[], bonus: PlatformLink[]): string {
  const lines = [`🎵 ${result.title} — ${result.artist}`, ""];
  for (const link of [...links, ...bonus]) {
    lines.push(`${link.name} : ${link.url}`);
  }
  return lines.join("\n");
}

function CopyAllButton({
  result,
  links,
  bonus,
}: {
  result: ResolveResult;
  links: PlatformLink[];
  bonus: PlatformLink[];
}) {
  const [copied, copy] = useCopy();
  return (
    <button
      onClick={() => copy(formatShareMessage(result, links, bonus))}
      className={`rounded-xl py-2.5 text-[13px] font-semibold transition ${
        copied
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-zinc-100 text-zinc-900 hover:bg-white"
      }`}
    >
      {copied ? "Message copié !" : "Tout copier"}
    </button>
  );
}
