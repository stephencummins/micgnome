/**
 * The ellipsis on anything still working. A plain … in light and dark; the
 * fancy theme makes the three dots hop. Screen readers get the words, not dots.
 */
export function Hop() {
  return <span className="hop" aria-hidden><i /><i /><i /></span>
}
