# Music Share (repo GitHub : Vincenthouin/Streamylink)

Colle un lien Qobuz/Spotify/Apple Music/Deezer → liens équivalents sur les autres
plateformes. Deux supports **iso-fonctionnels** : **Web** (PWA, streamylink.vincent-thou.in)
et **App macOS** (barre de menus, Tauri). ⚠️ **Toute évolution fonctionnelle = les DEUX
supports.** Logique + UI partagées ; seules les coquilles diffèrent.

## Architecture
- `src/core/resolver.ts` : résolution partagée (pure), `fetch` injectable via `setFetch()`.
- `src/ui/ResolverPanel.tsx` : **toute l'UI partagée** (+ `settings.ts`, `logos.tsx`, `theme.css`).
- `src/shared/` : types, `platforms.ts`.
- Coquilles : `web/` (Vite + `web/server.ts` : `POST /api/resolve`, cache 1 h) · `tauri-app/`+`src-tauri/` (Rust) · `src/main|renderer|preload` = **Electron DÉPRÉCIÉ**.

## Pièges de résolution
- **Odesli ne sert plus Spotify/Apple/YouTube** (2025) → résolution directe : Deezer par ISRC
  puis recherche texte (ignorer `readable:false`) ; Apple via iTunes Search FR→US + fallback
  **lookup UPC album Deezer**. Odesli = bonus (Tidal/Amazon).
