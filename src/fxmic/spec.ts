/**
 * The EP-2350 fx-mic device specification.
 *
 * Every effect, parameter and range here is transcribed from the official
 * user guide (ver 1.1.1), chapter 7. Where the guide is silent we say so
 * explicitly rather than inventing a rule — see `defaultValue` notes and
 * the `AMBIGUOUS` list at the bottom.
 *
 * Source: https://teenage.engineering/guides/ep-2350
 */

export interface ParamSpec {
  /** Canonical name as it appears in config.json. */
  name: string
  min: number
  max: number
  /**
   * Mic Gnome's starting value for a freshly added block. The guide does NOT
   * publish device defaults, so this is our choice, not Teenage Engineering's.
   * The serializer only writes parameters the user actually touched, so an
   * untouched parameter never reaches the device with our number on it.
   */
  start: number
  note?: string
}

export interface EffectSpec {
  /** Uppercase, as required by the guide ("always use uppercase for effect names"). */
  name: string
  label: string
  blurb: string
  /** Guide marks these with an asterisk: "use once per effect chain". */
  oncePerChain: boolean
  params: ParamSpec[]
}

const p = (name: string, min: number, max: number, start: number, note?: string): ParamSpec =>
  ({ name, min, max, start, note })

export const EFFECTS: EffectSpec[] = [
  {
    name: 'DELAY',
    label: 'delay',
    blurb: 'standard echo',
    oncePerChain: true,
    params: [
      p('time', 0.0, 1.1, 0.4, 'decay — note the ceiling is 1.1, not 1.0'),
      p('echo', 0.0, 1.0, 0.4, 'feedback'),
      p('cross-feed', 0.0, 1.0, 0.0, 'mixes left and right echoes'),
      p('lowpass-cutoff', 0.0, 1.0, 1.0),
      p('highpass-cutoff', 0.0, 1.0, 0.0),
      p('wet-level', 0.0, 1.0, 0.5),
      p('dry-level', 0.0, 1.0, 1.0),
      p('balance', 0.0, 1.0, 0.5),
    ],
  },
  {
    name: 'DIST',
    label: 'dist',
    blurb: 'distortion / overdrive',
    oncePerChain: false,
    params: [
      p('amount', 0.0, 40.0, 10.0),
      p('mix', 0.0, 1.0, 0.5),
      p('lowpass-cutoff', 0.0, 1.0, 1.0),
      p('highpass-cutoff', 0.0, 1.0, 0.0),
    ],
  },
  {
    name: 'EQUALISER',
    label: 'equaliser',
    blurb: 'single peaking band',
    oncePerChain: false,
    params: [
      p('cutoff', 0.0, 1.0, 0.5),
      p('q', 0.0, 1.0, 0.5),
      p('gain', -1.0, 1.0, 0.0, 'the only parameter on the device that goes negative besides SSB frequency'),
    ],
  },
  {
    name: 'HARMONY',
    label: 'harmony',
    blurb: 'pitch-shifted voice against the dry signal',
    oncePerChain: true,
    params: [
      p('pitch', 0.5, 2.0, 1.0, 'ratio, not semitones — 2.0 is an octave up, 0.5 an octave down'),
      p('dry-level', 0.0, 1.0, 1.0),
    ],
  },
  {
    name: 'LOWPASS',
    label: 'lowpass',
    blurb: 'low-pass filter',
    oncePerChain: false,
    params: [p('cutoff', 0.0, 1.0, 1.0)],
  },
  {
    name: 'HIGHPASS',
    label: 'highpass',
    blurb: 'high-pass filter',
    oncePerChain: false,
    params: [p('cutoff', 0.0, 1.0, 0.0)],
  },
  {
    name: 'SAMPLE',
    label: 'sample',
    blurb: 'injects the triggered sample into the chain at this point',
    oncePerChain: false,
    params: [
      p('speed', 0.0, 4.0, 1.0),
      p('pitch', -24.0, 24.0, 0.0, 'semitones'),
      p('level', 0.0, 1.0, 1.0),
      p('balance', 0.0, 1.0, 0.5),
    ],
  },
  {
    name: 'REVERB',
    label: 'reverb',
    blurb: 'room simulation',
    oncePerChain: true,
    params: [
      p('time', 0.0, 1.0, 0.4),
      p('wet-level', 0.0, 1.0, 0.4),
      p('dry-level', 0.0, 1.0, 1.0),
      p('spring-mix', 0.0, 1.0, 0.0, 'adds the metallic boing'),
      p('highpass-cutoff', 0.0, 1.0, 0.0),
    ],
  },
  {
    name: 'RING',
    label: 'ring',
    blurb: 'ring modulation',
    oncePerChain: false,
    params: [
      p('frequency', 0.0, 20000.0, 200.0, 'hz'),
      p('mix', 0.0, 1.0, 0.5),
    ],
  },
  {
    name: 'SSB',
    label: 'ssb',
    blurb: 'single sideband — frequency shift, shortwave radio character',
    oncePerChain: true,
    params: [p('frequency', -20000.0, 20000.0, 0.0, 'hz, and it goes negative')],
  },
]

