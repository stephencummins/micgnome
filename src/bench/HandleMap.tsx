import { modulationCurve } from '../fxmic/serialize'
import { effectByName } from '../fxmic/spec'
import type { Preset } from '../fxmic/types'
import { paramDisplay } from './state'

/**
 * Depth in config.json is a flat number added to a base value, and every
 * parameter has a hard ceiling. So a cutoff of 0.2 with a depth of 1.4 maxes
 * out at 57% handle and the rest of your travel does nothing. That is invisible
 * in a text editor and obvious in a plot, which is the whole reason this exists.
 */
export function HandleMap({ preset, handle }: { preset: Preset; handle: number }) {
  const mod = preset.handle
  const row = mod?.row !== undefined ? preset.list[mod.row] : undefined
  const spec = row ? effectByName(row.effect) : undefined
  const param = spec && mod?.param ? spec.params.find((p) => p.name === mod.param) : undefined

  if (!mod || !param || !row) {
    return (
      <p className="label border border-rule-soft px-3 py-4 leading-relaxed">
        no handle modulation on this preset. add one to see where it runs out of travel.
      </p>
    )
  }

  const base = paramDisplay(row, param.name)
  const { at, clipsAt } = modulationCurve(base, mod, param.min, param.max)

  /*
   * Plot the travel, not the parameter's whole range. SSB's frequency spans
   * 40,000 hz and a musical shift is 150 of them — against the full axis that
   * line is flat and tells you nothing. Padded a little so the ends are not
   * jammed against the frame, and never wider than the parameter allows.
   */
  const lo = Math.min(at(0), at(1))
  const hi = Math.max(at(0), at(1))
  // Padding comes from the travel, never from the parameter's range — 2% of
  // SSB's 40,000 hz is 800, which would swamp a 150 hz sweep all over again.
  const travel = hi - lo
  const pad = travel > 0 ? travel * 0.25 : Math.max((param.max - param.min) * 0.02, 0.05)
  const top = Math.min(param.max, hi + pad)
  const bottom = Math.max(param.min, lo - pad)
  const span = top - bottom || 1

  const w = 300
  const h = 96
  const x = (position: number) => 34 + position * (w - 44)
  const y = (value: number) => h - 18 - ((value - bottom) / span) * (h - 32)

  const points = Array.from({ length: 41 }, (_, i) => {
    const position = i / 40
    return `${x(position)},${y(at(position))}`
  }).join(' ')

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img"
        aria-label={`${param.name} against handle position, from ${at(0).toFixed(2)} to ${at(1).toFixed(2)}`}>
        <g stroke="currentColor" strokeWidth="1" opacity="0.18">
          <path d={`M34 ${y(top)} L${w - 10} ${y(top)}`} strokeDasharray="2 4" />
          <path d={`M34 ${y(bottom)} L${w - 10} ${y(bottom)}`} />
        </g>
        <g className="data" fill="currentColor" opacity="0.5" fontSize="8">
          <text x="2" y={y(top) + 3}>{tidy(top)}</text>
          <text x="2" y={y(bottom) + 3}>{tidy(bottom)}</text>
        </g>
        {clipsAt !== undefined && (
          <path d={`M${x(clipsAt)} ${y(at(clipsAt))} L${x(1)} ${y(at(1))}`}
            stroke="var(--color-orange)" strokeWidth="6" opacity="0.18" fill="none" />
        )}
        <polyline points={points} fill="none" stroke="var(--color-orange)" strokeWidth="2" />
        <g stroke="currentColor" opacity="0.4" strokeDasharray="3 3">
          <path d={`M${x(handle)} 6 L${x(handle)} ${h - 16}`} />
        </g>
        <circle cx={x(handle)} cy={y(at(handle))} r="3" fill="var(--color-orange)" />
      </svg>
      <figcaption className="label mt-1 leading-relaxed">
        {param.name} · {tidy(at(handle))} at {Math.round(handle * 100)}%
        {(bottom > param.min || top < param.max) && (
          <span className="opacity-60"> · full range {tidy(param.min)} to {tidy(param.max)}</span>
        )}
        {clipsAt !== undefined && (
          <span className="block text-orange">
            hits {mod.depth! > 0 ? param.max : param.min} at {Math.round(clipsAt * 100)}% — the last{' '}
            {Math.round((1 - clipsAt) * 100)}% of handle travel does nothing
          </span>
        )}
      </figcaption>
    </figure>
  )
}

/** 0.56, -150, 1 — not 0.56000000000000005 or -150.00. */
function tidy(value: number): string {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 100) / 100
  return String(rounded)
}
