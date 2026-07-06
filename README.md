# Streamylink (Music Share)

Utilitaire de barre de menus macOS : colle un lien de partage **Qobuz, Spotify,
Apple Music ou Deezer**, obtiens les liens équivalents sur les autres
plateformes (+ TIDAL, Amazon Music… via Odesli), copie-les un par un ou en un
message formaté.

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
npm run dev          # app en mode dev (HMR)
npm run test:chain   # teste la chaîne de résolution en console :
                     # npx tsx test-chain.ts <url>
npm run typecheck
```

## Distribution

```bash
npm run dist         # dmg x64 non signé dans release/
```

Le `.dmg` n'est pas signé/notarisé (usage interne) : au premier lancement,
clic droit sur l'app → « Ouvrir », ou autoriser dans Réglages Système →
Confidentialité et sécurité.