export const EFFECT_NAMES = EFFECTS.map((e) => e.name)
const BY_NAME = new Map(EFFECTS.map((e) => [e.name, e]))

export const effectByName = (name: string): EffectSpec | undefined => BY_NAME.get(name)

/** Case-insensitive lookup, so we can tell "wrong case" from "does not exist". */
export const effectByLooseName = (name: string): EffectSpec | undefined =>
  BY_NAME.get(String(name).toUpperCase())

export const paramByName = (effect: EffectSpec, param: string): ParamSpec | undefined =>
  effect.params.find((x) => x.name === param)

export const paramByLooseName = (effect: EffectSpec, param: string): ParamSpec | undefined =>
  effect.params.find((x) => x.name.toLowerCase() === String(param).toLowerCase())

export const PLAYMODES = ['oneshot', 'hold', 'startstop'] as const
export type Playmode = (typeof PLAYMODES)[number]

export const LFO_SHAPES = ['sine', 'square', 'sawtooth', 'random'] as const
export type LfoShape = (typeof LFO_SHAPES)[number]

export const LIMITS = {
  /** Orange button: four effect preset slots. */
  presets: 4,
  /** White button: four sample slots. */
  samples: 4,
  /** "total storage is 1 mb" — the guide's own approximation. */
  storageBytes: 1_024 * 1_024,
  /** Guide: wav only, mono or stereo, 8/16/24-bit or 32-bit float, up to 96 kHz. */
  audio: {
    extensions: ['.wav'],
    bitDepths: [8, 16, 24, 32],
    maxSampleRate: 96_000,
    maxChannels: 2,
  },
  /** "BUS": 1 or 2. The guide documents no other value. */
  busValues: [1, 2],
} as const

/**
 * Recovery instruction, from chapter 7.2. This belongs anywhere the user can
 * write to the device, not buried in a manual.
 */
export const RECOVERY =
  'If the mic will not start, connect it to a computer and hold the white + grey ' +
  'buttons during startup to get the disk back, then fix or delete config.json.'

/**
 * Places the guide is genuinely ambiguous. The validator warns here; it never
 * blocks, because refusing a file that works is worse than passing one that
 * might not.
 */
export const AMBIGUOUS = {
  bus: 'The guide describes BUS in a single line and does not define how buses are summed.',
  trigger: 'The guide does not say whether "trigger" is required when a preset contains a SAMPLE row.',
  paramCase: 'The guide requires uppercase effect names but shows parameters in lowercase; it never states whether parameter names are case-sensitive.',
  unknownKeys: 'The guide does not say whether the firmware ignores unrecognised keys or refuses the file.',
} as const
