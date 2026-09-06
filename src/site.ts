/**
 * The handful of outward-facing links. Here rather than inline so the bench,
 * the manual and the booklet cannot drift onto different tip jars — which they
 * did: the bench pointed at GitHub Sponsors long after the decision was Ko-fi.
 */
export const KOFI = 'https://ko-fi.com/stejcu'
export const SITE = 'micgnome.stephen8n.com'

/**
 * Turnstile site key for the gnome tab. Public by design — it ends up in the
 * built JavaScript and in the page's markup, and is useless without the secret,
 * which lives only as a Pages binding. Kept here rather than in a build-time
 * environment variable so that a build which forgets to set one cannot silently
 * ship a page with no widget, which would make every request to /api/gnome fail
 * verification.
 *
 * Widget "micgnome", domain stephen8n.com — which covers every subdomain, plus
 * localhost and 127.0.0.1 for development.
 */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAEqSvV8oMFkoQD-r'
