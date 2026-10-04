/**
 * Takeover Fantasy's mark: a half-court line and center circle seen from above, with a dot for the
 * "vision". Same drawing as src/app/icon.svg.
 */
export function LogoMark({ size = 22, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#191919" />
      <path d="M32 6v52" stroke="#faf8f7" strokeWidth="5" strokeLinecap="round" />
      <circle cx="32" cy="32" r="15" fill="#191919" stroke="#faf8f7" strokeWidth="5" />
      <circle cx="32" cy="32" r="5.5" fill="#3fa37a" />
    </svg>
  );
}
