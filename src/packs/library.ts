/**
 * The starter library.
 *
 * Every pack here is **fx-only**: no `samples` block, which per guide 7.5 means
 * the mic falls back to its four factory sounds. That has three good
 * consequences — nothing of Teenage Engineering's is redistributed, a pack is a
 * few hundred bytes rather than a megabyte, and anyone can try one without
 * finding a wav first.
 *
 * These are homages assembled from the fx-mic's own ten blocks. They are not
 * recreations of another device's DSP, and none of them has been heard on
 * hardware yet — the unit arrives 14 Sep 2026. `verified` flips to true per
 * pack once each has actually been played through a mic.
 */
import type { Config } from '../fxmic/types'

export interface Pack {
  id: string
  name: string
  /** The device whose idea this borrows. */
  after: string
  blurb: string
  /** What the handle does, in one line — the thing you want to know first. */
  handle: string
  /** True only once the pack has been played on real hardware. */
  verified: boolean
  config: Config
}

export const LIBRARY: Pack[] = [
  {
    id: 'punch-in',
    name: 'PUNCH IN',
    after: 'OP–Z punch-in FX',
    blurb:
      'four presets designed as gestures rather than settings. each one does nothing at rest and something extreme at full squeeze, so the handle becomes a punch-in button you hold and release.',
    handle: 'is the effect — silent at 0%, full at 100%',
    verified: false,
    config: {
      name: 'PUNCH IN',
      presets: [
        {
          pos: 0,
          name: 'SWEEP',
          comment: 'wide open until you squeeze, then it slams shut',
          list: [{ effect: 'SAMPLE' }, { effect: 'LOWPASS', cutoff: 1.0 }],
          handle: { row: 1, param: 'cutoff', depth: -0.85 },
          trigger: { row: 0 },
        },
        {
          pos: 1,
          name: 'CRUSH',
          comment: 'clean until you squeeze, then full ring modulation',
          list: [{ effect: 'SAMPLE' }, { effect: 'RING', frequency: 90, mix: 0.0 }],
          handle: { row: 1, param: 'mix', depth: 1.0 },
          trigger: { row: 0 },
        },
        {
          pos: 2,
          name: 'GATE',
          comment: 'a square lfo chops the filter; the handle sets how fast',
          list: [{ effect: 'SAMPLE' }, { effect: 'LOWPASS', cutoff: 1.0 }],
          lfo: { row: 1, param: 'cutoff', depth: -0.9, shape: 'square', speed: 8 },
          handle: { target: 'lfo', param: 'speed', depth: 12 },
          trigger: { row: 0 },
        },
        {
          pos: 3,
          name: 'LIFT',
          comment: 'squeeze to shove the whole voice up a fifth',
          list: [{ effect: 'SAMPLE' }, { effect: 'HARMONY', pitch: 1.0, 'dry-level': 0.6 }],
          handle: { row: 1, param: 'pitch', depth: 0.5 },
          trigger: { row: 0 },
        },
      ],
    },
  },

  {
    id: 'four-shapes',
    name: 'FOUR SHAPES',
    after: 'OP–Z step components',
    blurb:
      'the same idea four ways, so you can hear what each lfo shape actually does. sine breathes, square chops, sawtooth ramps and resets, random lurches. the fastest way to learn the only automatic motion this mic has.',
    handle: 'speeds the lfo up rather than moving a parameter',
    verified: false,
    config: {
      name: 'FOUR SHAPES',
      presets: [
        {
          pos: 0,
          name: 'SINE',
          comment: 'a slow breathing wobble',
          list: [{ effect: 'SAMPLE' }, { effect: 'LOWPASS', cutoff: 0.55 }],
          lfo: { row: 1, param: 'cutoff', depth: 0.4, shape: 'sine', speed: 3 },
          handle: { target: 'lfo', param: 'speed', depth: 10 },
          trigger: { row: 0 },
        },
        {
          pos: 1,
          name: 'SQUARE',
          comment: 'hard on/off stutter',
          list: [{ effect: 'SAMPLE' }, { effect: 'LOWPASS', cutoff: 1.0 }],
          lfo: { row: 1, param: 'cutoff', depth: -0.9, shape: 'square', speed: 8 },
          handle: { target: 'lfo', param: 'speed', depth: 14 },
          trigger: { row: 0 },
        },
        {
          pos: 2,
          name: 'SAW',
          comment: 'ramps open then snaps back',
          list: [{ effect: 'SAMPLE' }, { effect: 'LOWPASS', cutoff: 0.15 }],
          lfo: { row: 1, param: 'cutoff', depth: 0.85, shape: 'sawtooth', speed: 2 },
          handle: { target: 'lfo', param: 'speed', depth: 8 },
          trigger: { row: 0 },
        },
        {
          pos: 3,
          name: 'RANDOM',
          comment: 'lurches the ring modulator in and out',
          list: [{ effect: 'SAMPLE' }, { effect: 'RING', frequency: 320, mix: 0.0 }],
          lfo: { row: 1, param: 'mix', depth: 0.6, shape: 'random', speed: 7 },
          handle: { target: 'lfo', param: 'speed', depth: 10 },
          trigger: { row: 0 },
        },
      ],
    },
  },

  {
    id: 'ko-lo-fi',
    name: 'KO LO-FI',
    after: 'EP–133 K.O. II',
    blurb:
      'sampler-flavoured character. grit, tape drag and pitch, with the handle doing the job the K.O. II gives its fader — one continuous control you ride while you perform, rather than a setting you leave.',
    handle: 'is a performance fader: grit, speed or pitch depending on the slot',
    verified: false,
    config: {
      name: 'KO LO-FI',
      presets: [
        {
          pos: 0,
          name: '12 BIT',
          comment: 'crunch and a lid on the top end; squeeze for more grit',
          list: [{ effect: 'SAMPLE' }, { effect: 'DIST', amount: 8, mix: 0.55, 'lowpass-cutoff': 0.4 }],
          handle: { row: 1, param: 'amount', depth: 22 },
          trigger: { row: 0 },
        },
        {
          pos: 1,
          name: 'TAPE STOP',
          comment: 'squeeze to drag the sample to a halt',
          list: [{ effect: 'SAMPLE', speed: 1.0 }],
          handle: { row: 0, param: 'speed', depth: -0.95 },
          trigger: { row: 0 },
        },
        {
          pos: 2,
          name: 'OCTAVE DOWN',
          comment: 'a full octave of pitch under your thumb',
          list: [{ effect: 'SAMPLE', pitch: 0 }],
          handle: { row: 0, param: 'pitch', depth: -12 },
          trigger: { row: 0 },
        },
        {
          pos: 3,
          name: 'SPRING ROOM',
          comment: 'squeeze for wet; shake it for the boing',
          list: [
            { effect: 'SAMPLE' },
            { effect: 'REVERB', time: 0.4, 'wet-level': 0.25, 'dry-level': 1.0, 'spring-mix': 0.15 },
          ],
          handle: { row: 1, param: 'wet-level', depth: 0.7 },
          shake: { row: 1, param: 'spring-mix', depth: 0.6 },
          trigger: { row: 0 },
        },
      ],
    },
  },

  {
    id: 'shortwave',
    name: 'SHORTWAVE',
    after: 'TE OB–4 and the radio it came from',
    blurb:
      'a voice arriving from a long way off. SSB shifts every frequency by a fixed number of hz rather than transposing them, which is why a few hundred hz sounds like a station drifting off its mark instead of a pitch change. thin it out, echo it, put it in a hollow room.',
    handle: 'tunes the station in — or reaches through the interference',
    verified: false,
    config: {
      name: 'SHORTWAVE',
      presets: [
        {
          pos: 0,
          name: 'TUNING',
          comment: 'sitting off the station until you squeeze it in',
          list: [
            { effect: 'SAMPLE' },
            { effect: 'HIGHPASS', cutoff: 0.25 },
            { effect: 'SSB', frequency: -150 },
          ],
          // Full squeeze lands the shift on exactly 0 hz: tuned in.
          handle: { row: 2, param: 'frequency', depth: 150 },
          trigger: { row: 0 },
        },
        {
          pos: 1,
          name: 'DRIFT',
          comment: 'the station wanders; squeeze to make it wander faster',
          list: [{ effect: 'SAMPLE' }, { effect: 'SSB', frequency: 0 }],
          lfo: { row: 1, param: 'frequency', depth: 90, shape: 'sine', speed: 0.3 },
          handle: { target: 'lfo', param: 'speed', depth: 4 },
          trigger: { row: 0 },
        },
        {
          pos: 2,
          name: 'MORSE',
          comment: 'thin, telegraphic, and it repeats — squeeze for more repeats',
          list: [
            { effect: 'SAMPLE' },
            { effect: 'EQUALISER', cutoff: 0.62, q: 0.85, gain: 0.7 },
            {
              effect: 'DELAY',
              time: 0.45,
              echo: 0.6,
              'lowpass-cutoff': 0.5,
              'wet-level': 0.5,
              'dry-level': 0.9,
            },
          ],
          handle: { row: 2, param: 'echo', depth: 0.4 },
          shake: { row: 2, param: 'cross-feed', depth: 0.8 },
          trigger: { row: 0 },
        },
        {
          pos: 3,
          name: 'DEAD AIR',
          comment: 'hollow and far away; squeeze to bring the body back',
          list: [
            { effect: 'SAMPLE' },
            { effect: 'HIGHPASS', cutoff: 0.4 },
            {
              effect: 'REVERB',
              time: 0.6,
              'wet-level': 0.5,
              'dry-level': 0.4,
              'highpass-cutoff': 0.5,
            },
          ],
          handle: { row: 1, param: 'cutoff', depth: -0.4 },
          trigger: { row: 0 },
        },
      ],
    },
  },

  {
    id: 'tape-head',
    name: 'TAPE HEAD',
    after: 'OP–1',
    blurb:
      'the machine people reach for to make a voice sound like a record rather than a recording. doubling, an octave underneath, tape wow, and saturation you ride across the middle. the only pack that puts an lfo on the delay time and on the sample speed, which is where wobble actually comes from.',
    handle: 'deepens the wobble, or drags the tone across the middle',
    verified: false,
    config: {
      name: 'TAPE HEAD',
      presets: [
        {
          pos: 0,
          name: 'CHORUS',
          comment: 'a very short delay, wobbling; squeeze to wobble faster',
          list: [
            { effect: 'SAMPLE' },
            {
              effect: 'DELAY',
              time: 0.06,
              echo: 0.15,
              'cross-feed': 0.6,
              'wet-level': 0.5,
              'dry-level': 1.0,
            },
          ],
          lfo: { row: 1, param: 'time', depth: 0.04, shape: 'sine', speed: 1.2 },
          handle: { target: 'lfo', param: 'speed', depth: 6 },
          trigger: { row: 0 },
        },
        {
          pos: 1,
          name: 'SHADOW',
          comment: 'squeeze to pull a double an octave underneath you',
          list: [{ effect: 'SAMPLE' }, { effect: 'HARMONY', pitch: 1.0, 'dry-level': 0.7 }],
          // 1.0 down to exactly 0.5 — an octave, landing on the parameter floor
          // at full squeeze and not a step before it.
          handle: { row: 1, param: 'pitch', depth: -0.5 },
          trigger: { row: 0 },
        },
        {
          pos: 2,
          name: 'WOW',
          comment: 'tape that never quite runs true; squeeze for more of it',
          list: [{ effect: 'SAMPLE', speed: 1.0 }],
          lfo: { row: 0, param: 'speed', depth: 0.06, shape: 'sine', speed: 0.8 },
          // The handle deepens the wobble rather than speeding it up — the one
          // preset here where it reaches the lfo's depth instead of its rate.
          handle: { target: 'lfo', param: 'depth', depth: 0.25 },
          trigger: { row: 0 },
        },
        {
          pos: 3,
          name: 'SATURATE',
          comment: 'warm grit, and a tone control that crosses the middle as you squeeze',
          list: [
            { effect: 'SAMPLE' },
            { effect: 'DIST', amount: 5, mix: 0.7, 'lowpass-cutoff': 0.7 },
            { effect: 'EQUALISER', cutoff: 0.35, q: 0.4, gain: -0.4 },
          ],
          handle: { row: 2, param: 'gain', depth: 1.0 },
          trigger: { row: 0 },
        },
      ],
    },
  },

  {
    id: 'xy-rack',
    name: 'XY RACK',
    after: 'OP–XY',
    blurb:
      'the OP–XY publishes its six effects: chorus, delay, distortion, lofi, phaser and reverb. three of those already live elsewhere in this library, so this pack takes the ones that did not — a moving notch, a band squeezed to a telephone, repeats you can warp, and a room that grows.',
    handle: 'sweeps, narrows, warps or enlarges — one continuous studio control per slot',
    verified: false,
    config: {
      name: 'XY RACK',
      presets: [
        {
          pos: 0,
          name: 'PHASER',
          comment: 'a notch wandering up and down the voice; squeeze to sweep it faster',
          // No allpass on this mic, so a phaser is approximated by sweeping a
          // deep EQ notch — which is the part of a phaser you actually hear.
          list: [{ effect: 'SAMPLE' }, { effect: 'EQUALISER', cutoff: 0.35, q: 0.75, gain: -0.7 }],
          lfo: { row: 1, param: 'cutoff', depth: 0.4, shape: 'sine', speed: 0.7 },
          handle: { target: 'lfo', param: 'speed', depth: 5 },
          trigger: { row: 0 },
        },
        {
          pos: 1,
          name: 'LOFI',
          comment: 'squeezed from both ends into a telephone; squeeze to narrow it further',
          list: [
            { effect: 'SAMPLE' },
            { effect: 'HIGHPASS', cutoff: 0.3 },
            { effect: 'LOWPASS', cutoff: 0.45 },
            { effect: 'DIST', amount: 4, mix: 0.4 },
          ],
          handle: { row: 2, param: 'cutoff', depth: -0.35 },
          trigger: { row: 0 },
        },
        {
          pos: 2,
          name: 'PING PONG',
          comment: 'repeats thrown left to right; squeeze to stretch them and warp the pitch',
          list: [
            { effect: 'SAMPLE' },
            {
              effect: 'DELAY',
              time: 0.35,
              echo: 0.55,
              'cross-feed': 0.9,
              'wet-level': 0.55,
              'dry-level': 1.0,
            },
          ],
          handle: { row: 1, param: 'time', depth: 0.6 },
          shake: { row: 1, param: 'echo', depth: 0.4 },
          trigger: { row: 0 },
        },
        {
          pos: 3,
          name: 'ROOM GROWS',
          comment: 'a small room that opens into a hall as you squeeze',
          list: [
            { effect: 'SAMPLE' },
            {
              effect: 'REVERB',
              time: 0.2,
              'wet-level': 0.45,
              'dry-level': 1.0,
              'highpass-cutoff': 0.15,
            },
          ],
          // 0.2 to exactly 1.0: the room reaches its largest at full squeeze
          // and not a step before it.
          handle: { row: 1, param: 'time', depth: 0.8 },
          trigger: { row: 0 },
        },
      ],
    },
  },
]

export const packById = (id: string) => LIBRARY.find((p) => p.id === id)
