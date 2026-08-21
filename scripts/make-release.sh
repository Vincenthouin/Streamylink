#!/usr/bin/env bash
# Produit tous les artefacts de release macOS à partir de l'app Tauri buildée :
#   - Music-Share-mac.dmg              (téléchargement manuel)
#   - Music-Share-mac.app.tar.gz       (artefact d'auto-update)
#   - Music-Share-mac.app.tar.gz.sig   (signature updater)
#   - latest.json                      (manifeste lu par le plugin updater)
#
# L'app est re-signée ad-hoc AVANT d'être empaquetée (Tauri casse la signature
# du bundle en ajoutant l'icône) pour que l'update installée se lance sur
# Apple Silicon.
#
# Usage : npm run tauri:release   (après `tauri build --bundles app`)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/src-tauri/target/release/bundle/macos/Music Share.app"
OUT="$ROOT/release"
KEY="$HOME/.tauri/musicshare-updater.key"
REPO="Vincenthouin/Streamylink"
VERSION="$(node -p "require('$ROOT/src-tauri/tauri.conf.json').version")"

[ -d "$APP" ] || { echo "✗ App introuvable — lance: npx tauri build --bundles app" >&2; exit 1; }
[ -f "$KEY" ] || { echo "✗ Clé updater introuvable: $KEY" >&2; exit 1; }
mkdir -p "$OUT"

# 1. dmg (re-signe le bundle et vérifie)
bash "$ROOT/scripts/make-dmg.sh"

# 2. archive d'auto-update depuis l'app re-signée
# COPYFILE_DISABLE=1 : empêche le tar de macOS d'ajouter les fichiers
# AppleDouble « ._* » (attributs étendus), sur lesquels l'updater Tauri
# échouait (« failed to unpack ._Music Share.app »).
TAR="$OUT/Music-Share-mac.app.tar.gz"
rm -f "$TAR" "$TAR.sig"
COPYFILE_DISABLE=1 tar --no-xattrs -C "$(dirname "$APP")" -czf "$TAR" "Music Share.app"

# 3. signature updater (minisign)
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
(cd "$ROOT" && npx tauri signer sign -f "$KEY" "$TAR" >/dev/null)
SIG="$(cat "$TAR.sig")"

# 4. manifeste latest.json
cat > "$OUT/latest.json" <<EOF
{
  "version": "$VERSION",
  "notes": "Voir les notes de version sur GitHub.",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "darwin-aarch64": {
      "signature": "$SIG",
      "url": "https://github.com/$REPO/releases/download/v$VERSION/Music-Share-mac.app.tar.gz"
    }
  }
}
EOF

echo "✓ Artefacts de release v$VERSION dans release/ :"
ls -lh "$OUT/Music-Share-mac.dmg" "$TAR" "$OUT/latest.json" | awk '{print "   "$5, $NF}'
