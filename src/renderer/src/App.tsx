import { useCallback, useRef, useState } from "react";
import type { PlatformLink, ResolveResult } from "../../shared/types";
import { CheckIcon, CopyIcon, PLATFORM_COLOR, PLATFORM_LOGO } from "./logos";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; result: ResolveResult };

export default function App() {
  const [input, setInput] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });
  const requestId = useRef(0);

  const resolve = useCallback(async (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const id = ++requestId.current;
    setState({ status: "loading" });
    const res = await window.musicShare.resolveLink(trimmed);
    if (id !== requestId.current) return; // une résolution plus récente est en cours
    setState(res.ok ? { status: "done", result: res.result } : { status: "error", message: res.error });
  }, []);

  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    setInput(text);
    resolve(text);
    e.preventDefault();
  };

  return (
    <div className="min-h-screen text-zinc-200 antialiased">
      <header className="titlebar flex h-12 items-end justify-center pb-1">
        <h1 className="text-[13px] font-semibold tracking-wide text-zinc-400">Music Share</h1>
      </header>

      <main className="mx-auto flex max-w-md flex-col gap-4 px-5 pb-6 pt-2">
        <div className="titlebar-none relative">
          <input
            type="text"
            value={input}
            spellCheck={false}
            placeholder="Colle un lien Qobuz, Spotify, Apple Music ou Deezer…"
            onChange={(e) => setInput(e.target.value)}
            onPaste={onPaste}
            onKeyDown={(e) => e.key === "Enter" && resolve(input)}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[13px] text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-white/25 focus:bg-white/[0.07]"
          />
          {input && (
            <button
              onClick={() => {
                setInput("");
                setState({ status: "idle" });
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
              title="Effacer"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {state.status === "idle" && (
          <p className="pt-16 text-center text-[13px] leading-relaxed text-zinc-500">
            Colle un lien de partage pour obtenir
            <br />
            ses équivalents sur les autres plateformes.
          </p>
        )}

        {state.status === "loading" && (
          <div className="flex justify-center pt-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-200" />
          </div>
        )}

        {state.status === "error" && (
          <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-[13px] leading-relaxed text-red-300">
            {state.message}
          </div>
        )}

        {state.status === "done" && <Result result={state.result} />}
      </main>
    </div>
  );
}

function Result({ result }: { result: ResolveResult }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
        {result.image ? (
          <img
            src={result.image}
            alt=""
            className="h-20 w-20 shrink-0 rounded-lg object-cover shadow-lg shadow-black/40"
            draggable={false}
          />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-white/10 text-2xl">
            🎵
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-zinc-100" title={result.title}>
            {result.title}
          </p>
          <p className="truncate text-[13px] text-zinc-400" title={result.artist}>
            {result.artist}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {result.links.map((link) => (
          <PlatformRow key={link.platform} link={link} />
        ))}
      </div>

      {result.bonus.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {result.bonus.map((link) => (
            <BonusChip key={link.platform} link={link} />
          ))}
        </div>
      )}

      <CopyAllButton result={result} />
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
    <div className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3.5 pr-2 transition hover:border-white/20 hover:bg-white/[0.08]">
      <a
        href={link.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3"
        title={`Ouvrir dans ${link.name}`}
      >
        <span style={{ color }} className="shrink-0">
          {PLATFORM_LOGO(link.platform, "h-5 w-5")}
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

function formatShareMessage(result: ResolveResult): string {
  const lines = [`🎵 ${result.title} — ${result.artist}`, ""];
  for (const link of [...result.links, ...result.bonus]) {
    const suffix = link.kind === "search" ? " (recherche)" : "";
    lines.push(`${link.name}${suffix} : ${link.url}`);
  }
  return lines.join("\n");
}

function CopyAllButton({ result }: { result: ResolveResult }) {
  const [copied, copy] = useCopy();
  return (
    <button
      onClick={() => copy(formatShareMessage(result))}
      className={`rounded-xl py-3 text-[13px] font-semibold transition ${
        copied
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-zinc-100 text-zinc-900 hover:bg-white"
      }`}
    >
      {copied ? "Message copié !" : "Tout copier"}
    </button>
  );
}
