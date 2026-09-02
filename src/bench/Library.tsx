import { useState } from 'react'
import { LIBRARY, type Pack } from '../packs/library'
import { serialize } from '../fxmic/serialize'
import type { Action } from './state'

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
      <div className="flex items-baseline justify-between gap-3">
        <span className="data font-medium tracking-wide text-[15px]">{pack.name}</span>
        <span className="label shrink-0">after {pack.after}</span>
      </div>

      <p className="label mt-2 leading-relaxed">{pack.blurb}</p>

      <ul className="m-0 mt-3 flex list-none flex-col gap-1 p-0">
        {pack.config.presets.map((preset) => (
          <li key={preset.pos} className="data flex gap-2 border-b border-rule-soft pb-1">
            <span className="text-mute">{preset.pos}</span>
            <span className="w-24 shrink-0 font-medium">{preset.name}</span>
            <span className="label">{preset.comment}</span>
          </li>
        ))}
      </ul>

      <p className="label mt-3 m-0">
        <span className="text-orange">handle</span> {pack.handle}
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
            className="data shrink-0 border border-ink px-3 py-1 tracking-wider hover:border-orange hover:text-orange">
            load
          </button>
        )}
      </div>
    </div>
  )
}
