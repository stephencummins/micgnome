import { khz, type Encoding, type FitPlan } from '../fxmic/fit'
import { PLAYMODES, type Playmode } from '../fxmic/spec'
import type { SampleRef } from '../fxmic/types'
import type { Audio, WavFormat } from '../fxmic/wav'
import { envelope } from '../fxmic/wav'
import type { Action } from './state'

export interface Source {
  audio: Audio
  format: WavFormat
  encoding: Encoding
  bytes: number
  /** Set when the drop was rejected — the mic could not read it. */
  problem?: string
}

/**
 * 1 mb is the real constraint of this device, not the json. So the bay is built
 * around one budget bar segmented by slot: you can see which sound is eating the
 * pack before you start deleting things.
 */
export function SampleBay({
  samples,
  sources,
  budget,
  configBytes,
  plan,
  dispatch,
  onDrop,
  onFit,
}: {
  samples: SampleRef[]
  sources: Map<string, Source>
  budget: number
  configBytes: number
  plan?: FitPlan
  dispatch: (a: Action) => void
  onDrop: (file: File) => void
  onFit: () => void
}) {
  const used = samples.reduce((n, s) => n + (sources.get(s.file)?.bytes ?? 0), 0) + configBytes
  const over = used > budget

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="label">samples · white button</span>
        <span className={`data ${over ? 'text-orange' : 'text-mute'}`}>
          {kb(used)} / {kb(budget)}
        </span>
      </div>

      <div className="flex h-3 border border-rule" role="img"
        aria-label={`${kb(used)} of ${kb(budget)} used across ${samples.length} samples`}>
        {samples.map((s, i) => {
          const bytes = sources.get(s.file)?.bytes ?? 0
          return (
            <span key={s.file}
              className="block border-r border-paper bg-orange"
              style={{ width: `${(bytes / budget) * 100}%`, opacity: 1 - i * 0.18 }} />
          )
        })}
        <span className="block border-r border-paper bg-mute/40" style={{ width: `${(configBytes / budget) * 100}%` }} />
      </div>
      <div className="label flex flex-wrap gap-x-4">
        {samples.map((s) => (
          <span key={s.file}>{s.pos ?? '·'} {s.file} {kb(sources.get(s.file)?.bytes ?? 0)}</span>
        ))}
        <span className="opacity-60">config.json {kb(configBytes)}</span>
      </div>

      {over && (
        <div className="border border-orange bg-orange-soft p-2">
          <p className="data m-0 text-orange">
            {kb(used - budget)} over. the mic will not take this pack.
          </p>
          <button type="button" onClick={onFit}
            className="data mt-2 border border-orange px-2 py-1 text-orange">
            fit it for me
          </button>
        </div>
      )}

      {plan && (
        <p className="data border border-rule-soft p-2 leading-relaxed text-mute">{plan.summary}</p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {samples.map((sample, i) => (
          <Slot key={sample.file} sample={sample} index={i} source={sources.get(sample.file)} dispatch={dispatch} />
        ))}

        {samples.length < 4 && (
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-rule p-3 hover:border-orange">
            <span className="label">slot {samples.length} empty</span>
            <span className="data">drop a wav</span>
            <input type="file" accept=".wav,audio/wav,audio/x-wav" className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) onDrop(file)
                e.target.value = ''
              }} />
          </label>
        )}
      </div>

      {samples.length === 0 && (
        <p className="label leading-relaxed">
          with no samples declared the mic uses its four factory sounds — horn, applause, ringside bell and
          censor beep. a SAMPLE row in the chain is still required, or nothing plays.
        </p>
      )}
    </div>
  )
}

function Slot({
  sample,
  index,
  source,
  dispatch,
}: {
  sample: SampleRef
  index: number
  source?: Source
  dispatch: (a: Action) => void
}) {
  return (
    <div className={`border p-3 ${source?.problem ? 'border-orange' : 'border-rule'}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="data font-medium">{sample.pos ?? index} {sample.file}</span>
        <button type="button" aria-label={`remove ${sample.file}`}
          onClick={() => dispatch({ type: 'remove-sample', index })}
          className="data h-5 w-5 border border-rule hover:border-orange hover:text-orange">×</button>
      </div>

      {source?.problem ? (
        <p className="data mt-2 text-orange">{source.problem}</p>
      ) : source ? (
        <>
          <Waveform audio={source.audio} />
          <p className="label m-0">
            {source.encoding.bitDepth}-bit{source.encoding.float ? ' float' : ''} · {khz(source.encoding.sampleRate)} ·{' '}
            {source.encoding.channelCount === 1 ? 'mono' : 'stereo'} · {source.format.duration.toFixed(2)} s ·{' '}
            {kb(source.bytes)}
          </p>
        </>
      ) : (
        <p className="label mt-2">not loaded — drop the file again to see its waveform</p>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {PLAYMODES.map((mode) => (
          <button key={mode} type="button"
            onClick={() => dispatch({ type: 'set-playmode', index, playmode: mode as Playmode })}
            className={`data border px-2 py-0.5 ${
              sample.playmode === mode ? 'border-orange bg-orange-soft text-orange' : 'border-rule hover:border-orange'
            }`}>
            {mode}
          </button>
        ))}
      </div>
      <p className="label mt-1 opacity-70">{PLAYMODE_BLURB[sample.playmode ?? 'oneshot']}</p>
    </div>
  )
}

const PLAYMODE_BLURB: Record<string, string> = {
  oneshot: 'plays the whole file once',
  hold: 'plays only while the button is held',
  startstop: 'press to loop, press again to stop',
}

function Waveform({ audio }: { audio: Audio }) {
  const shape = envelope(audio, 90)
  return (
    <svg viewBox="0 0 90 30" width="100%" height="30" className="my-2" role="img" aria-label="waveform" preserveAspectRatio="none">
      {shape.map((v, i) => (
        <rect key={i} x={i} y={15 - Math.max(0.5, v * 14)} width="0.7" height={Math.max(1, v * 28)} fill="var(--color-orange)" />
      ))}
    </svg>
  )
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} kb`
