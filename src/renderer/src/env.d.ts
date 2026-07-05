/// <reference types="vite/client" />
import type { MusicShareApi } from "../../preload/index";

declare global {
  interface Window {
    musicShare: MusicShareApi;
  }
}

export {};
