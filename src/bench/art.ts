import type { Config } from '../fxmic/types'

/**
 * The pack's bit-art, tiled faintly down the page margins the way TDMDNE tiles
 * its beat. A one-dimensional cellular automaton: the first row is the pack's
 * chains laid side by side, four columns to a preset, and each row after grows
 * from the one above by an elementary rule the pack's shape picks. Each column
 * keeps the family colour of the block that seeded it.
 *
 * Only the chain's structure feeds it, never a parameter, so dragging a slider
 * leaves the wallpaper alone and adding a block changes it.
 */

/** The chaotic and complex rules, as in TDMDNE: the rest settle into stripes or fill in. */
export const ART_RULES = [30, 45, 73, 86, 89, 105, 110, 124, 135, 137, 149, 150, 193]

export type ArtTone = 'filter' | 'space' | 'pitch' | 'drive' | 'ink'

const TONE: Record<string, ArtTone> = {
  BALANCE: 'space',
  LOWPASS: 'filter',
  HIGHPASS: 'filter',
  EQUALIZER: 'filter',
  DELAY: 'space',
  REVERB: 'space',
  HARMONY: 'pitch',
  SSB: 'pitch',
  DIST: 'drive',
  RING: 'drive',
}

export interface Art {
  /** 16 rows of 16 cells, 1 = drawn. */
  cells: number[][]
  /** Each column's colour, from the block that seeded it; null where no block sits. */
  own: (ArtTone | null)[]
  /** The one cell drawn in orange. */
  spark: [number, number] | null
  rule: number
}

/** FNV-1a, enough to turn the chain's shape into a seed. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return h >>> 0
}

function mulberry32(a: number) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Up to four blocks per preset, spread across the chain so a long one keeps its first and last. */
function columns(list: string[]): string[] {
  if (list.length <= 4) return list
  return [0, 1, 2, 3].map((c) => list[Math.round((c * (list.length - 1)) / 3)])
}

export function packArt(config: Config): Art {
  const chains = (config.presets ?? []).slice(0, 4).map((p) => p.list.map((r) => r.effect))
  const R = mulberry32(hash(JSON.stringify(chains)))
  const rule = ART_RULES[Math.floor(R() * ART_RULES.length)]

  const own: (ArtTone | null)[] = Array(16).fill(null)
  chains.forEach((chain, p) => columns(chain).forEach((name, c) => (own[p * 4 + c] = TONE[name] ?? 'ink')))

  let row: number[] = own.map((t) => (t ? 1 : 0))
  if (!row.some(Boolean)) row[Math.floor(R() * 16)] = 1
  const cells: number[][] = []
  for (let y = 0; y < 16; y++) {
    cells.push(row)
    const prev = row
    row = prev.map((_, x) => (rule >> ((prev[(x + 15) % 16] << 2) | (prev[x] << 1) | prev[(x + 1) % 16])) & 1)
  }
  const hot = cells.flatMap((r, y) => r.flatMap((c, x) => (c ? [[x, y] as [number, number]] : [])))
  return { cells, own, spark: hot.length ? hot[Math.floor(R() * hot.length)] : null, rule }
}

/**
 * Paint the art onto a canvas and hand back a PNG data URL, colours read off
 * the live theme. Undefined where there is no canvas (tests, very old browsers).
 */
export function artUrl(art: Art, cell = 28): string | undefined {
  if (typeof document === 'undefined') return undefined
  const cvs = document.createElement('canvas')
  const ctx = cvs.getContext?.('2d')
  if (!ctx) return undefined
  const css = getComputedStyle(document.documentElement)
  const colour = (name: string) => css.getPropertyValue(`--color-${name}`).trim() || '#888'
  const size = 16 * cell
  cvs.width = cvs.height = size
  art.cells.forEach((r, y) =>
    r.forEach((c, x) => {
      if (!c) return
      const spark = art.spark && art.spark[0] === x && art.spark[1] === y
      ctx.fillStyle = colour(spark ? 'orange' : (art.own[x] ?? 'ink'))
      ctx.fillRect(x * cell, y * cell, cell, cell)
    }),
  )
  return cvs.toDataURL('image/png')
}
