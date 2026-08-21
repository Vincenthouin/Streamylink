import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// Config de la cible web (la cible Electron est dans electron.vite.config.ts)
export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: {
    outDir: "../dist-web",
    emptyOutDir: true,
  },
  server: {
    // en dev, l'API tourne à part : npm run web:api
    proxy: { "/api": "http://localhost:8787" },
  },
});
