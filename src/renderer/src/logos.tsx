interface LogoProps {
  className?: string;
}

export function SpotifyLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.5 17.3a.75.75 0 0 1-1.03.25c-2.82-1.72-6.36-2.11-10.54-1.16a.75.75 0 1 1-.33-1.46c4.57-1.05 8.5-.6 11.65 1.33.35.22.47.68.25 1.04zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.23-1.98-8.14-2.56-11.96-1.4a.94.94 0 1 1-.54-1.8c4.36-1.32 9.78-.68 13.48 1.6.44.27.58.85.31 1.29zm.13-3.4C15.24 8.33 8.84 8.12 5.15 9.24a1.13 1.13 0 1 1-.65-2.15c4.24-1.29 11.28-1.04 15.72 1.6a1.13 1.13 0 0 1-1.16 1.94z" />
    </svg>
  );
}

export function AppleMusicLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.1 1.2c.06.63-.18 1.26-.6 1.74-.43.5-1.1.87-1.75.82-.07-.6.2-1.24.6-1.65.44-.48 1.18-.85 1.75-.91zm2.62 15.32c-.48 1.1-.71 1.6-1.33 2.57-.86 1.36-2.08 3.06-3.6 3.07-1.34.02-1.69-.88-3.51-.87-1.82.01-2.2.9-3.55.88-1.51-.01-2.66-1.54-3.53-2.9-2.43-3.8-2.68-8.26-1.18-10.63 1.06-1.69 2.74-2.68 4.32-2.68 1.6 0 2.61.9 3.94.9 1.29 0 2.07-.9 3.93-.9 1.4 0 2.89.78 3.95 2.13-3.47 1.95-2.91 7.01.56 8.43z" transform="translate(1.5 0) scale(0.92)" />
      <path d="M9 17.5v-8l7-1.8v7.05a2.35 2.35 0 1 1-1.2-2.05V10.2l-4.6 1.2v6.85A2.35 2.35 0 1 1 9 16.2z" fill="none" />
    </svg>
  );
}

export function DeezerLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.8 4.98h4.68v2.6H18.8zM18.8 8.9h4.68v2.6H18.8zM18.8 12.8h4.68v2.6H18.8zM18.8 16.72h4.68v2.6H18.8zM12.53 8.9h4.68v2.6h-4.68zM12.53 12.8h4.68v2.6h-4.68zM12.53 16.72h4.68v2.6h-4.68zM6.27 12.8h4.68v2.6H6.27zM6.27 16.72h4.68v2.6H6.27zM0 16.72h4.68v2.6H0z" />
    </svg>
  );
}

export function QobuzLogo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20zm0 3.2a6.8 6.8 0 1 0 0 13.6A6.8 6.8 0 0 0 12 5.2zm0 2.4a4.4 4.4 0 1 1 0 8.8 4.4 4.4 0 0 1 0-8.8zm7.4 11.2 2.4 2.4-1.8 1.8-2.4-2.4z" />
    </svg>
  );
}

export function LinkIcon({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function CopyIcon({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function CheckIcon({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function PLATFORM_LOGO(platform: string, className: string) {
  switch (platform) {
    case "spotify":
      return <SpotifyLogo className={className} />;
    case "appleMusic":
      return <AppleMusicLogo className={className} />;
    case "deezer":
      return <DeezerLogo className={className} />;
    case "qobuz":
      return <QobuzLogo className={className} />;
    default:
      return <LinkIcon className={className} />;
  }
}

export const PLATFORM_COLOR: Record<string, string> = {
  spotify: "#1DB954",
  appleMusic: "#FA2D48",
  deezer: "#A238FF",
  qobuz: "#4A90D9",
};
