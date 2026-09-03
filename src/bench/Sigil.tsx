/**
 * A pack's sigil: a small drawing of what the pack actually does, rather than
 * a decorative icon. PUNCH IN is the punch. FOUR SHAPES is the four shapes.
 * KO LO-FI is a sine crushed onto a staircase. SHORTWAVE is a carrier drifting
 * off its tuning line.
 *
 * Drawn rather than placed, so it takes its greys from the theme and stays
 * crisp — a raster would be a white tile on a dark ground.
 */
const W = 108
const H = 52
const MID = H / 2

interface Drawing {
  /** Faint structural lines: cell dividers, quantisation grid, the tuning mark. */
  guides: { d: string; accent?: boolean }[]
  /** The waveform itself. `faint` is the second voice in a doubled pair. */
  lines: { points: string; width: number; faint?: boolean }[]
}

const points = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')

const DRAWINGS: Record<string, () => Drawing> = {
  // Flat, a hard jump to full, flat again — nothing at rest, everything at squeeze.
  'punch-in': () => ({
    guides: [
      { d: `M36 ${MID - 16} V${MID + 16}`, accent: true },
      { d: `M74 ${MID - 16} V${MID + 16}`, accent: true },
    ],
    lines: [
      {
        points: points([
          [6, MID + 16], [34, MID + 16], [36, MID - 16],
          [72, MID - 16], [74, MID + 16], [102, MID + 16],
        ]),
        width: 2,
      },
    ],
  }),

  // The four lfo shapes, in the order the pack lists them.
  'four-shapes': () => {
    const guides: Drawing['guides'] = []
    const lines: Drawing['lines'] = []
    const cell = 20
    const pitch = 24.5

    for (let i = 0; i < 4; i++) {
      const x0 = 6 + i * pitch
      if (i) guides.push({ d: `M${x0 - 2.5} 8 V${H - 8}` })

      let pts: [number, number][] = []
      if (i === 0) {
        pts = Array.from({ length: 25 }, (_, t) => [
          x0 + (t * cell) / 24,
          MID - 13 * Math.sin(((t / 24) * 2 * Math.PI)),
        ])
      } else if (i === 1) {
        pts = [
          [x0, MID + 13], [x0, MID - 13], [x0 + cell / 2, MID - 13],
          [x0 + cell / 2, MID + 13], [x0 + cell, MID + 13], [x0 + cell, MID - 13],
        ]
      } else if (i === 2) {
        pts = [
          [x0, MID + 13], [x0 + cell / 2, MID - 13], [x0 + cell / 2, MID + 13],
          [x0 + cell, MID - 13], [x0 + cell, MID + 13],
        ]
      } else {
        const heights = [7, -11, 3, -5, 12, -2]
        pts = heights.flatMap((h, j): [number, number][] => [
          [x0 + (j * cell) / heights.length, MID + h],
          [x0 + ((j + 1) * cell) / heights.length, MID + h],
        ])
      }
      lines.push({ points: points(pts), width: 1.6 })
    }
    return { guides, lines }
  },

  // A sine quantised onto a coarse staircase: the sampler's own grain.
  'ko-lo-fi': () => {
    const n = 14
    const step = (W - 12) / n
    const pts: [number, number][] = []
    for (let i = 0; i < n; i++) {
      const q = Math.round(Math.sin(((i + 0.5) / n) * 2 * Math.PI) * 3) / 3
      pts.push([6 + i * step, MID - q * 14], [6 + (i + 1) * step, MID - q * 14])
    }
    return {
      guides: Array.from({ length: n - 1 }, (_, i) => ({ d: `M${(6 + (i + 1) * step).toFixed(1)} 8 V${H - 8}` })),
      lines: [{ points: points(pts), width: 2 }],
    }
  },

  // Two voices, drifting in and out of each other: the doubling a chorus makes.
  'tape-head': () => {
    // Slightly different rates, so the two voices converge and diverge across
    // the width — a chorus is two copies beating against each other, and drawing
    // them in step just looks like one line with a shadow.
    const trace = (rate: number, amp: number, phase = 0): [number, number][] =>
      Array.from({ length: 97 }, (_, t) => [
        6 + (t * (W - 12)) / 96,
        MID - amp * Math.sin(t / rate + phase),
      ])
    return {
      guides: [],
      lines: [
        { points: points(trace(6.2, 9, 1.9)), width: 1.4, faint: true },
        { points: points(trace(7.9, 12)), width: 1.8 },
      ],
    }
  },

  // A response curve with a deep notch, and a ghost of where the notch sweeps
  // to — the part of a phaser you actually hear.
  'xy-rack': () => {
    const notch = (centre: number, depth: number): [number, number][] =>
      Array.from({ length: 97 }, (_, t) => {
        const x = 6 + (t * (W - 12)) / 96
        const d = (x - centre) / 11
        return [x, MID - 11 + depth * Math.exp(-d * d)]
      })
    return {
      guides: [],
      lines: [
        { points: points(notch(74, 26)), width: 1.4, faint: true },
        { points: points(notch(40, 30)), width: 1.8 },
      ],
    }
  },

  // A voice, and the censor beep covering a word of it: the voice stops, a
  // dense tone takes its place, the voice carries on. The one sigil that is
  // about the sample rather than the fx.
  'house-mic': () => {
    const voice = (from: number, to: number): [number, number][] =>
      Array.from({ length: 41 }, (_, t) => {
        const x = from + (t * (to - from)) / 40
        return [x, MID - 5 * Math.sin(x / 2.1) * Math.sin(x / 7.3) - 2 * Math.sin(x / 1.3)]
      })
    // Twelve points across the gap, not a hundred: drawn any denser the tone
    // fills into a solid block and stops reading as a waveform.
    const beep: [number, number][] = Array.from({ length: 13 }, (_, t) => {
      const x = 58 + (t * 24) / 12
      return [x, MID - 13 * (t % 2 ? 1 : -1)]
    })
    return {
      guides: [
        { d: `M58 ${MID - 16} V${MID + 16}`, accent: true },
        { d: `M82 ${MID - 16} V${MID + 16}`, accent: true },
      ],
      lines: [
        { points: points(voice(6, 56)), width: 1.6 },
        { points: points(beep), width: 1.4 },
        { points: points(voice(84, 102)), width: 1.6 },
      ],
    }
  },

  // A carrier wandering either side of the station it is hunting.
  shortwave: () => ({
    guides: [{ d: `M${W / 2} 7 V${H - 7}`, accent: true }],
    lines: [
      {
        points: points(
          Array.from({ length: 97 }, (_, t) => [
            6 + (t * (W - 12)) / 96,
            MID - (11 * Math.sin(t / 4.4) * 0.5 + 5.5 * Math.sin((t / 96) * 1.6 * Math.PI)),
          ]),
        ),
        width: 1.6,
      },
    ],
  }),
}

export const SIGIL_IDS = Object.keys(DRAWINGS)
export const hasSigil = (id: string) => id in DRAWINGS

export function Sigil({ pack }: { pack: string }) {
  const draw = DRAWINGS[pack]
  if (!draw) return null
  const { guides, lines } = draw()

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden focusable="false" className="block shrink-0">
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} fill="var(--color-paper)" stroke="var(--color-rule-soft)" />
      <path d={`M6 ${MID} H${W - 6}`} stroke="var(--color-rule)" strokeWidth="1" strokeDasharray="2 3" />
      {guides.map((g, i) => (
        <path key={i} d={g.d} strokeWidth="1"
          stroke={g.accent ? 'var(--color-orange)' : 'var(--color-rule)'}
          strokeDasharray={g.accent && pack === 'shortwave' ? '2 3' : undefined}
          opacity={g.accent ? 0.4 : 1} />
      ))}
      {lines.map((l, i) => (
        <polyline key={i} points={l.points} fill="none" stroke="var(--color-orange)"
          strokeWidth={l.width} strokeLinejoin="round" opacity={l.faint ? 0.42 : 1} />
      ))}
    </svg>
  )
}
