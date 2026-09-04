# Music Share (repo GitHub : Vincenthouin/Streamylink)

Colle un lien Qobuz/Spotify/Apple Music/Deezer → liens équivalents sur les autres
plateformes. Deux supports **iso-fonctionnels** : **Web** (PWA, streamylink.vincent-thou.in)
et **App macOS** (barre de menus, Tauri). ⚠️ **Toute évolution fonctionnelle = les DEUX
supports.** Logique + UI partagées ; seules les coquilles diffèrent.

## Definition of Done (toute nouvelle version fonctionnelle)
Une évolution fonctionnelle n'est **terminée** que quand les 4 volets sont faits (en plus
de l'iso-fonctionnel Web + Desktop ci-dessus) :
1. **Composants Figma** : créer / mettre à jour les composants (+ variants/états) dans la lib
   concernée — **DLS Core** (`FRFEzZgOLYRcT6p2ZTZ57M`) pour le générique, **Music Share DLS**
   (`j4RF4KaKHj7mbCeAkS7cG8`) pour l'app-spécifique. Un nouvel état = **variant du même
   component set** (ex. `State=Not found`), pas un composant orphelin.
2. **Écrans dédiés Figma** : créer / mettre à jour les écrans qui utilisent ces composants
   dans le fichier **Music-Share** (`e83oEhWcFuH2Zx08nMywkZ`, page « Screens »).
3. **Liaison avec le code** : brancher l'UI (`ResolverPanel` + coquilles) sur ces composants /
   états, et refléter les tokens (`dls-core`).
4. **Page statique de présentation** : ajouter / mettre à jour l'entrée dans
   `dls-core/gallery.html` (référence visuelle vivante, tous composants × états).

## Synchro 1:1 Figma ↔ code (parité Desktop/Mobile) — FAIT (à déployer)
**Objectif** : le code rend exactement les variants Figma selon la plateforme.
**Mécanisme** : `src/ui/usePlatform.ts` = source unique de vérité → `usePlatform()` (`"desktop" | "mobile"`,
détecté via `(pointer: coarse)` + `maxTouchPoints`, réactif) + **contexte** `PlatformProvider` /
`usePlatformContext()` diffusé en tête de `ResolverPanel` (donc les 2 coquilles). Popover Tauri → desktop ;
web iPhone/iPad → mobile ; web bureau → desktop.

**Composants câblés** (vérifié live, hauteur desktop / mobile) :
| Composant | Desktop | Mobile | Où |
|---|---|---|---|
| Input (DLS Core) | 44 · **13px** | **56** · **16px** | `platform` prop (+ hauteur réelle via token) |
| Button (DLS Core) | 44 | **56** | `platform` prop (Continue/Share/Copy all) |
| Icon button / gear (DLS Core) | 44 | **56** | **prop `platform` ajoutée à dls-core** (`.dls-icon-btn--desktop/--mobile`) |
| List item (`src/ui/ListItem.tsx`) | 48 | 64 | app-spécifique, lit le contexte ; logo 24 |
| Card / MediaCard | cover 48 | cover 56 | lit le contexte |
| Settings row | 48 | 56 | lit le contexte ; logo 24 |

**Identiques Desktop/Mobile → rien à câbler** : Toggle (20), Badge (22), Chip (23).
**Exception documentée** : le bouton **copie** de la ligne reste **32px** aux 2 tailles (Figma : 24 desktop /
32 mobile) — 24px est sous la cible tactile min ; on garde 32 pour l'a11y.
**Supprimé** : le hack `font-size:16px !important` de `web/src/styles.css` (le 16px vient du variant DS).

**Reste à faire** : **déployer**. dls-core `main` **poussé** (commit IconButton `platform`) ; l'app consomme
`github:Vincenthouin/dls-core` → un `npm install` propre (CI/Render) récupère la nouvelle version. Déploiement
web = push `main` ; desktop = release Tauri (cf. section desktop). `components.html` = colonnes Desktop/Mobile.
**Règle de gouvernance** : toute nouvelle compo respecte le mapping `Platform` (via `usePlatform`) — jamais de
taille mobile en dur ; le 16px anti-zoom iOS passe par le variant DS `Input platform="mobile"`, pas par du CSS.

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
- **YouTube en ENTRÉE** (`getYouTubeTrackInfo`) : métadonnées via l'**API oEmbed** (`youtube.com/oembed`,
  publique, sans clé) → parseur titre/artiste (split `-`, strip `(Official Video)`/`ft.`, chaînes `- Topic`/VEVO),
  pochette = miniature `i.ytimg.com`. **Pas d'ISRC** → recherche texte. Garde-fou faux positifs : `bestDeezerTrack`
  (score artiste+titre ≥ 2, comme iTunes) → un lien **non musical** ne renvoie pas un morceau au hasard.
  Pièges : **oEmbed renvoie 404** pour certaines vidéos (intégration restreinte / indispo) → « unavailable » ;
  côté **Tauri, ajouter `youtube.com` à l'allowlist HTTP** (`src-tauri/capabilities/default.json`).

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
- **Package `dls-core`** (repo `github:Vincenthouin/dls-core`, **v0.5.0**) : `tokens/tokens.css` (CSS vars) +
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
- **Pipeline de tokens (automatisé, repris du POC `somfy-tokens-poc`)** : source de vérité =
  `dls-core/tokens/design-tokens.json` (W3C) ; `tokens.css`+`tokens.json` **générés** par
  `scripts/build-tokens.mjs` (`npm run tokens:build`, aussi via `prepare`). CI dls-core valide + bloque la dérive.
  Édition Figma → plugin `Token-Plugin-Editor` ouvre une PR (voir `dls-core/TOKENS-SYNC.md` : le plugin
  reste à généraliser pour DLS Core — 3 collections, layer = collection, mode unique). Puis `npm update dls-core`.
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
