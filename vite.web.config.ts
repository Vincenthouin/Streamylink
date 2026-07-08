import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Config de la cible web (la cible Electron est dans electron.vite.config.ts)
export default defineConfig({
  root: "web",
  plugins: [react(), tailwindcss()],
  build: {
    outDir: "../dist-web",
    emptyOutDir: true,
  },
  server: {
    // en dev, l'API tourne à part : npm run web:api
    proxy: { "/api": "http://localhost:8787" },
  },
});
