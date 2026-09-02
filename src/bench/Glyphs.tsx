/**
 * The glyph set: one small drawing per effect block, LFO shape and modulation
 * source, so a chain can be read by shape before it is read by name.
 *
 * Drawn, not placed, for the same reasons as the mark — they take their colour
 * from the text around them, so they survive dark mode and stay crisp at 14px.
 * The style follows the guide's own line drawings: one-pixel strokes, no fills,
 * nothing decorative. Each effect block carries the colour of its family —
 * filters blue, time and space teal, pitch violet, drive magenta — and orange
 * is reserved for the modulation sources, because those are the things that
 * move. SAMPLE stays in ink: it is the sound, not something done to it.
 */
import type { LfoShape } from '../fxmic/spec'
import type { ModKind } from './state'

const BOX = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function Svg({ size, title, children, className }: { size: number; title?: string; children: React.ReactNode; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={`inline-block shrink-0 align-[-0.2em] ${className ?? ''}`}
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined} focusable="false" {...BOX}>
      {title && <title>{title}</title>}
      {children}
    </svg>
  )
}

/* ---------- effect blocks ---------- */

const EFFECT_PATHS: Record<string, React.ReactNode> = {
  // three repeats, each quieter than the last
  DELAY: (
    <>
      <path d="M4 20V4" />
      <path d="M11 20v-9" opacity="0.7" />
      <path d="M18 20v-4" opacity="0.4" />
    </>
  ),
  // a wave that has been pushed too hard
  DIST: <path d="M2 12l2.5-7 2 13 2.5-14 2 15 2.5-13 2 11 2.5-9 2 8 2-4" />,
  // one peaking band on a flat line
  EQUALISER: <path d="M2 16h5c2 0 2.5-9 5-9s3 9 5 9h5" />,
  // the voice and its shifted twin
  HARMONY: (
    <>
      <path d="M2 9c2-5 4-5 6 0s4 5 6 0 4-5 6 0" />
      <path d="M4 16c2-5 4-5 6 0s4 5 6 0 4-5 6 0" opacity="0.45" />
    </>
  ),
  // lets the lows through, rolls the top off
  LOWPASS: <path d="M2 8h9c4 0 5 10 11 10" />,
  // the mirror of it
  HIGHPASS: <path d="M2 18c6 0 7-10 11-10h9" />,
  // the sound itself, as the sample bay draws it
  SAMPLE: (
    <>
      <path d="M3 10v4" />
      <path d="M6 7v10" />
      <path d="M9 4v16" />
      <path d="M12 8v8" />
      <path d="M15 5v14" />
      <path d="M18 9v6" />
      <path d="M21 11v2" />
    </>
  ),
  // a room, and the tail dying away inside it
  REVERB: (
    <>
      <path d="M3 4h18v16H3z" />
      <path d="M6 8c1 7 6 9 12 9" opacity="0.6" />
    </>
  ),
  // two signals multiplied together
  RING: (
    <>
      <circle cx="9" cy="12" r="6" />
      <circle cx="15" cy="12" r="6" />
    </>
  ),
  // the carrier, and one sideband beside it
  SSB: (
    <>
      <path d="M6 3v18" strokeDasharray="2 2.5" />
      <path d="M9 20c3-14 9-14 12 0" />
    </>
  ),
}

const FAMILY: Record<string, string> = {
  LOWPASS: 'text-filter',
  HIGHPASS: 'text-filter',
  EQUALISER: 'text-filter',
  DELAY: 'text-space',
  REVERB: 'text-space',
  HARMONY: 'text-pitch',
  SSB: 'text-pitch',
  DIST: 'text-drive',
  RING: 'text-drive',
}

/** The family colour for a block, or nothing for SAMPLE and unknowns. Exported so a row can borrow it. */
export const familyClass = (name: string): string => FAMILY[name] ?? ''

export function EffectGlyph({ name, size = 16, className }: { name: string; size?: number; className?: string }) {
  const path = EFFECT_PATHS[name]
  className = `${FAMILY[name] ?? ''} ${className ?? ''}`
  if (!path) {
    // an effect this mic does not have — a box with a question, so the
    // chain still lines up and the problem is visible
    return (
      <Svg size={size} className={className}>
        <path d="M3 3h18v18H3z" strokeDasharray="2 2" />
        <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17v.5" />
      </Svg>
    )
  }
  return <Svg size={size} className={className}>{path}</Svg>
}

/* ---------- LFO shapes ---------- */

const LFO_PATHS: Record<LfoShape, React.ReactNode> = {
  sine: <path d="M2 12c2.5-8 5-8 7.5 0s5 8 7.5 0 3.5-6 5 0" />,
  square: <path d="M2 18V6h6v12h6V6h6v12h2" />,
  sawtooth: <path d="M2 18L9 6v12L16 6v12L22 8" />,
  random: <path d="M2 14h3V8h3v9h3v-5h3v8h3V6h3v7h2" />,
}

export function LfoGlyph({ shape, size = 16, className }: { shape: LfoShape; size?: number; className?: string }) {
  return <Svg size={size} className={className}>{LFO_PATHS[shape]}</Svg>
}

/* ---------- modulation sources ---------- */

const SOURCE_PATHS: Record<ModKind, React.ReactNode> = {
  // the handle, and the squeeze going into it
  handle: (
    <>
      <rect x="9" y="3" width="6" height="18" rx="3" />
      <path d="M2 9l3 3-3 3M22 9l-3 3 3 3" />
    </>
  ),
  // the same handle, shaken
  shake: (
    <>
      <rect x="9" y="3" width="6" height="18" rx="3" transform="rotate(-12 12 12)" />
      <path d="M4 6c-1.5 4-1.5 8 0 12M20 6c1.5 4 1.5 8 0 12" opacity="0.6" />
    </>
  ),
  // a wave going round on its own
  lfo: (
    <>
      <circle cx="12" cy="12" r="9" opacity="0.4" />
      <path d="M5 12c1.7-5 3.3-5 5 0s3.3 5 5 0 2.5-4 4 0" />
    </>
  ),
}

export function SourceGlyph({ kind, size = 16, className }: { kind: ModKind; size?: number; className?: string }) {
  return <Svg size={size} className={className}>{SOURCE_PATHS[kind]}</Svg>
}

/* ---------- the rest of the furniture ---------- */

const MISC_PATHS = {
  // three blocks, one falling into the next
  chain: (
    <>
      <path d="M5 3h14v5H5zM5 16h14v5H5z" />
      <path d="M12 8v8M9.5 13.5L12 16l2.5-2.5" />
    </>
  ),
  // the verdict
  tick: <path d="M4 12.5l5 5L20 6.5" />,
  // eject: the arrow up, the line it leaves behind
  eject: (
    <>
      <path d="M12 4l8 10H4z" />
      <path d="M4 19h16" />
    </>
  ),
  // the file the mic actually reads
  file: (
    <>
      <path d="M6 2h8l5 5v15H6z" />
      <path d="M14 2v5h5" />
      <path d="M9 12h6M9 16h6" opacity="0.6" />
    </>
  ),
} as const

export function Glyph({ name, size = 16, className }: { name: keyof typeof MISC_PATHS; size?: number; className?: string }) {
  return <Svg size={size} className={className}>{MISC_PATHS[name]}</Svg>
}
