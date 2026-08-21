import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Frontend de la cible Tauri (bureau léger, WebView système).
export default defineConfig({
  root: "tauri-app",
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  build: {
    outDir: "../dist-tauri",
    emptyOutDir: true,
    target: "safari15", // WebView macOS (WKWebView)
  },
  server: {
    port: 8788,
    strictPort: true,
  },
});
