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
  /**
   * Set where the block is not in the guide's own effect table and we are
   * trusting a field report instead (see FIELD_REPORTS). The validator never
   * hard-errors on these: it does not know the real ranges, so a value it
   * dislikes is a warning, not a refusal.
   */
  unverified?: string
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
    // Asked repeatedly by people with the mic: SAMPLE is not an effect on your
    // voice. Its pitch and speed move the sample, and nothing else.
    blurb: 'drops the triggered sound into the chain here — its knobs move the sound, not your voice',
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
  /**
   * BALANCE is NOT in the guide's effect table. It appears as a chain row in a
   * working config published by a player with an EP-2350 TING, used three times
   * in one preset to pan a bus hard right, a bus hard left, and then to set the
   * mix between them. We list it because the alternative is refusing a file that
   * demonstrably runs — the one failure this validator exists to avoid.
   * The parameter name and its range are our reading, not TE's: 'balance' to
   * match the identically-named parameter on DELAY and SAMPLE, 0 left, 1 right.
   */
  {
    name: 'BALANCE',
    label: 'balance',
    blurb: 'pans this point of the chain — left, right, or between two buses',
    oncePerChain: false,
    unverified: 'ep2350-ting-config',
    params: [p('balance', 0.0, 1.0, 0.5, '0 is hard left, 1 is hard right — our reading, not the guide’s')],
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

/**
 * A value read back in the unit a person actually thinks in. HARMONY's pitch is
 * a ratio, and nobody asks for 1.19 — they ask for three semitones up, which is
 * a question people have had to work out with a calculator.
 */
export function paramReadout(effect: string, param: string, value: number): string | undefined {
  if (effect === 'HARMONY' && param === 'pitch' && value > 0) {
    const semitones = Math.round(12 * Math.log2(value) * 10) / 10
    if (Math.abs(semitones) < 0.05) return 'same pitch'
    return `${semitones > 0 ? '+' : ''}${semitones} semitones`
  }
  return undefined
}

export const PLAYMODES = ['oneshot', 'hold', 'startstop'] as const
export type Playmode = (typeof PLAYMODES)[number]

export const LFO_SHAPES = ['sine', 'square', 'sawtooth', 'random'] as const
export type LfoShape = (typeof LFO_SHAPES)[number]

/**
 * What the three buttons do, from the guide. Worth stating plainly because the
 * orange one has five positions, not four — people count the lights and assume
 * a preset is missing.
 */
export const BUTTONS = {
  orange: 'steps through no effect and the four preset slots — the first position is your voice, dry',
  white: 'selects which of the four sample slots is armed',
  grey: 'plays the selected sample',
} as const

/**
 * The four sounds already in the mic, which is why a pack needs no wav at all.
 * The censor beep is not merely a sound: the guide says it "temporarily mutes
 * fx-mic, for foul language emergencies".
 */
export const FACTORY_SOUNDS = ['horn', 'applause', 'ringside bell', 'censor beep'] as const

/**
 * The output, and the only warning in this file about a person rather than a
 * mic. The guide is explicit: it is a line output for a mixer or a K.O. II, and
 * 2 VRMS into headphones "can be very loud".
 */
export const LINE_OUT = {
  what: 'stereo line output',
  maxLevel: '8 dBu, 2 VRMS',
  snr: '98 dBA',
  warning:
    'Designed for a K.O. II or an audio mixer, not for headphones directly — at 2 VRMS it can be very loud.',
} as const

export const LIMITS = {
  /** Orange button: four effect preset slots, plus a dry position before them. */
  presets: 4,
  /** White button: four sample slots. */
  samples: 4,
  /** "total storage is 1 mb" — the guide's own approximation. */
  storageBytes: 1_024 * 1_024,
  /** Guide: wav only, mono or stereo, 8/16/24-bit or 32-bit float, up to 96 kHz. */
  audio: {
    extensions: ['.wav'],
    /**
     * The guide names the files on the disk "1.wav, 2.wav, 3.wav and 4.wav".
     * It does not say whether the firmware will read any other name, so this is
     * a warning and never a refusal — see AMBIGUOUS.sampleNames.
     */
    names: ['1.wav', '2.wav', '3.wav', '4.wav'],
    bitDepths: [8, 16, 24, 32],
    maxSampleRate: 96_000,
    maxChannels: 2,
  },
  /** "BUS": 1 or 2. The guide documents no other value. */
  busValues: [1, 2],
  /**
   * "The device parses up to 16 effects per preset." Not in TE's guide — this
   * comes from the firmware's own REPL API, documented by a player (see
   * FIELD_REPORTS['ep2350-repl-api']). A chain longer than this is therefore a
   * warning, not a refusal: we are trusting a summary of the firmware, and the
   * cost of being wrong is refusing a file that works.
   */
  maxRowsPerPreset: 16,
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
/**
 * Things we know from players rather than from Teenage Engineering. These are
 * weaker than the guide and stronger than nothing: each one is a claim someone
 * made about a mic they had in front of them, so we warn on them and never
 * error. Cite the key in the diagnostic so a reader can weigh the source.
 */
export const FIELD_REPORTS = {
  'ep2350-ting-config': {
    what:
      'A four-preset config walked through running on a real EP-2350 TING — the mic ' +
      'bundled with the EP-40 RIDDIM. Same model number as the standalone unit; the two ' +
      'differ in labelling and in the presets they ship with (the TING is sold on echo, ' +
      'echo + spring, pixie and robot), which are built from these same blocks. Whether ' +
      'they differ in any other way is not known, so everything sourced here stays a ' +
      'warning until it has been heard on a standalone mic.',
    where: 'https://www.youtube.com/watch?v=C2KM5qBMkKw',
    when: '2026-09',
  },
  'ep2350-ting-comments': {
    what:
      'Replies under that video, from other TING owners. Three claims worth having: a ' +
      '"trigger" pointed at an effect row switches it in and out while held (and kills the ' +
      'sample button); on newer firmware your own wavs need an explicit "samples" block ' +
      'listing every one; and SAMPLE only ever moves the sample, never the voice.',
    where: 'https://www.youtube.com/watch?v=C2KM5qBMkKw',
    when: '2026-09',
  },
  'ep2350-repl-api': {
    what:
      "Documentation of the firmware's own MicroPython REPL, published by a player who " +
      'drives the mic live over Web Serial. Stronger than the video, because the effect ' +
      'list is read out of the device rather than transcribed from the guide: it confirms ' +
      'BALANCE as a real effect and "mpy" as a real LFO key, and adds a ceiling of 16 ' +
      'effects per preset. Note it is still one person\'s summary of the firmware, not the ' +
      'firmware: it lists no EQUALISER although the guide documents one, which is why we ' +
      'keep EQUALISER rather than deleting it on this evidence.',
    where: 'https://github.com/brunomarinho/labs-te-ting-preset/blob/main/docs/REPL-API.md',
    when: '2026-09',
  },
} as const

export type FieldReportKey = keyof typeof FIELD_REPORTS

export const AMBIGUOUS = {
  bus: 'The guide describes BUS in a single line and does not define how buses are summed.',
  sampleNames:
    'The guide names the sample files 1.wav to 4.wav and never says whether the firmware ' +
    'will read any other name. If it will not, a pack built from files with their own names ' +
    'is silent and gives no reason why.',
  sampleOnBus: 'The guide is silent on SAMPLE inside a bus; a player reports SAMPLE on BUS 2 gives no playback, and puts it on BUS 1 instead.',
  triggerOnEffect:
    'The guide only ever points "trigger" at a SAMPLE row. A player reports it works on an ' +
    'effect row too, switching that effect in and out while held, and that the sample button ' +
    'stops working when you do. The author of the config could not reproduce it.',
  trigger: 'The guide does not say whether "trigger" is required when a preset contains a SAMPLE row; a player reports that without one, pointed at the exact SAMPLE row, nothing plays.',
  paramCase: 'The guide requires uppercase effect names but shows parameters in lowercase; it never states whether parameter names are case-sensitive.',
  unknownKeys: 'The guide does not say whether the firmware ignores unrecognised keys or refuses the file.',
} as const
