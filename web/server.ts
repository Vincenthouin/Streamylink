/**
 * Serveur de la version web : sert le frontend buildé (dist-web) et expose
 * GET /api/resolve?url=… qui exécute le même resolver que l'app Electron.
 *
 * Dev  : npm run web:api   (API seule, le frontend est servi par Vite)
 * Prod : npm run web:build && npm run web:start
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveLink, ResolveError } from "../src/core/resolver";
import type { ResolveResponse } from "../src/shared/types";

const PORT = Number(process.env.PORT ?? 8787);
const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist-web");

// cache mémoire : un même lien partagé plusieurs fois ne coûte qu'une
// résolution (les APIs amont sont limitées en débit, Odesli surtout)
const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; response: ResolveResponse }>();

async function handleResolve(target: string): Promise<ResolveResponse> {
  const cached = cache.get(target);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.response;

  let response: ResolveResponse;
  try {
    response = { ok: true, result: await resolveLink(target) };
  } catch (e) {
    if (e instanceof ResolveError) response = { ok: false, error: e.message };
    else {
      console.error(e);
      response = { ok: false, error: "Unexpected error while resolving." };
    }
  }
  if (response.ok) cache.set(target, { at: Date.now(), response });
  return response;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost`);

  if (url.pathname === "/api/resolve") {
    const target = url.searchParams.get("url")?.trim();
    const response: ResolveResponse = target
      ? await handleResolve(target)
      : { ok: false, error: "Missing url parameter." };
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(response));
    return;
  }

  // frontend statique, avec fallback SPA sur index.html
  const safePath = path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, "");
  let filePath = path.join(DIST, safePath);
  if (!filePath.startsWith(DIST) || !existsSync(filePath) || safePath === "/") {
    filePath = path.join(DIST, "index.html");
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath)] ?? "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found — as-tu lancé npm run web:build ?");
  }
});

server.listen(PORT, () => {
  console.log(`Music Share web : http://localhost:${PORT}`);
});
