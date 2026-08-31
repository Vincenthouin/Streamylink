#!/usr/bin/env bash
# Release desktop en une commande : bump version (3 fichiers) → build/sign/tar
# (tauri:release) → commit → GitHub Release (dmg + tar.gz + latest.json, marquée
# « latest » pour l'auto-update).
#
#   npm run release:desktop -- [version] ["notes de mise à jour"]
#
# - version : optionnelle. Par défaut, incrémente le patch (2.2.20 → 2.2.21).
# - notes   : optionnelles. Affichées dans le bandeau d'update avant install.
#
# Prérequis : clé updater ~/.tauri/musicshare-updater.key, `gh` authentifié.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CUR="$(node -p "require('./package.json').version")"
NEW="${1:-}"
if [ -z "$NEW" ]; then
  IFS='.' read -r MA MI PA <<< "$CUR"
  NEW="$MA.$MI.$((PA + 1))"
fi
NOTES="${2:-Améliorations et corrections.}"

echo "▶ Release desktop $CUR → $NEW"

# refuse une version déjà taguée
if gh release view "v$NEW" >/dev/null 2>&1; then
  echo "✗ La release v$NEW existe déjà." >&2; exit 1
fi

# 1. bump (une seule occurrence de la version courante par fichier)
for f in package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml; do
  perl -0pi -e "s/\Q$CUR\E/$NEW/" "$f"
done
echo "  ✓ version bumpée dans package.json + tauri.conf.json + Cargo.toml"

# 2. build + sign + artefacts
UPDATE_NOTES="$NOTES" npm run tauri:release

# 3. commit du bump (Cargo.lock régénéré par le build)
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -q -m "Release desktop v$NEW"
echo "  ✓ commit du bump"

# 4. GitHub Release
gh release create "v$NEW" \
  release/Music-Share-mac.dmg \
  release/Music-Share-mac.app.tar.gz \
  release/latest.json \
  --title "v$NEW" --notes "$NOTES" --latest

echo "✓ Release v$NEW publiée. Pense à: git push origin main"
