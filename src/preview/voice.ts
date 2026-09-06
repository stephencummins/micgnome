/**
 * A voice to hear the chain with, when you would rather not use your own.
 *
 * The other editor for this mic ships a recording of somebody singing. We
 * cannot: a recording is a licence question and a file to host, and this
 * project's rule about other people's work is that we use their facts and not
 * their assets. So this voice is *built* — a glottal buzz through three formant
 * filters, which is the textbook source-and-filter model of a vowel.
 *
 * It is honestly a synthetic voice and the UI says so. What matters is that it
 * is a voice-shaped signal: harmonics all the way up for a filter to bite on,
 * formants where a mouth puts them, and syllables so a delay has something to
 * repeat. For judging what LOWPASS or REVERB does to a preset it is arguably
 * better than a real voice, because it is the same every time.
 *
 * The phrase itself is pure data and tested. The wiring below it is not — it is
 * a handful of Web Audio calls with nothing to get wrong that a test would see.
 */

export type VoiceMode = 'singing' | 'spoken'

/**
 * Formants for five vowels: the first three resonances of the vocal tract, in
 * hertz, with the bandwidth of each. Standard measured values for an adult
 * voice — this is the one part of the file that is not invented.
 */
export const VOWELS = {
  a: { f: [730, 1090, 2440], bw: [80, 100, 160] },
  e: { f: [530, 1840, 2480], bw: [70, 100, 160] },
  i: { f: [270, 2290, 3010], bw: [60, 100, 170] },
  o: { f: [570, 840, 2410], bw: [70, 90, 160] },
  u: { f: [300, 870, 2240], bw: [60, 90, 160] },
} as const

export type Vowel = keyof typeof VOWELS

/** How loud each formant is relative to the first. Higher ones sit back. */
export const FORMANT_LEVELS = [1, 0.45, 0.2] as const

export interface Syllable {
  /** Seconds from the start of the phrase. */
  at: number
  seconds: number
  hz: number
  vowel: Vowel
  /** 0..1. Speech leans on some syllables and throws others away. */
  level: number
  /** A breath burst at the front of it, which is what a consonant sounds like. */
  consonant: boolean
}

export interface Phrase {
  syllables: Syllable[]
  /** Including the pause before it comes round again. */
  seconds: number
}

const semitone = (hz: number, steps: number) => hz * Math.pow(2, steps / 12)

/**
 * Two phrases, because the two ask different questions of a chain. The sung one
 * holds notes, so a reverb tail and a filter sweep are audible. The spoken one
 * is short, consonant-heavy and full of gaps, which is where a delay or a
 * distortion shows its character.
 */
export function phrase(mode: VoiceMode): Phrase {
  if (mode === 'singing') {
    const root = 196 // G3, a comfortable middle for either voice.
    const notes: [number, Vowel][] = [
      [0, 'a'], [4, 'e'], [7, 'i'], [4, 'o'], [9, 'a'], [7, 'e'], [0, 'u'],
    ]
    let at = 0
    const syllables = notes.map(([steps, vowel], i) => {
      const seconds = i === notes.length - 1 ? 1.6 : 0.68
      const s: Syllable = { at, seconds, hz: semitone(root, steps), vowel, level: 1, consonant: false }
      at += seconds
      return s
    })
    return { syllables, seconds: at + 0.7 }
  }

  // Speech: a falling pitch contour, uneven stress, a breath in the middle.
  const root = 118
  const spoken: [number, Vowel, number, boolean, number][] = [
    // steps, vowel, seconds, consonant, level
    [2, 'e', 0.16, true, 0.9],
    [1, 'a', 0.2, false, 1],
    [0, 'o', 0.14, true, 0.7],
    [2, 'i', 0.18, true, 0.85],
    [-1, 'a', 0.24, false, 1],
    [-2, 'u', 0.3, true, 0.6],
    [3, 'e', 0.15, true, 0.9],
    [1, 'i', 0.17, false, 0.8],
    [-3, 'o', 0.34, true, 0.7],
  ]
  let at = 0
  const syllables = spoken.map(([steps, vowel, seconds, consonant, level], i) => {
    const s: Syllable = { at, seconds, hz: semitone(root, steps), vowel, level, consonant }
    // A gap after every syllable, and a longer one where a comma would go.
    at += seconds + (i === 4 ? 0.34 : 0.06)
    return s
  })
  return { syllables, seconds: at + 0.8 }
}

