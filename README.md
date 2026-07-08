# Streamylink (Music Share)

Colle un lien de partage **Qobuz, Spotify, Apple Music ou Deezer**, obtiens
les liens équivalents sur les autres plateformes (+ TIDAL, Amazon Music… via
Odesli), copie-les un par un ou en un message formaté.

Deux supports, même UI et même logique :
- **app macOS** : utilitaire de barre de menus (overlay)
- **page web** : frontend + petit serveur Node (`web/`), auto-hébergeable

Toute évolution fonctionnelle doit être appliquée aux deux supports — la
logique (`src/core/resolver.ts`) et l'interface (`src/ui/ResolverPanel.tsx`)
sont partagées, seules les « coquilles » diffèrent (`src/main` + `src/renderer`
pour Electron, `web/` pour le web).

## Fonctionnement

1. Les métadonnées (titre / artiste / ISRC / pochette) sont extraites de la
   page du lien collé — balises Open Graph servies aux crawlers pour
   Qobuz/Spotify, APIs publiques pour Deezer et Apple Music.
2. Deezer est résolu par ISRC (match exact) puis recherche texte en fallback.
3. Apple Music est résolu via l'API iTunes Search (publique, sans clé).
4. Spotify et Qobuz (sens inverse) sont des liens de recherche : pas d'API
   publique sans clé, et Odesli ne fournit plus Spotify/Apple Music depuis
   2025.
5. Odesli fournit les liens bonus (TIDAL, Amazon Music…).

## Stack

Electron + Vite (electron-vite) + React + TypeScript + Tailwind CSS.
Fenêtre overlay frameless attachée à l'icône de la barre de menus,
hauteur adaptée au contenu, IPC avec `contextIsolation` + `sandbox`.

## Développement

```bash
npm install
npm run dev          # app Electron en mode dev (HMR)
npm run web:api      # API web en dev (port 8787)…
npm run web:dev      # …et frontend web avec HMR (proxy /api → 8787)
npm run test:chain   # teste la chaîne de résolution en console :
                     # npx tsx test-chain.ts <url>
npm run typecheck
```

## Distribution

```bash
npm run dist         # dmg x64 non signé dans release/
npm run web:build    # frontend + serveur bundlés dans dist-web/
npm run web:start    # sert dist-web (PORT=8787 par défaut)
```

Pour héberger la version web : `npm install && npm run web:build` puis
`node dist-web/server.mjs` (variable `PORT` respectée) — un `Procfile` ou
service systemd suffit. Le serveur met en cache les résolutions (1 h).

Le `.dmg` n'est pas signé/notarisé (usage interne) : au premier lancement,
clic droit sur l'app → « Ouvrir », ou autoriser dans Réglages Système →
Confidentialité et sécurité.
