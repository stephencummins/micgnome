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
  const w = 300
  const h = 96
  const x = (position: number) => 34 + position * (w - 44)
  const y = (value: number) => h - 18 - ((value - param.min) / (param.max - param.min)) * (h - 32)

  const points = Array.from({ length: 41 }, (_, i) => {
    const position = i / 40
    return `${x(position)},${y(at(position))}`
  }).join(' ')

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img"
        aria-label={`${param.name} against handle position, from ${at(0).toFixed(2)} to ${at(1).toFixed(2)}`}>
        <g stroke="currentColor" strokeWidth="1" opacity="0.18">
          <path d={`M34 ${y(param.max)} L${w - 10} ${y(param.max)}`} strokeDasharray="2 4" />
          <path d={`M34 ${y(param.min)} L${w - 10} ${y(param.min)}`} />
        </g>
        <g className="data" fill="currentColor" opacity="0.5" fontSize="8">
          <text x="2" y={y(param.max) + 3}>{param.max}</text>
          <text x="2" y={y(param.min) + 3}>{param.min}</text>
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
        {param.name} · {at(handle).toFixed(2)} at {Math.round(handle * 100)}%
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