export interface VoiceSource {
  /** Connect this to the chain. */
  node: AudioNode
  start: () => void
  stop: () => void
}

/** White noise to burst at the front of a syllable. One second, looped. */
function noiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.floor(context.sampleRate)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

/**
 * Build the voice and hand back something to connect and to start.
 *
 * The master gain is makeup: a sawtooth through three narrow bandpass filters
 * comes out much quieter than it went in. Measured through the running bench
 * rather than guessed, the phrase peaks around -12 dBFS RMS at a gain of 1,
 * which sits where a microphone tends to arrive and leaves headroom for a
 * chain of wet blocks to stack on top. It is the number to move if this turns
 * out loud or quiet beside a real mic.
 */
export function buildVoice(context: AudioContext, mode: VoiceMode): VoiceSource {
  const { syllables, seconds } = phrase(mode)
  const sung = mode === 'singing'

  const out = context.createGain()
  out.gain.value = 1

  // Voiced part: a buzz, wobbled, through three formants in parallel.
  const glottis = context.createOscillator()
  glottis.type = 'sawtooth'
  glottis.frequency.value = syllables[0].hz

  const vibrato = context.createOscillator()
  vibrato.type = 'sine'
  vibrato.frequency.value = sung ? 5.2 : 2.6
  const vibratoDepth = context.createGain()
  vibratoDepth.gain.value = sung ? 4 : 1.2
  vibrato.connect(vibratoDepth).connect(glottis.frequency)

  const envelope = context.createGain()
  envelope.gain.value = 0

  const formants = FORMANT_LEVELS.map((level) => {
    const filter = context.createBiquadFilter()
    filter.type = 'bandpass'
    const gain = context.createGain()
    gain.gain.value = level
    glottis.connect(filter).connect(gain).connect(envelope)
    return filter
  })
  envelope.connect(out)

  // Unvoiced part: a noise burst where a consonant would be.
  const noise = context.createBufferSource()
  noise.buffer = noiseBuffer(context)
  noise.loop = true
  const noiseBand = context.createBiquadFilter()
  noiseBand.type = 'bandpass'
  noiseBand.frequency.value = 3200
  noiseBand.Q.value = 0.8
  const noiseEnvelope = context.createGain()
  noiseEnvelope.gain.value = 0
  noise.connect(noiseBand).connect(noiseEnvelope).connect(out)

  let timer: ReturnType<typeof setTimeout> | undefined
  let stopped = false

  const setVowel = (vowel: Vowel, at: number, glide: number) => {
    const shape = VOWELS[vowel]
    formants.forEach((filter, i) => {
      filter.frequency.setTargetAtTime(shape.f[i], at, glide)
      filter.Q.value = shape.f[i] / shape.bw[i]
    })
  }

  const schedule = (t0: number) => {
    const attack = sung ? 0.045 : 0.014
    const release = sung ? 0.09 : 0.05
    const glide = sung ? 0.05 : 0.018

    for (const s of syllables) {
      const at = t0 + s.at
      glottis.frequency.setTargetAtTime(s.hz, at, glide)
      setVowel(s.vowel, at, glide)

      envelope.gain.setTargetAtTime(s.level, at, attack)
      envelope.gain.setTargetAtTime(0, at + s.seconds, release)

      if (s.consonant) {
        noiseEnvelope.gain.setTargetAtTime(0.22 * s.level, at - 0.03, 0.006)
        noiseEnvelope.gain.setTargetAtTime(0, at + 0.02, 0.012)
      }
    }

    timer = setTimeout(() => {
      if (!stopped) schedule(context.currentTime + 0.05)
    }, seconds * 1000)
  }

  return {
    node: out,
    start: () => {
      glottis.start()
      vibrato.start()
      noise.start()
      schedule(context.currentTime + 0.08)
    },
    stop: () => {
      stopped = true
      if (timer) clearTimeout(timer)
      try {
        glottis.stop()
        vibrato.stop()
        noise.stop()
        out.disconnect()
      } catch {
        // Already stopped; a source can only be stopped once.
      }
    },
  }
}
