import { LFO_SHAPES, effectByName } from '../fxmic/spec'
import type { Preset } from '../fxmic/types'
import type { Action, ModKind } from './state'
import { LfoGlyph, SourceGlyph } from './Glyphs'

const KINDS: { kind: ModKind; blurb: string }[] = [
  { kind: 'handle', blurb: 'squeeze the handle, 0 to 100%' },
  { kind: 'shake', blurb: 'shake the mic' },
  { kind: 'lfo', blurb: 'cycles on its own' },
]

export function Modulation({ preset, dispatch }: { preset: Preset; dispatch: (a: Action) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="label">modulation · each source moves one parameter on one row</div>

      {KINDS.map(({ kind, blurb }) => (
        <Block key={kind} kind={kind} blurb={blurb} preset={preset} dispatch={dispatch} />
      ))}

      <Trigger preset={preset} dispatch={dispatch} />
    </div>
  )
}

function Block({
  kind,
  blurb,
  preset,
  dispatch,
}: {
  kind: ModKind
  blurb: string
  preset: Preset
  dispatch: (a: Action) => void
}) {
  const mod = preset[kind]
  const targetsLfo = mod?.target === 'lfo'
  const row = mod?.row !== undefined ? preset.list[mod.row] : undefined
  const params = row ? (effectByName(row.effect)?.params ?? []) : []

  if (!mod) {
    return (
      <div className="flex items-center justify-between border border-rule-soft px-2 py-1.5">
        <span className="label flex items-center gap-2">
          <SourceGlyph kind={kind} size={17} className="text-orange" />
          <span>{kind} — {blurb}</span>
        </span>
        <button type="button" className="data border border-rule px-2 hover:border-orange hover:text-orange"
          onClick={() => dispatch({ type: 'set-mod', kind, patch: { row: 0, param: params[0]?.name, depth: 0.5 } })}>
          add
        </button>
      </div>
    )
  }

  return (
    <div className="border border-orange bg-orange-soft/40 p-2">
      <div className="flex items-baseline justify-between">
        <span className="data flex items-center gap-2 font-medium text-orange">
          <SourceGlyph kind={kind} size={18} />
          {kind}
        </span>
        <button type="button" className="label underline hover:text-orange"
          onClick={() => dispatch({ type: 'set-mod', kind, patch: undefined })}>
          remove
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {kind === 'handle' && (
          <label className="label flex items-center gap-1">
            <input type="checkbox" checked={targetsLfo}
              onChange={(e) =>
                dispatch({
                  type: 'set-mod',
                  kind,
                  patch: e.target.checked
                    ? { target: 'lfo', row: undefined, param: 'speed' }
                    : { target: undefined, row: 0, param: params[0]?.name },
                })
              } />
            control the lfo instead of a row
          </label>
        )}

        {!targetsLfo && (
          <Select label="row" value={String(mod.row ?? '')}
            options={preset.list.map((r, i) => ({ value: String(i), label: `${i} · ${r.effect}` }))}
            onChange={(v) => dispatch({ type: 'set-mod', kind, patch: { row: Number(v), param: undefined } })} />
        )}

        <Select label="param" value={mod.param ?? ''}
          options={(targetsLfo ? ['speed', 'depth', 'phase'] : params.map((p) => p.name)).map((n) => ({ value: n, label: n }))}
          onChange={(v) => dispatch({ type: 'set-mod', kind, patch: { param: v } })} />

        <label className="label flex items-center gap-1">
          depth
          <input type="number" step="0.1" value={mod.depth ?? ''}
            onChange={(e) => dispatch({ type: 'set-mod', kind, patch: { depth: e.target.value === '' ? undefined : Number(e.target.value) } })}
            className="data w-20 border border-rule bg-paper px-1 py-0.5" />
        </label>

        {kind === 'lfo' && (
          <>
            <span className="label flex items-center gap-1" role="radiogroup" aria-label="lfo shape">
              shape
              {LFO_SHAPES.map((s) => {
                const on = preset.lfo?.shape === s
                return (
                  <button key={s} type="button" role="radio" aria-checked={on} title={s}
                    onClick={() => dispatch({ type: 'set-mod', kind, patch: { shape: s } as never })}
                    className={`flex h-7 w-9 items-center justify-center border ${
                      on ? 'border-orange bg-orange-soft text-orange' : 'border-rule bg-paper text-mute hover:border-orange hover:text-orange'
                    }`}>
                    <LfoGlyph shape={s} size={20} />
                  </button>
                )
              })}
              <span className="data ml-1">{preset.lfo?.shape ?? '—'}</span>
            </span>
            <label className="label flex items-center gap-1">
              speed
              <input type="number" step="0.5" min="0" value={preset.lfo?.speed ?? ''}
                onChange={(e) => dispatch({ type: 'set-mod', kind, patch: { speed: e.target.value === '' ? undefined : Number(e.target.value) } as never })}
                className="data w-20 border border-rule bg-paper px-1 py-0.5" />
            </label>
          </>
        )}
      </div>

      <p className="label mt-2 opacity-70">
        {targetsLfo
          ? 'pushing the handle changes the lfo itself — a wobble that speeds up as you squeeze'
          : mod.depth !== undefined && mod.depth < 0
            ? 'negative depth: pushing the handle lowers the value'
            : blurb}
      </p>
    </div>
  )
}

function Trigger({ preset, dispatch }: { preset: Preset; dispatch: (a: Action) => void }) {
  const sampleRows = preset.list
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.effect === 'SAMPLE')

  if (sampleRows.length === 0) return null

  return (
    <div className="flex items-center justify-between border border-rule-soft px-2 py-1.5">
      <Select label="trigger fires row" value={String(preset.trigger?.row ?? '')}
        options={sampleRows.map(({ i }) => ({ value: String(i), label: String(i) }))}
        onChange={(v) => dispatch({ type: 'set-trigger', row: Number(v) })} />
      {preset.trigger === undefined && <span className="label text-orange">no trigger set</span>}
    </div>
  )
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  return (
    <label className="label flex items-center gap-1">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="data border border-rule bg-paper px-1 py-0.5">
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  )
}
