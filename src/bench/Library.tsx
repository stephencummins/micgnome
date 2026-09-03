import { useState } from 'react'
import { LIBRARY, type Pack } from '../packs/library'
import { serialize } from '../fxmic/serialize'
import { Sigil } from './Sigil'
import type { Action } from './state'
import type { Preset } from '../fxmic/types'
import { LFO_SHAPES, type LfoShape } from '../fxmic/spec'
import { EffectGlyph, LfoGlyph, SourceGlyph } from './Glyphs'

/**
 * The starter library. Read-only for now: these load onto the bench, and
 * uploading your own comes later, once there is something worth moderating.
 */
export function Library({ dirty, dispatch }: { dirty: boolean; dispatch: (a: Action) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="label m-0 max-w-prose leading-relaxed">
        packs built from the fx-mic&rsquo;s own ten blocks, borrowing ideas from other boxes. none carries a
        wav &mdash; they drive the mic&rsquo;s four factory sounds, so they are a few hundred bytes and you can
        try any of them without finding a sample first.
      </p>

      <div className="grid gap-3 lg:grid-cols-2">
        {LIBRARY.map((pack) => (
          <Card key={pack.id} pack={pack} dirty={dirty} dispatch={dispatch} />
        ))}
      </div>
    </div>
  )
}

function Card({ pack, dirty, dispatch }: { pack: Pack; dirty: boolean; dispatch: (a: Action) => void }) {
  const [confirming, setConfirming] = useState(false)
  const bytes = new TextEncoder().encode(serialize(pack.config)).byteLength

  function load() {
    dispatch({ type: 'load', config: structuredClone(pack.config) })
    setConfirming(false)
  }

  return (
    <div className="flex flex-col border border-rule bg-paper p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Sigil pack={pack.id} />
          <span className="data font-medium tracking-wide text-[15px] text-orange">{pack.name}</span>
        </div>
        <span className="label shrink-0">after {pack.after}</span>
      </div>

      <p className="label mt-3 leading-relaxed">{pack.blurb}</p>

      <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
        {pack.config.presets.map((preset) => (
          <li key={preset.pos} className="data flex gap-2 border-b border-rule-soft pb-1">
            <span className="text-mute">{preset.pos}</span>
            <span className="w-24 shrink-0 font-medium">{preset.name}</span>
            <span className="label flex-1">{preset.comment}</span>
            <Strip preset={preset} />
          </li>
        ))}
      </ul>

      <p className="label mt-3 m-0 flex items-start gap-1.5">
        <SourceGlyph kind="handle" size={15} className="mt-0.5 text-orange" />
        <span><span className="text-orange">handle</span> {pack.handle}</span>
      </p>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-rule-soft pt-3">
        <span className="label">
          {bytes} bytes · {pack.verified ? 'tested on hardware' : 'not yet heard on hardware'}
        </span>

        {confirming ? (
          <span className="flex items-center gap-2">
            <span className="label">replace the bench?</span>
            <button type="button" onClick={load}
              className="data border border-orange bg-orange px-2 py-0.5 text-white">yes</button>
            <button type="button" onClick={() => setConfirming(false)}
              className="data border border-rule px-2 py-0.5">no</button>
          </span>
        ) : (
          <button type="button" onClick={() => (dirty ? setConfirming(true) : load())}
            className="data shrink-0 border border-orange px-3 py-1 tracking-wider text-orange hover:bg-orange hover:text-white">
            load
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * A preset as a row of shapes: the blocks the audio falls through, then a rule,
 * then whatever moves them. Orange for the movers, because the library is where
 * you learn what the handle does before you read a word.
 */
function Strip({ preset }: { preset: Preset }) {
  const sources = (['handle', 'shake', 'lfo'] as const).filter((k) => preset[k])
  const shape = preset.lfo?.shape
  const lfoShape = LFO_SHAPES.includes(shape as LfoShape) ? (shape as LfoShape) : undefined
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1 self-start pt-0.5"
      title={[
        preset.list.map((r) => (r.BUS === undefined ? r.effect : `${r.effect} (bus ${r.BUS})`)).join(' → '),
        sources.join(' + '),
      ].filter(Boolean).join(' · ')}>
      {preset.list.map((r, i) => (
        <span key={i} className="relative inline-flex">
          <EffectGlyph name={r.effect} size={14} />
          {r.BUS !== undefined && (
            <span aria-hidden className="label absolute -right-1 -bottom-1 text-[8px] leading-none">{r.BUS}</span>
          )}
        </span>
      ))}
      {sources.length > 0 && <span aria-hidden className="mx-0.5 h-3 w-px bg-rule" />}
      {sources.map((k) =>
        k === 'lfo' && lfoShape ? (
          <LfoGlyph key={k} shape={lfoShape} size={14} className="text-orange" />
        ) : (
          <SourceGlyph key={k} kind={k} size={14} className="text-orange" />
        ),
      )}
    </span>
  )
}
