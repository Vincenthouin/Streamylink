#!/usr/bin/env bash
# Empaquette l'app Tauri déjà buildée en un .dmg simple et fiable via hdiutil.
# On n'utilise pas bundle_dmg.sh de Tauri : son étape de mise en page AppleScript
# échoue en environnement non interactif. Ici : app + lien /Applications, compressé.
#
# Usage : npm run tauri:dmg   (après `tauri build --bundles app`)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/src-tauri/target/release/bundle/macos/Music Share.app"
OUT="$ROOT/release/Music-Share-mac.dmg"
STAGE="$(mktemp -d)"

if [ ! -d "$APP" ]; then
  echo "✗ App introuvable : $APP — lance d'abord: npx tauri build --bundles app" >&2
  exit 1
fi

# Re-signature ad-hoc du bundle COMPLET : Tauri signe le binaire puis ajoute
# l'icône .icns, ce qui invalide la signature (→ « app endommagée » sur les
# Mac Apple Silicon, qui exigent une signature valide). On re-signe l'ensemble.
codesign --force --deep --sign - "$APP"
codesign --verify --deep --strict "$APP" || {
  echo "✗ signature invalide après re-signature" >&2
  exit 1
}

cp -R "$APP" "$STAGE/"
ln -s /Applications "$STAGE/Applications"
mkdir -p "$ROOT/release"
rm -f "$OUT"
hdiutil create -volname "Music Share" -srcfolder "$STAGE" -ov -format UDZO "$OUT" >/dev/null
rm -rf "$STAGE"
echo "✓ $OUT ($(du -h "$OUT" | cut -f1))"
