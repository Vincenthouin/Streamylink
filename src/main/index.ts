import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { resolveLink, ResolveError } from "./resolver";
import type { ResolveResponse } from "../shared/types";

function createWindow(): void {
  const win = new BrowserWindow({
    width: 480,
    height: 680,
    minWidth: 480,
    maxWidth: 560,
    minHeight: 480,
    show: false,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0c0c10",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win.show());

  // les liens s'ouvrent dans le navigateur / l'app de streaming, pas dans la fenêtre
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(process.env.ELECTRON_RENDERER_URL ?? "file://")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}

ipcMain.handle("resolve-link", async (_e, url: string): Promise<ResolveResponse> => {
  try {
    return { ok: true, result: await resolveLink(url) };
  } catch (e) {
    if (e instanceof ResolveError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Erreur inattendue pendant la résolution." };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  app.quit();
});
