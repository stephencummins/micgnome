/**
 * Hearing the chain.
 *
 * Two ways in. A voice we build in the browser, which needs no permission, no
 * headphones and no microphone at all; or your own voice, which is the point of
 * the mic but wants headphones or it howls. The made-up one is the default
 * because it works everywhere on the first press, and because it is the same
 * every time, which is what you want when comparing two settings.
 *
 * Either way this is the browser's impression, not the mic — the copy says
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
import { buildVoice } from '../preview/voice'
import type { VoiceMode, VoiceSource } from '../preview/voice'
import type { Preset } from '../fxmic/types'

type Source = 'voice' | 'mic'

/**
 * A button that is held rather than pressed, because the handle and the shake
 * are things you do to a mic and then stop doing. Space and Enter hold it too,
 * so it is not a mouse-only control.
 */
function Hold({ label, on, set }: { label: string; on: boolean; set: (held: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        set(true)
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onKeyDown={(e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault()
          set(true)
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') set(false)
      }}
      onBlur={() => set(false)}
      className={`label rounded border px-3 py-1 ${
        on ? 'border-orange bg-orange text-paper' : 'border-rule hover:border-orange hover:text-orange'
      }`}
    >
      {label}
    </button>
  )
}

export function Listen({ preset, handle }: { preset: Preset; handle: number }) {
  const [on, setOn] = useState(false)
  const [source, setSource] = useState<Source>('voice')
  const [mode, setMode] = useState<VoiceMode>('singing')
  const [held, setHeld] = useState({ handle: false, shake: false })
  const [error, setError] = useState<string | null>(null)
  const [skipped, setSkipped] = useState<Rig['skipped']>([])

  const context = useRef<AudioContext | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const mic = useRef<MediaStreamAudioSourceNode | null>(null)
  const voice = useRef<VoiceSource | null>(null)
  const voiceMode = useRef<VoiceMode | null>(null)
  const rig = useRef<Rig | null>(null)

  // The chain is rebuilt whenever it changes, so an edit is audible immediately
  // rather than on the next start. Serialising the preset is cheap next to the
  // graph itself and saves tracking which of a dozen fields moved.
  const shape = JSON.stringify(preset)

  const dropMic = () => {
    mic.current?.disconnect()
    mic.current = null
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }

  const dropVoice = () => {
    voice.current?.stop()
    voice.current = null
    voiceMode.current = null
  }

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

        let input: AudioNode
        if (source === 'mic') {
          dropVoice()
          if (!stream.current) {
            stream.current = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
            })
          }
          if (cancelled) return
          if (!mic.current) mic.current = ctx.createMediaStreamSource(stream.current)
          input = mic.current
        } else {
          dropMic()
          // The phrase keeps playing across an edit: only a change of voice
          // starts it again, so dragging a slider does not restart the singer.
          if (!voice.current || voiceMode.current !== mode) {
            dropVoice()
            voice.current = buildVoice(ctx, mode)
            voiceMode.current = mode
            voice.current.start()
          }
          input = voice.current.node
        }

        rig.current?.stop()
        const built = buildRig(ctx, preset, ctx.destination)
        input.disconnect()
        input.connect(built.input)
        built.setHandle(held.handle ? 1 : handle)
        built.setShake(held.shake ? 1 : 0)
        rig.current = built
        setSkipped(built.skipped)
        setError(null)
      } catch (err) {
        if (cancelled) return
        const name = err instanceof Error ? err.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'The browser would not give us the microphone. Allow it in the address bar and press listen again, or use the made-up voice.'
            : name === 'NotFoundError'
              ? 'No microphone found on this computer. The made-up voice needs one no more than a speaker does.'
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
  }, [on, source, mode, shape])

  // Squeezing while it plays: the whole point of the handle, so it updates on
  // every move rather than on release.
  useEffect(() => {
    rig.current?.setHandle(held.handle ? 1 : handle)
    rig.current?.setShake(held.shake ? 1 : 0)
  }, [handle, held])

  const stop = () => {
    rig.current?.stop()
    rig.current = null
    dropVoice()
    dropMic()
    void context.current?.close()
    context.current = null
    setHeld({ handle: false, shake: false })
    setSkipped([])
    setOn(false)
  }

  useEffect(() => () => stop(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (active: boolean) =>
    `label rounded border px-2 py-0.5 ${
      active ? 'border-orange text-orange' : 'border-rule text-mute hover:border-orange hover:text-orange'
    }`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => (on ? stop() : setOn(true))}
          className={`label rounded border px-3 py-1 ${
            on ? 'border-orange bg-orange text-paper' : 'border-rule hover:border-orange hover:text-orange'
          }`}>
          {on ? 'stop' : 'listen'}
        </button>

        <div className="flex items-center gap-1">
          <button type="button" className={pick(source === 'voice')} onClick={() => setSource('voice')}>
            a made-up voice
          </button>
          <button type="button" className={pick(source === 'mic')} onClick={() => setSource('mic')}>
            your microphone
          </button>
        </div>

        {source === 'voice' && (
          <div className="flex items-center gap-1">
            <button type="button" className={pick(mode === 'singing')} onClick={() => setMode('singing')}>
              singing
            </button>
            <button type="button" className={pick(mode === 'spoken')} onClick={() => setMode('spoken')}>
              spoken
            </button>
          </div>
        )}

        <span className="label text-mute">
          {!on
            ? 'hear this chain before you write it'
            : source === 'mic'
              ? 'your voice, through this chain — wear headphones or it will howl'
              : 'a voice we built, through this chain'}
        </span>
      </div>

      {/* Only offered once a mover actually names a parameter. A half-wired one
          is already flagged by the validator; a button that does nothing when
          held would just make you doubt your ears. */}
      {on && (preset.handle?.param || preset.shake?.param) && (
        <div className="flex flex-wrap items-center gap-2">
          {preset.handle?.param && (
            <Hold label="hold the handle" on={held.handle}
              set={(v) => setHeld((h) => ({ ...h, handle: v }))} />
          )}
          {preset.shake?.param && (
            <Hold label="shake it" on={held.shake}
              set={(v) => setHeld((h) => ({ ...h, shake: v }))} />
          )}
          <span className="label text-mute">hold to hear what the movers do</span>
        </div>
      )}

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
          {source === 'voice' && ' The voice is not a recording of anybody: it is built out of oscillators, here in the page.'}
        </p>
      )}
    </div>
  )
}
