/**
 * The Mic Gnome mark: the fx-mic drawn as a gnome — grey hat, orange nose.
 *
 * Cropped to the head, matching the favicon. The full device is a 0.6 aspect
 * and its feet and beard outline fall below a pixel at header size, so the
 * whole thing reads as a grey sliver; the hat and nose are what carry the
 * identity small. Vector rather than the raster logo, so the beard takes its
 * greys from the theme instead of carrying a white box into dark mode.
 */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.86} viewBox="0 0 24 21" aria-hidden focusable="false">
      <path d="M1 16.6 h22 v4" fill="none" stroke="var(--color-mute)" strokeWidth="1.4" />
      <path d="M0.6 16.8 L10 0.8 h12.8 v16 z" fill="var(--color-mute)" />
      <circle cx="11.6" cy="16.6" r="4.1" fill="var(--color-orange)" />
    </svg>
  )
}
