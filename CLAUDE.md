# Music Share (repo GitHub : Vincenthouin/Streamylink)

Colle un lien Qobuz / Spotify / Apple Music / Deezer → obtiens les liens
équivalents sur les autres plateformes. Deux supports iso-fonctionnels :
- **Web** : `https://streamylink.vincent-thou.in` (PWA)
- **App macOS** (barre de menus, Tauri)

⚠️ **Toute évolution fonctionnelle doit être faite sur les DEUX supports.**
La logique et l'UI sont partagées ; seules les « coquilles » diffèrent.

## Architecture
- `src/core/resolver.ts` : **logique de résolution partagée** (pure). `fetch`
  injectable via `setFetch()` (Tauri y branche son plugin HTTP sans CORS).
- `src/ui/ResolverPanel.tsx` : **toute l'UI partagée** (input, onboarding,
  paramètres, résultats, copie). `src/ui/settings.ts`, `src/ui/logos.tsx`.
- `src/shared/` : types, `platforms.ts` (liste + noms).
- **Coquilles** :
  - `web/` : frontend Vite + serveur Node (`web/server.ts`) statique +
    `POST /api/resolve` (cache 1 h). Config `vite.web.config.ts`.
  - `tauri-app/` + `src-tauri/` : desktop Tauri (Rust). Frontend réutilise
    `src/ui`. Config `vite.tauri.config.ts`.
  - `src/main` + `src/renderer` + `src/preload` : **Electron, DÉPRÉCIÉ** (gardé
    mais plus utilisé ; le desktop est Tauri depuis v2.0.0).

## Pièges de résolution (importants)
- **Odesli ne fournit plus Spotify/Apple Music/YouTube** (coupé en 2025) → on
  résout en direct : Deezer par ISRC puis recherche texte (ignorer
  `readable:false`) ; Apple Music via iTunes Search (FR puis US) + fallback
  **lookup par UPC d'album Deezer** (l'index de recherche iTunes rate les
  sorties récentes). Odesli sert seulement les bonus (Tidal, Amazon…).
- **Spotify/Qobuz en sortie = liens de recherche** (pas d'API publique sans clé).
- **Qobuz** : les OG tags ne sont servis qu'aux crawlers ; on interroge
  l'endpoint `www.qobuz.com/opengraph/(track|album)/<id>` (CORS ouvert, UA
  navigateur). Le **CDN Qobuz (Varnish) renvoie 403 à toutes les IP de
  datacenter** → sur le web, c'est le **navigateur** qui fetch la page OG et
  POST le HTML au serveur (`qobuzOgUrl`, `parseQobuzOgHtml`).
- **Single Qobuz** (`/album/<id>` à 1 piste) : pas d'ISRC sur la page album →
  suivre `music:song` vers la page piste (`qobuzSingleTrackUrl`).
- **Deezer** : `api.deezer.com` renvoie des erreurs de quota transitoires
  depuis Render → tous les appels passent par `deezerJson()` (retry). Liens
  courts `link.deezer.com/s/…` et mobile `dzr.page.link` : suivre la redirection.
