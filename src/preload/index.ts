import { contextBridge, ipcRenderer } from "electron";
import type { ResolveResponse } from "../shared/types";

const api = {
  resolveLink: (url: string): Promise<ResolveResponse> =>
    ipcRenderer.invoke("resolve-link", url),
};

export type MusicShareApi = typeof api;

contextBridge.exposeInMainWorld("musicShare", api);