- **Spotify/Qobuz en sortie = liens de recherche** (pas d'API sans clé).
- **Qobuz** : OG servis qu'aux crawlers → endpoint `qobuz.com/opengraph/(track|album)/<id>`.
  CDN Qobuz **403 sur IP datacenter** → sur le web c'est le **navigateur** qui fetch l'OG et
  POST le HTML (`qobuzOgUrl`, `parseQobuzOgHtml`). Single Qobuz : suivre `music:song` (`qobuzSingleTrackUrl`).
- **Deezer** : quota transitoire depuis Render → tout passe par `deezerJson()` (retry) ;
  suivre redirections `link.deezer.com/s/…`, `dzr.page.link`. `get()` retente 3× réseau/timeout.

## Desktop = Tauri (arm64, non signé, Apple Silicon only)
- Auto-update (plugin updater) : clé privée `~/.tauri/musicshare-updater.key` (hors repo, À SAUVEGARDER) ;
  `latest.json` sur GitHub Releases ; install **sur clic**. Notes via `UPDATE_NOTES` → champ `notes`.
- `scripts/make-release.sh` : **re-signe** ad-hoc (`codesign --force --deep -s -`, sinon « endommagé »)
  et **tar `COPYFILE_DISABLE=1 --no-xattrs`** (sinon AppleDouble `._*` → updater échoue). Vérifier `._ : 0`.
- Nom stable `Music-Share-mac.dmg`. Coquille Rust `src-tauri/src/lib.rs` (tray, popover, blur-hide,
  Accessory, `copy_rich`, `open_external`). **Raccourci global : ABANDONNÉ** (macOS ne livre pas les events).

## Web / hébergement
- **Render** (free, cold start ~1 min) redéploie à chaque push `main`. Domaine via CNAME OVH.
- PWA `web/public/manifest.webmanifest` (`share_target` Android only) ; Web Share API ; input 16px (anti-zoom iOS) ;
  carte Mac masquée si `maxTouchPoints>0`.

## Commandes & déploiement
- Web : `npm run web:dev` (+ `web:api`), `web:build`, `web:start`. `npx tsc --noEmit`.
- Desktop : bump version (package.json + src-tauri/tauri.conf.json + Cargo.toml), `npm run tauri:release`,
  `gh release create vX.Y.Z <dmg> <tar.gz> <latest.json>`.
- Déploiement web = push `main` → Render.

## Design System (DLS) — fait, sur compte Figma perso vincent.thouin@gmail.com
- **2 libs Figma** : **DLS Core** (`FRFEzZgOLYRcT6p2ZTZ57M`) = tokens + composants génériques
  (Button, Input, Toggle, Icon button, Badge, Chip, Alert, Icons) ; **Music Share DLS**
  (`j4RF4KaKHj7mbCeAkS7cG8`, abonnée à Core) = app-spécifiques (List item, Card, Settings row,
  Mac download card, Logo). **Écrans** dans le fichier **Music-Share** (`e83oEhWcFuH2Zx08nMywkZ`,
  page « Screens », abonné aux 2 libs).
- **Tokens 3 tiers** (Figma = source de vérité) : Primitives (`number/*` px, `color/*`) → Semantic
  (`surface/text/border` + `radius/size` + `danger`) → Component (`button/control/toggle`). Convention :
  primitives couleurs *hidden*, `number/*` scopés dimensions, sémantique picklable.
- **Package `dls-core`** (repo `github:Vincenthouin/dls-core`, **v0.4.0**) : `tokens/tokens.css` (CSS vars) +
  `tokens/tailwind-preset.cjs` + `tokens.json` ; **composants React portables** (Button, Alert, Input, Toggle,
  IconButton, Loader, Icons — stylés via CSS vars des tokens, **sans Tailwind**, `styles/components.css`). Build **tsup**
  (`prepare` à l'install). **`gallery.html`** = référence visuelle vivante (tous composants × états, liée aux vrais
  `tokens.css`+`components.css` → reflète toujours ce qui ship ; servir en HTTP local pour les états hover/focus).
  Décision DS : **pas d'état « invalid » sur Input** — une erreur = `<Alert tone="danger">` sous le champ.
- **App consomme les tokens ET les composants** (branche **`feat/dls-core-tokens`**, PAS mergée) : dép `dls-core` ;
  `web/src/styles.css` + `tauri-app/src/styles.css` importent `dls-core/tokens.css` + **`dls-core/components.css`** +
  `src/ui/theme.css` (mapping **Tailwind v4 `@theme`** → utilitaires `bg-card/text-fg/text-muted/border-line/rounded-md/text-accent/text-danger`).
  Classes migrées dans `ResolverPanel` + web `App.tsx`. **`ResolverPanel` branché sur les composants** (`<Input>`,
  `<IconButton>` engrenage/copie, `<Button>` Continue/Copy all/Share, `<Alert>` erreur, `<Loader>` chargement, `<Toggle>`/Icons) — vaut pour
  **les 2 coquilles** (UI partagée). Le switch des lignes plateformes reste app-spécifique (« settings row ») mais
  réutilise le **style** `.dls-toggle`.
- **Régénérer les tokens** après changement Figma : relire les variables Figma → régénérer
  `dls-core/tokens/*` → push `dls-core` → `npm update dls-core` dans l'app.
- **Code Connect indisponible** (exige Figma Org/Enterprise + siège Dev ; compte perso = Éducation).
- **Fait** : extraction Input/Toggle/IconButton/Icons/**Loader** dans `dls-core` (patron : composant React portable,
  CSS vars, sans Tailwind, + `styles/components.css`) ; **`ResolverPanel` branché** dessus (web + Tauri) ; galerie ajoutée.
  **Loader** créé aussi dans Figma Core (page « Loader » : anneau + arc, tokens `loader/*` dans la collection Component ;
  arc = secteur d'anneau `arcData`+`innerRadius`, PAS `dashPattern` qui multiplie les segments).
  _(Antérieur : Button `State` Default/Success/Disabled + `Alert` publiés dans Core ; Alert sur l'écran Error.)_
- **À faire** : merger/déployer la branche `feat/dls-core-tokens` quand prêt (déploiement web = push `main`, cf.
  section desktop pour le release Tauri). Extraction restante possible : Badge, Chip (déjà dans Figma Core).
- Écrire dans Figma = MCP `use_figma` (charger la guidance `figma-use`/`figma-generate-library`).

## Gotchas d'environnement (ce Mac)
- **NE JAMAIS `pkill -f "Music Share.app"`** (tue l'app installée) → cibler le build de test par chemin
  `…/src-tauri/target/release/…`.
- **Accès `~/Desktop` (TCC) intermittent** → contournement git depuis `/tmp` avec `GIT_DIR`/`GIT_WORK_TREE`.
- Preview : préférer le **Browser pane** `mcp__Claude_Browser__*`. `web:start` sert un `dist-web/` périmé →
  config launch **`web-dev`** (Vite HMR) pour vérif live.

## Utilisateur
UX (Somfy), francophone, hands-on (édite lui-même Figma/GitHub). Soigner la simplicité de l'UI.
**Répondre en français.**
