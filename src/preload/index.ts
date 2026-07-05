import { contextBridge, ipcRenderer } from "electron";
import type { ResolveResponse } from "../shared/types";

const api = {
  resolveLink: (url: string): Promise<ResolveResponse> =>
    ipcRenderer.invoke("resolve-link", url),
  /** Demande à la fenêtre d'adopter la hauteur du contenu (bornée côté main). */
  setHeight: (height: number): void => {
    ipcRenderer.send("set-height", height);
  },
  hide: (): void => {
    ipcRenderer.send("hide-window");
  },
  /** Appelé quand la fenêtre est (ré)affichée depuis la barre de menus. */
  onShown: (cb: () => void): (() => void) => {
    const listener = () => cb();
    ipcRenderer.on("shown", listener);
    return () => ipcRenderer.removeListener("shown", listener);
  },
};

export type MusicShareApi = typeof api;

contextBridge.exposeInMainWorld("musicShare", api);
