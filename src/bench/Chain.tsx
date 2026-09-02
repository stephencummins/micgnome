import { EFFECTS, effectByName } from '../fxmic/spec'
import type { EffectRow, Preset } from '../fxmic/types'
import type { Action } from './state'
import { paramDisplay, paramValue } from './state'

export function Chain({
  preset,
  dispatch,
  focus,
}: {
  preset: Preset
  dispatch: (a: Action) => void
  focus?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="label">chain · audio falls through top to bottom</div>

      {preset.list.length === 0 && (
        <p className="label border border-dashed border-rule px-3 py-4">
          empty chain — audio passes through untouched. add a block below.
        </p>
      )}

      {preset.list.map((row, i) => (
        <Row
          key={i}
          row={row}
          index={i}
          last={i === preset.list.length - 1}
          preset={preset}
          dispatch={dispatch}
          focus={focus}
        />
      ))}

      <AddBlock preset={preset} dispatch={dispatch} />
    </div>
  )
}

function Row({
  row,
  index,
  last,
  preset,
  dispatch,
  focus,
}: {
  row: EffectRow
  index: number
  last: boolean
  preset: Preset
  dispatch: (a: Action) => void
  focus?: string
}) {
  const spec = effectByName(row.effect)
  const modsHere = (['handle', 'shake', 'lfo'] as const).filter((k) => preset[k]?.row === index)
  const triggered = preset.trigger?.row === index

  return (
    <div className="border border-rule bg-paper p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="data text-mute">{index}</span>
          <span className="data font-medium tracking-wide text-[15px]">{row.effect}</span>
          {spec && <span className="label">{spec.blurb}</span>}
          {triggered && <span className="label text-orange">trigger</span>}
        </div>
        <div className="flex gap-1">
          <IconButton label="move up" disabled={index === 0}
            onClick={() => dispatch({ type: 'move-row', from: index, to: index - 1 })}>↑</IconButton>
          <IconButton label="move down" disabled={last}
            onClick={() => dispatch({ type: 'move-row', from: index, to: index + 1 })}>↓</IconButton>
          <IconButton label={`remove ${row.effect}`}
            onClick={() => dispatch({ type: 'remove-row', row: index })}>×</IconButton>
        </div>
      </div>

      {!spec && (
        <p className="data mt-2 bg-orange-soft px-2 py-1 text-orange">
          not an effect on this mic — the write button will stay locked
        </p>
      )}

      {spec && (
        <div className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {spec.params.map((param) => {
            const set = paramValue(row, param.name)
            const value = paramDisplay(row, param.name)
            const modulated = modsHere.filter((k) => preset[k]?.param === param.name)
            const path = `presets[?].list[${index}].${param.name}`
            return (
              <label key={param.name}
                className={`block ${focus === path ? 'outline outline-orange' : ''}`}>
                <span className="flex items-baseline justify-between gap-2">
                  <span className={`label ${modulated.length ? 'text-orange' : ''}`}>
                    {param.name}
                    {modulated.length > 0 && ` ← ${modulated.join(' + ')}`}
                  </span>
                  <span className="data">
                    {value}
                    {set === undefined && <span className="text-mute opacity-60"> · unset</span>}
                  </span>
                </span>
                <input
                  type="range"
                  min={param.min}
                  max={param.max}
                  step={stepFor(param.min, param.max)}
                  value={value}
                  onChange={(e) =>
                    dispatch({ type: 'set-param', row: index, param: param.name, value: Number(e.target.value) })
                  }
                />
                <span className="flex items-baseline justify-between">
                  <span className="label opacity-60">{param.min} — {param.max}</span>
                  {set !== undefined && (
                    <button type="button" className="label underline hover:text-orange"
                      onClick={() => dispatch({ type: 'set-param', row: index, param: param.name, value: undefined })}>
                      unset
                    </button>
                  )}
                </span>
                {param.note && <span className="label block opacity-60">{param.note}</span>}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

/**
 * Unset is not the same as zero. The guide publishes ranges but no device
 * defaults, so a parameter the user never touched must stay out of the file.
 */
function stepFor(min: number, max: number): number {
  const span = max - min
  if (span > 1000) return 1
  if (span > 10) return 0.1
  return 0.01
}

function AddBlock({ preset, dispatch }: { preset: Preset; dispatch: (a: Action) => void }) {
  const used = new Set(preset.list.map((r) => r.effect))
  return (
    <div className="flex flex-wrap gap-1 border border-dashed border-rule p-2">
      <span className="label self-center pr-1">add</span>
      {EFFECTS.map((effect) => {
        const blocked = effect.oncePerChain && used.has(effect.name)
        return (
          <button
            key={effect.name}
            type="button"
            disabled={blocked}
            title={blocked ? `${effect.name} can only be used once per chain` : effect.blurb}
            onClick={() => dispatch({ type: 'add-row', effect: effect.name })}
            className="data border border-rule px-2 py-1 hover:border-orange hover:text-orange disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-rule disabled:hover:text-ink"
          >
            {effect.name}
          </button>
        )
      })}
    </div>
  )
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="data h-6 w-6 border border-rule hover:border-orange hover:text-orange disabled:opacity-25 disabled:hover:border-rule disabled:hover:text-ink">
      {children}
    </button>
  )
}
