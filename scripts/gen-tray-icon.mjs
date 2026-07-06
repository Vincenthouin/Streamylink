/**
 * Génère les icônes de tray (template macOS : noir + alpha) sans dépendance,
 * en rasterisant une double croche (♫) et en encodant le PNG à la main.
 *
 * Usage : node scripts/gen-tray-icon.mjs
 * Sorties : resources/trayTemplate.png (16×16), resources/trayTemplate@2x.png (32×32)
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

// ─── Géométrie sur une grille 128×128 ────────────────────────────────
// double croche : deux têtes, deux hampes, une barre inclinée

function inEllipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy <= 1;
}

function inRect(x, y, x0, y0, x1, y1) {
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

/** quadrilatère convexe (points en ordre horaire) */
function inQuad(x, y, pts) {
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = pts[i];
    const [bx, by] = pts[(i + 1) % 4];
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false;
  }
  return true;
}

function inNote(x, y) {
  return (
    inEllipse(x, y, 38, 101, 19, 14) || // tête gauche
    inEllipse(x, y, 94, 93, 19, 14) || // tête droite (plus haute)
    inRect(x, y, 47, 32, 57, 101) || // hampe gauche
    inRect(x, y, 103, 24, 113, 93) || // hampe droite
    inQuad(x, y, [[47, 24], [113, 14], [113, 34], [47, 44]]) // barre inclinée
  );
}

// ─── Rasterisation avec sur-échantillonnage ──────────────────────────

function raster(size) {
  const ss = 128 / size; // sous-pixels par pixel
  const px = new Uint8Array(size * size); // alpha 0-255
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let hits = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          if (inNote(pxi * ss + sx + 0.5, py * ss + sy + 0.5)) hits++;
        }
      }
      px[py * size + pxi] = Math.round((hits / (ss * ss)) * 255);
    }
  }
  return px;
}

// ─── Encodage PNG minimal (RGBA 8 bits, filtre 0) ────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(alpha, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // profondeur
  ihdr[9] = 6; // type couleur RGBA
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4);
    raw[row] = 0; // filtre none
    for (let x = 0; x < size; x++) {
      const o = row + 1 + x * 4;
      raw[o] = 0; // R (noir : macOS ne garde que l'alpha des templates)
      raw[o + 1] = 0;
      raw[o + 2] = 0;
      raw[o + 3] = alpha[y * size + x];
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── Génération + auto-vérification ──────────────────────────────────

mkdirSync(path.join(ROOT, "resources"), { recursive: true });
for (const [size, name] of [
  [16, "trayTemplate.png"],
  [32, "trayTemplate@2x.png"],
]) {
  const alpha = raster(size);
  const opaque = alpha.filter((a) => a > 200).length / alpha.length;
  const corners = [0, size - 1, size * (size - 1), size * size - 1].map((i) => alpha[i]);
  if (corners.some((a) => a !== 0)) throw new Error(`${name} : coins non transparents`);
  if (opaque < 0.1 || opaque > 0.6) throw new Error(`${name} : couverture suspecte (${opaque})`);
  writeFileSync(path.join(ROOT, "resources", name), encodePng(alpha, size));
  console.log(`${name} : ok (${Math.round(opaque * 100)}% opaque, coins transparents)`);
}
