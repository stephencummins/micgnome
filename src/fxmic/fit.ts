/**
 * The fitter.
 *
 * Four sounds, 1 mb, and a choice of trim, channel count, bit depth and sample
 * rate for each. That is a small knapsack with a taste component, and it is
 * genuinely tedious by hand — so the app does it and, more importantly, says
 * exactly what it gave up.
 *
 * Concessions are applied in a fixed order, cheapest in quality first, always
 * to the largest unprotected slot. Deterministic, explainable, and never
 * silently lossy: every step lands in the plan's notes.
 */
import { LIMITS } from './spec'
import { type Audio, findSound, resample, slice, toMono, wavBytes } from './wav'

export interface Encoding {
  sampleRate: number
  bitDepth: 8 | 16 | 24 | 32
  float: boolean
  channelCount: 1 | 2
  /** Frames of the ORIGINAL audio to keep. Absent means all of it. */
  trim?: { start: number; end: number }
}

export interface FitSlot {
  id: string
  audio: Audio
  /** Higher is protected for longer. The sound you care most about. */
  priority?: number
}

export interface SlotPlan {
  id: string
  encoding: Encoding
  bytes: number
  /** What was traded, in order, in the user's language. */
  notes: string[]
}

export interface FitPlan {
  fits: boolean
  totalBytes: number
  budget: number
  slots: SlotPlan[]
  summary: string
}

/** Sample rates the ladder steps down through, highest first. */
const RATES = [96000, 48000, 44100, 32000, 22050, 16000, 11025, 8000]

export function nativeEncoding(audio: Audio, bitDepth: 8 | 16 | 24 | 32 = 16, float = false): Encoding {
  return {
    sampleRate: audio.sampleRate,
    bitDepth,
    float,
    channelCount: (audio.channels.length >= 2 ? 2 : 1) as 1 | 2,
  }
}

export function encodedBytes(audio: Audio, encoding: Encoding): number {
  const kept = encoding.trim ? encoding.trim.end - encoding.trim.start : audio.channels[0]?.length ?? 0
  const frames = Math.max(1, Math.round(kept * (encoding.sampleRate / audio.sampleRate)))
  return wavBytes(frames, encoding.channelCount, encoding.bitDepth)
}

/** Turns a plan back into audio, ready to encode and write. */
export function applyEncoding(audio: Audio, encoding: Encoding): Audio {
  let out = audio
  if (encoding.trim) out = slice(out, encoding.trim.start, encoding.trim.end)
  if (encoding.channelCount === 1) out = toMono(out)
  if (encoding.sampleRate !== out.sampleRate) out = resample(out, encoding.sampleRate)
  return out
}

interface Step {
  apply: (e: Encoding) => Encoding
  note: (before: Encoding) => string
}

/** The concession ladder for one slot, cheapest in quality first. */
function ladder(audio: Audio): Step[] {
  const steps: Step[] = []
  const frames = audio.channels[0]?.length ?? 0
  const sound = findSound(audio)

  // 1. Silence is free to lose.
  if (sound.start > 0 || sound.end < frames) {
    steps.push({
      apply: (e) => ({ ...e, trim: sound }),
      note: () => `trimmed ${((frames - (sound.end - sound.start)) / audio.sampleRate).toFixed(2)} s of silence`,
    })
  }

  // 2. For most sound effects, mono is imperceptible and halves the file.
  if (audio.channels.length >= 2) {
    steps.push({ apply: (e) => ({ ...e, channelCount: 1 }), note: () => 'stereo → mono' })
  }

  // 3. Depth above 16-bit buys nothing on a handheld microphone.
  steps.push({
    apply: (e) => ({ ...e, bitDepth: 16, float: false }),
    note: (before) => `${before.float ? '32-bit float' : `${before.bitDepth}-bit`} → 16-bit`,
  })

  // 4. Then walk the sample rate down, one stop at a time.
  for (const rate of RATES) {
    steps.push({
      apply: (e) => ({ ...e, sampleRate: rate }),
      note: (before) => `${khz(before.sampleRate)} → ${khz(rate)}`,
    })
  }

  // 5. Last resort. 8-bit is audibly grainy, which is sometimes the point.
  steps.push({ apply: (e) => ({ ...e, bitDepth: 8, float: false }), note: () => '16-bit → 8-bit, audibly grainy' })

  return steps
}

export function fit(slots: FitSlot[], budget = LIMITS.storageBytes, reservedBytes = 0): FitPlan {
  const state = slots.map((slot) => ({
    slot,
    encoding: nativeEncoding(slot.audio, 16),
    steps: ladder(slot.audio),
    at: 0,
    notes: [] as string[],
  }))

  const startingBytes = state.reduce((n, s) => n + encodedBytes(s.slot.audio, s.encoding), 0)
  const available = budget - reservedBytes
  const total = () => state.reduce((n, s) => n + encodedBytes(s.slot.audio, s.encoding), 0)

  // Concede on the largest slot with the lowest priority, one step at a time.
  let guard = state.length * 32
  while (total() > available && guard-- > 0) {
    const candidates = state.filter((s) => s.at < s.steps.length)
    if (!candidates.length) break

    const minPriority = Math.min(...candidates.map((s) => s.slot.priority ?? 0))
    const pool = candidates.filter((s) => (s.slot.priority ?? 0) === minPriority)
    const target = pool.reduce((a, b) =>
      encodedBytes(b.slot.audio, b.encoding) > encodedBytes(a.slot.audio, a.encoding) ? b : a,
    )

    const step = target.steps[target.at++]
    const before = target.encoding
    const after = step.apply(before)
    // Skip steps that change nothing — a 44.1 khz file does not "step down" to 48.
    if (encodedBytes(target.slot.audio, after) >= encodedBytes(target.slot.audio, before)) continue
    target.encoding = after
    target.notes.push(step.note(before))
  }

  const totalBytes = total()
  const plans: SlotPlan[] = state.map((s) => ({
    id: s.slot.id,
    encoding: s.encoding,
    bytes: encodedBytes(s.slot.audio, s.encoding),
    notes: s.notes,
  }))

  return {
    fits: totalBytes <= available,
    totalBytes,
    budget: available,
    slots: plans,
    summary: summarise(plans, startingBytes, totalBytes, available),
  }
}

function summarise(plans: SlotPlan[], before: number, after: number, available: number): string {
  const fits = after <= available
  const touched = plans.filter((p) => p.notes.length)
  const saved = Math.max(0, before - after)

  if (!touched.length) {
    return fits ? 'Everything fits as it is — nothing to trade.' : 'Nothing left to trade; these sounds will not fit.'
  }

  const traded = touched.map((p) => `${p.id}: ${p.notes.join(', ')}`).join('. ')
  const kept = plans.filter((p) => !p.notes.length).map((p) => p.id)
  const keptText = kept.length ? ` Left ${kept.join(' and ')} alone.` : ''

  return fits
    ? `${traded}.${keptText} You got ${kb(saved)} back.`
    : `${traded}.${keptText} Still ${kb(after - available)} over — remove a sample.`
}

/** 44100 reads as "44.1 khz", not "44.10 khz". */
export const khz = (rate: number) => `${(rate / 1000).toFixed(2).replace(/\.?0+$/, '')} khz`
const kb = (bytes: number) => `${Math.round(bytes / 1024)} kb`
