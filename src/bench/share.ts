/**
 * A pack as a link.
 *
 * A config is under two kilobytes of JSON and deflates to a few hundred
 * bytes, so the whole thing fits in a URL fragment. No server, nothing
 * stored, and the fragment never reaches Cloudflare's logs — the browser
 * keeps everything after the # to itself. That is the read-only gallery
 * without the gallery: paste a link on a forum and the bench opens with
 * your pack on it.
 *
 * Encoding is deflate-raw, then base64url. The importer that reads it back
 * is the same lenient parser the file import uses, so a link someone edited
 * by hand gets repaired and reported rather than refused.
 */
import type { Config } from '../fxmic/types'

const PREFIX = 'p='

export async function encodePack(config: Config): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(config))
  const packed = await squeeze(json, 'deflate-raw')
  return PREFIX + base64url(packed)
}

/** The JSON text carried by a fragment, or undefined if there is no pack in it. */
export async function decodePack(fragment: string): Promise<string | undefined> {
  const body = fragment.replace(/^#/, '')
  if (!body.startsWith(PREFIX)) return undefined
  try {
    const bytes = unbase64url(body.slice(PREFIX.length))
    const json = await unsqueeze(bytes, 'deflate-raw')
    return new TextDecoder().decode(json)
  } catch {
    return undefined
  }
}

export function shareUrl(fragment: string, base = typeof location !== 'undefined' ? location.href : ''): string {
  const url = new URL(base || 'https://micgnome.stephen8n.com/')
  url.hash = fragment
  return url.toString()
}

async function squeeze(bytes: Uint8Array, format: CompressionFormat): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream(format))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function unsqueeze(bytes: Uint8Array, format: CompressionFormat): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream(format))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function unbase64url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}