- **`get()` du resolver** retente 3× les échecs réseau/timeout (Spotify/Qobuz
  expirent ponctuellement depuis l'IP serveur).

## Desktop = Tauri (arm64, non signé)
- ~17 Mo app / ~6 Mo dmg. **Apple Silicon uniquement** (pas d'Intel).
- **Auto-update** (plugin updater) : clé privée dans `~/.tauri/musicshare-updater.key`
  (hors repo, À SAUVEGARDER). Manifeste `latest.json` sur GitHub Releases.
  Détection au démarrage + à l'ouverture de la fenêtre (throttle 1 min) + toutes
  les 6 h. Installation **sur clic** (jamais auto). Notes de version dans le
  bandeau via `UPDATE_NOTES` → champ `notes` de `latest.json`.
- **Signature** : `scripts/make-release.sh` re-signe le bundle ad-hoc
  (`codesign --force --deep -s -`) car Tauri ajoute l'icône après la signature
  du binaire → sinon « app endommagée » sur Apple Silicon.
- **Archive d'update** : `tar` avec `COPYFILE_DISABLE=1 --no-xattrs` (sinon
  fichiers AppleDouble `._*` → l'updater échoue à décompresser).
- **Nom stable** : `Music-Share-mac.dmg` (lien `releases/latest/download/…`
  toujours à jour ; carte de téléchargement du site pointe dessus).
- **Icône tray** : `resources/trayTemplate@2x.png` (générée par
  `scripts/gen-tray-icon.mjs` — NE PAS utiliser qlmanage, alpha cassé).
- **Coquille Rust** (`src-tauri/src/lib.rs`) : tray, fenêtre popover sous
  l'icône, masquage au blur/Échap, pas d'icône Dock (Accessory), commande
  `copy_rich` (arboard), `open_external` (ouvre http + schémas via `open`).
  Log fichier : `~/Library/Logs/com.uxteam.musicshare/Music Share.log`.
- **Raccourci clavier global : ABANDONNÉ.** Le plugin Tauri enregistre le
  raccourci mais macOS ne livre jamais les événements à l'app (testé accessory
  ET regular). Un raccourci fiable exigerait un moniteur clavier natif +
  permission Accessibilité + signature Developer ID ($99/an). Retiré en v2.2.15.

## Hébergement web
- **Render** (plan free, cold start ~1 min), redéploie à chaque `git push` sur
  `main`. Config `render.yaml`. Domaine `streamylink.vincent-thou.in` via CNAME
  dans la zone DNS OVH du domaine `vincent-thou.in`.
- **PWA** : `web/public/manifest.webmanifest` (icônes, `orientation: portrait`
  — respecté sur Android, ignoré iOS ; `share_target` — Android seulement, iOS
  ne supporte pas la réception de partage). Icônes `web/public/icons/`.
- **Partage natif** (Web Share API) : bouton « Share » si `navigator.share`
  existe (iOS/Android/Safari macOS). `share_target` GET `/` → `initialUrl`
  résout auto au chargement.
- **Mobile** : input à 16px (évite le zoom iOS au focus), `overflow-x hidden`,
  carte « Also available on Mac » masquée si `navigator.maxTouchPoints > 0`.

## Commandes
- Web : `npm run web:dev` (+ `web:api`), `npm run web:build`, `web:start`.
- Desktop dev : `npm run tauri:dev`. Release : `npm run tauri:release`
  (= build app + `make-release.sh` → dmg + tar.gz + sig + latest.json).
  Puis `gh release create vX.Y.Z <dmg> <tar.gz> <latest.json> …`.
  Passer les notes : `export UPDATE_NOTES=$'…' && npm run tauri:release`.
- `npm run test:chain -- <url>` : teste la résolution en console.
- `npx tsc --noEmit` : typecheck.

## Workflow de déploiement
- **Web** : commit + `git push origin main` → Render redéploie (~1-2 min).
- **Desktop** : bump version (package.json + src-tauri/tauri.conf.json +
  src-tauri/Cargo.toml), `npm run tauri:release`, `gh release create`.
  Toujours bumper le n° partout. Vérifier `._ : 0` dans le tar.gz.

## Gotchas d'environnement (ce Mac)
- **NE JAMAIS `pkill -f "Music Share.app"`** : ça tue l'app installée de
  l'utilisateur dans /Applications. Cibler uniquement le build de test par son
  chemin : `pkill -f "Desktop/Music_Share/src-tauri/target/release/…"`.
- **Accès Desktop (TCC macOS) intermittent** : le shell perd parfois l'accès à
  `~/Desktop` (`Operation not permitted`). Contournement git : depuis `/tmp`,
  `export GIT_DIR=".../.git" GIT_WORK_TREE="…"` puis git. Sinon demander à
  l'utilisateur d'accorder « Accès complet au disque » au terminal.
- Preview : outils `mcp__Claude_Preview__*` parfois déconnectés → utiliser le
  Browser pane `mcp__Claude_Browser__*`.

## Utilisateur
UX (Somfy), francophone. Soigner la simplicité de l'UI. Répondre en français.

## Placeholder animé & collage mobile (fait)
Dans `ResolverPanel.tsx` — `RotatingPlaceholder` : seul le nom de plateforme
défile en rouleau (translateY), et la **largeur du slot est mesurée par nom**
(`useLayoutEffect` + `getBoundingClientRect`, items en `w-max`) puis animée pour
que « link » glisse au lieu de laisser un blanc fixe. Collage : plus de bouton
Coller — `pasteFromClipboard()` se déclenche au **tap sur l'input vide**
(`onClick`, mobile via `navigator.maxTouchPoints>0`) ; impossible au page load
(geste requis). Vérif live via config launch `web-dev` (Vite HMR, `web:start`
sert un `dist-web/` **périmé**).
