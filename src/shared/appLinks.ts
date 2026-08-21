/**
 * Conversion d'une URL web de plateforme en URL de schéma qui ouvre l'app de
 * bureau (Spotify, Apple Music, Deezer). Utilisé quand l'utilisateur active
 * le mode « app » pour une plateforme donnée. Renvoie null si la plateforme
 * n'a pas de schéma exploitable pour cette URL.
 */

/** Plateformes pour lesquelles le mode « ouvrir dans l'app » est proposé. */
export const APP_SCHEME_PLATFORMS = ["spotify", "appleMusic", "deezer"] as const;

export function appSchemeUrl(platform: string, webUrl: string): string | null {
  try {
    const u = new URL(webUrl);
    switch (platform) {
      case "spotify": {
        const track = u.pathname.match(/\/track\/([A-Za-z0-9]+)/);
        if (track) return `spotify:track:${track[1]}`;
        // lien de recherche : spotify:search:<query> (déjà encodé dans le path)
        const search = u.pathname.match(/\/search\/(.+)$/);
        if (search) return `spotify:search:${search[1]}`;
        return null;
      }
      case "appleMusic":
        // https://music.apple.com/… → music://music.apple.com/… (app Musique macOS)
        return webUrl.replace(/^https?:\/\//i, "music://");
      case "deezer": {
        const track = u.pathname.match(/\/track\/(\d+)/);
        if (track) return `deezer://www.deezer.com/track/${track[1]}`;
        return null;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}
