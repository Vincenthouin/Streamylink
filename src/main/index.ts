import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, shell, Tray } from "electron";
import path from "node:path";
import fs from "node:fs";
import trayIconPath from "../../resources/trayTemplate.png?asset";
import trayIcon2xPath from "../../resources/trayTemplate@2x.png?asset";
import { resolveLink, ResolveError } from "./resolver";
import type { ResolveResponse } from "../shared/types";

const WIN_WIDTH = 440;
const MIN_HEIGHT = 66; // input seul
const MAX_HEIGHT = 620; // au-delà, le contenu scrolle

let win: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: WIN_WIDTH,
    height: MIN_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    roundedCorners: true,
    backgroundColor: "#0c0c10",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // au-dessus des autres fenêtres et visible sur tous les espaces,
  // comme un popover de barre de menus
  w.setAlwaysOnTop(true, "pop-up-menu");
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  w.on("blur", () => w.hide());
  w.on("close", (e) => {
    if (!quitting) {
      e.preventDefault();
      w.hide();
    }
  });

  // les liens s'ouvrent dans le navigateur / l'app de streaming, pas dans la fenêtre
  w.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  w.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(process.env.ELECTRON_RENDERER_URL ?? "file://")) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    w.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    w.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  return w;
}

/** Centre la fenêtre sous l'icône de la barre de menus, sans déborder de l'écran. */
function positionWindow(): void {
  if (!win || !tray) return;
  const b = tray.getBounds();
  const display = screen.getDisplayNearestPoint({ x: b.x, y: b.y });
  const area = display.workArea;
  const { width, height } = win.getBounds();
  const x = Math.min(
    Math.max(Math.round(b.x + b.width / 2 - width / 2), area.x + 8),
    area.x + area.width - width - 8,
  );
  const y = Math.round(b.y + b.height + 6);
  win.setBounds({ x, y, width, height }, false);
}

function showWindow(): void {
  if (!win) return;
  positionWindow();
  win.show();
  win.focus();
  win.webContents.send("shown");
}

function toggleWindow(): void {
  if (!win) return;
  if (win.isVisible()) win.hide();
  else showWindow();
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

// le renderer mesure son contenu et pilote la hauteur de la fenêtre
ipcMain.on("set-height", (_e, contentHeight: number) => {
  if (!win) return;
  const height = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, Math.round(contentHeight)));
  const { x, y, width } = win.getBounds();
  win.setBounds({ x, y, width, height }, false);
});

ipcMain.on("hide-window", () => win?.hide());

app.whenReady().then(() => {
  app.dock?.hide(); // utilitaire de barre de menus : pas d'icône Dock

  win = createWindow();

  // image template (noir + alpha) : macOS l'adapte aux barres claires/sombres
  const icon = nativeImage.createFromPath(trayIconPath);
  icon.addRepresentation({ scaleFactor: 2, buffer: fs.readFileSync(trayIcon2xPath) });
  icon.setTemplateImage(true);

  tray = new Tray(icon);
  tray.setToolTip("Music Share");
  tray.on("click", toggleWindow);
  tray.on("right-click", () => {
    tray!.popUpContextMenu(
      Menu.buildFromTemplate([{ label: "Quitter Music Share", role: "quit" }]),
    );
  });

  win.webContents.once("did-finish-load", () => showWindow());
});

app.on("before-quit", () => {
  quitting = true;
});

// app de barre de menus : on ne quitte pas quand la fenêtre se masque
app.on("window-all-closed", () => {});
