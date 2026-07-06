/**
 * test-chain.ts — teste la chaîne de résolution multi-plateformes en console.
 *
 * Usage : npx tsx test-chain.ts <url>
 *   ex : npx tsx test-chain.ts https://open.qobuz.com/track/4847493
 *
 * Entrées acceptées : Qobuz, Spotify, Apple Music, Deezer.
 * Utilise le même resolver que l'app (src/main/resolver.ts).
 */
import { resolveLink, ResolveError } from "./src/main/resolver";

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage : npx tsx test-chain.ts <url>");
    process.exit(1);
  }

  const result = await resolveLink(url);

  console.log(`\n═══ Résultat ═══`);
  console.log(`Titre    : ${result.title}`);
  console.log(`Artiste  : ${result.artist}`);
  console.log(`Source   : ${result.sourcePlatform}`);
  console.log(`Pochette : ${result.image ?? "(aucune)"}`);
  console.log();

  for (const link of result.links) {
    const note = link.kind === "search" ? "  (lien de recherche)" : "";
    console.log(`  ${link.name.padEnd(12)} : ${link.url}${note}`);
  }
  if (result.bonus.length) {
    console.log(`\n  Bonus Odesli :`);
    for (const link of result.bonus) {
      console.log(`  ${link.name.padEnd(12)} : ${link.url}`);
    }
  }
}

main().catch((e) => {
  console.error(`\n✗ ${e instanceof ResolveError ? e.message : (e?.message ?? e)}`);
  process.exit(1);
});
