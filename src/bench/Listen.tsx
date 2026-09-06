/**
 * Hearing the chain.
 *
 * Your own voice, through the browser, shaped by whatever is on the bench. Not
 * the mic — the mic has not been heard yet by anybody here — so the copy says
 * "close to" and never "this is what it sounds like".
 *
 * The blocks that cannot be approximated honestly are named on screen rather
 * than silently dropped, which is the same rule the validator follows: a
 * preview that quietly ignored SSB would teach someone their preset does
 * nothing.
 */
import { useEffect, useRef, useState } from 'react'
import { buildRig } from '../preview/engine'
import type { Rig } from '../preview/engine'
import type { Preset } from '../fxmic/types'

export function Listen({ preset, handle }: { preset: Preset; handle: number }) {
  const [on, setOn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [skipped, setSkipped] = useState<Rig['skipped']>([])
  const context = useRef<AudioContext | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const rig = useRef<Rig | null>(null)

  // The chain is rebuilt whenever it changes, so an edit is audible immediately
  // rather than on the next start. Serialising the preset is cheap next to the
  // graph itself and saves tracking which of a dozen fields moved.
  const shape = JSON.stringify(preset)

  useEffect(() => {
    if (!on) return
    let cancelled = false

    const run = async () => {
      try {
        if (!context.current) context.current = new AudioContext()
        const ctx = context.current
        // Safari and Chrome both start suspended until a gesture; this effect
        // only ever runs after the button was pressed.
        if (ctx.state === 'suspended') await ctx.resume()

        if (!stream.current) {
          stream.current = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          })
        }
        if (cancelled) return

        rig.current?.stop()
        const built = buildRig(ctx, preset, ctx.destination)
        ctx.createMediaStreamSource(stream.current).connect(built.input)
        built.setHandle(handle)
        rig.current = built
        setSkipped(built.skipped)
        setError(null)
      } catch (err) {
        if (cancelled) return
        const name = err instanceof Error ? err.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'The browser would not give us the microphone. Allow it in the address bar and press listen again.'
            : name === 'NotFoundError'
              ? 'No microphone found on this computer.'
              : 'Could not start listening on this browser.',
        )
        setOn(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, shape])

  // Squeezing while it plays: the whole point of the handle, so it updates on
  // every move rather than on release.
  useEffect(() => {
    rig.current?.setHandle(handle)
  }, [handle])

  const stop = () => {
    rig.current?.stop()
    rig.current = null
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    void context.current?.close()
    context.current = null
    setSkipped([])
    setOn(false)
  }

  useEffect(() => () => stop(), []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => (on ? stop() : setOn(true))}
          className={`label rounded border px-3 py-1 ${
            on ? 'border-orange bg-orange text-paper' : 'border-rule hover:border-orange hover:text-orange'
          }`}>
          {on ? 'stop' : 'listen'}
        </button>
        <span className="label text-mute">
          {on
            ? 'your voice, through this chain — wear headphones or it will howl'
            : 'hear this chain with your own voice'}
        </span>
      </div>

      {error && <p className="label text-mute">{error}</p>}

      {on && skipped.length > 0 && (
        <ul className="label flex flex-col gap-0.5 text-mute">
          {skipped.map((s) => (
            <li key={s.row}>
              row {s.row + 1}, {s.effect}: {s.why}
            </li>
          ))}
        </ul>
      )}

      {on && (
        <p className="label text-ink-faint">
          This is the browser's impression of the chain, not the mic. Nothing here has been heard on real
          hardware, so treat it as a sketch — the shape will be right, the character may not be.
        </p>
      )}
    </div>
  )
}
