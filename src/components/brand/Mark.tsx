/** The mark: a star, an orbit, one planet. Inline SVG so it scales anywhere. */
export function Mark({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <circle cx="32" cy="32" r="14" fill="none" stroke="currentColor" strokeOpacity="0.45" strokeWidth="2" />
      <circle cx="32" cy="32" r="4.5" fill="currentColor" />
      <circle cx="46" cy="32" r="3" fill="#8EDBFF" />
      <circle cx="23" cy="12.5" r="2.2" fill="#D6B35A" />
    </svg>
  );
}
