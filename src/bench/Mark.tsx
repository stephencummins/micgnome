/**
 * The Mic Gnome mark: conical hat, round beard, orange nose on the seam.
 *
 * Drawn rather than placed. The logo's beard is white on white, so the raster
 * becomes a white box in dark mode; as a vector it takes its greys from the
 * theme and stays crisp at 16px, which is where a favicon lives.
 */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <path d="M7.4 19.4 A8.6 8.6 0 0 1 24.6 19.4 A8.6 8.6 0 0 1 18.6 27.6 L16 24.6 L13.4 27.6 A8.6 8.6 0 0 1 7.4 19.4 z"
        fill="var(--color-paper)" stroke="var(--color-mute)" strokeWidth="1" strokeOpacity="0.55"
        strokeLinejoin="round" />
      <path d="M5.4 18.6 L14.5 4.2 Q16 2.7 17.5 4.2 L26.6 18.6 z" fill="var(--color-mute)" />
      <circle cx="16" cy="18.4" r="3.5" fill="var(--color-orange)" />
    </svg>
  )
}
