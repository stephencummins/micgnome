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
]

export const packById = (id: string) => LIBRARY.find((p) => p.id === id)
