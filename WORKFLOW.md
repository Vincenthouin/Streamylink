# Workflow — Music Share × dls-core

Flux unique, de la source (Figma / code) au déploiement. Web = `streamylink.vincent-thou.in` (Render), desktop = app Tauri (auto-update).

## Les sources de vérité

| Quoi | Où | Généré / consommé |
|---|---|---|
| **Tokens** (couleurs, dimensions, rayons) | Figma DLS Core → `dls-core/tokens/design-tokens.json` | → `tokens.css` + `tokens.json` (via `npm run tokens:build`) |
| **Composants génériques** (Button, Input, Toggle, IconButton, Badge, Chip, Alert, Loader, Icons) | `dls-core/src/*` + `styles/components.css` | publiés par `dls-core`, consommés par l'app |
| **Compositions app** (MediaCard, SettingsRow, PlatformRow, DesktopCard, header) | `src/ui/` de l'app | app-spécifiques (Music Share DLS) |

## Changer un TOKEN (couleur, espacement, rayon)

```
Figma (Variables)
 → npm run tokens:pull      # dans dls-core (REST si Enterprise, sinon MCP — cf. dls-core/TOKENS-SYNC.md)
 → npm run tokens:build     # régénère tokens.css / tokens.json
 → PR sur dls-core → CI (valide + bloque la dérive) → merge main
 → npm update dls-core      # dans l'app → CI app verte → merge → Render redéploie le web
```
**Impact code app : 0.**

## Changer un COMPOSANT générique (look ou variant)

- Look seul (padding, bordure, forme) : éditer `dls-core/styles/components.css`. **Impact app : 0.**
- Nouveau variant/prop : éditer le `.tsx` + CSS dans dls-core ; l'app l'adopte où elle veut. **Impact app : minimal (opt-in).**
- Publier dls-core → `npm update dls-core` → CI → merge.

## Redesign visuel — quand, pour un impact minimal

À faire **une fois la parité atteinte** (c'est le cas) : tout passe par un token/composant, donc un redesign se fait
**dans Figma d'abord**, puis `tokens:pull` (tokens) + `components.css` (looks) dans dls-core → l'app se met à jour via
`npm update`, **sans changement de code**. Seule une refonte de *structure* d'une composition app touche `src/ui/`.
Thème clair : déjà anticipé (tier sémantique + format `{light,dark}`), il suffira de remplir les valeurs `light`.

## Déployer

- **Web** : merge sur `main` (Streamylink) → Render redéploie automatiquement.
- **Desktop** : `npm run release:desktop -- [version] ["notes"]` (bump 3 fichiers + build/sign/tar + GitHub Release
  marquée « latest » pour l'auto-update), puis `git push origin main`.

## CI (anti-dérive)

- **dls-core** (`.github/workflows/tokens.yml`) : valide `design-tokens.json` + **échoue si `tokens.css`/`tokens.json`
  ne correspondent pas** au source (dérive) + build.
- **app** (`.github/workflows/ci.yml`) : `tsc --noEmit` + `web:build` + `tauri:web:build` (tire dls-core à jour → teste aussi le DS).

## Discipline de version (à revisiter après le redesign)

`dls-core` est aujourd'hui une **dép git flottante** (`github:Vincenthouin/dls-core` → suit `main`). Pratique en phase
active (on veut la dernière version), sécurisé par la CI. Options de fiabilisation quand le DS se stabilisera :
- **épingler un SHA/tag** dans `package.json` (déterministe, bump manuel), ou
- **publier `dls-core` sur npm** avec semver + changelog.

## À noter

- **Dark-only** pour l'instant (mode unique). L'API sémantique est prête pour « light » sans breaking change.
- **Code Connect** (Figma↔React en Dev Mode) : indisponible sur le plan perso/Éducation. En attendant : JSDoc
  `Maps to Figma <variant>` sur chaque composant + galerie `dls-core/gallery.html`. À activer sur un plan Org.
