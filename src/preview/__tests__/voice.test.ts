import { describe, expect, it } from 'vitest'
import { FORMANT_LEVELS, VOWELS, phrase } from '../voice'
import type { VoiceMode } from '../voice'

const MODES: VoiceMode[] = ['singing', 'spoken']

// The voice is synthetic and says so. These tests are about it staying
// voice-*shaped* — formants where a mouth puts them, syllables a delay can
// repeat — not about it fooling anybody.

describe('the vowels', () => {
  it('puts the three formants in ascending order, which is what makes it a vowel', () => {
    for (const [name, shape] of Object.entries(VOWELS)) {
      expect(shape.f[0], `${name} F1`).toBeLessThan(shape.f[1])
      expect(shape.f[1], `${name} F2`).toBeLessThan(shape.f[2])
    }
  })

  it('keeps every formant inside the range a voice occupies', () => {
    for (const [name, shape] of Object.entries(VOWELS)) {
      for (const f of shape.f) {
        expect(f, name).toBeGreaterThan(200)
        expect(f, name).toBeLessThan(4_000)
      }
    }
  })

  it('gives each formant a bandwidth narrow enough to ring and wide enough to speak', () => {
    for (const [name, shape] of Object.entries(VOWELS)) {
      shape.bw.forEach((bw, i) => {
        const q = shape.f[i] / bw
        expect(q, `${name} F${i + 1}`).toBeGreaterThan(2)
        expect(q, `${name} F${i + 1}`).toBeLessThan(40)
      })
    }
  })

  it('sits the higher formants behind the first, as a real one does', () => {
    expect(FORMANT_LEVELS[0]).toBe(1)
    expect(FORMANT_LEVELS[1]).toBeLessThan(FORMANT_LEVELS[0])
    expect(FORMANT_LEVELS[2]).toBeLessThan(FORMANT_LEVELS[1])
  })
})

describe('the phrase, whichever voice is asked for', () => {
  it('only ever asks for a vowel the synthesiser knows', () => {
    for (const mode of MODES) {
      for (const s of phrase(mode).syllables) expect(VOWELS[s.vowel], `${mode}/${s.vowel}`).toBeDefined()
    }
  })

  it('never overlaps two syllables, because one mouth cannot', () => {
    for (const mode of MODES) {
      const { syllables } = phrase(mode)
      syllables.forEach((s, i) => {
        const next = syllables[i + 1]
        if (next) expect(s.at + s.seconds, mode).toBeLessThanOrEqual(next.at)
      })
    }
  })

  it('leaves a gap at the end so the loop does not join up mid-word', () => {
    for (const mode of MODES) {
      const { syllables, seconds } = phrase(mode)
      const last = syllables[syllables.length - 1]
      expect(seconds - (last.at + last.seconds), mode).toBeGreaterThan(0.2)
    }
  })

  it('stays in a range a person could sing, rather than a range only a dog hears', () => {
    for (const mode of MODES) {
      for (const s of phrase(mode).syllables) {
        expect(s.hz, mode).toBeGreaterThan(80)
        expect(s.hz, mode).toBeLessThan(500)
      }
    }
  })

  it('keeps every syllable audible and none of them louder than full', () => {
    for (const mode of MODES) {
      for (const s of phrase(mode).syllables) {
        expect(s.level, mode).toBeGreaterThan(0)
        expect(s.level, mode).toBeLessThanOrEqual(1)
      }
    }
  })

  it('loops soon enough to be a preview and not a performance', () => {
    for (const mode of MODES) {
      expect(phrase(mode).seconds, mode).toBeLessThan(12)
      expect(phrase(mode).seconds, mode).toBeGreaterThan(2)
    }
  })

  it('is the same every time, so two settings can be compared honestly', () => {
    // The whole reason the made-up voice is the default over a real one.
    for (const mode of MODES) expect(phrase(mode)).toEqual(phrase(mode))
  })
})

describe('the two voices differ in the way that matters', () => {
  it('holds notes when singing, so a reverb tail has something to ring on', () => {
    const sung = phrase('singing').syllables
    const said = phrase('spoken').syllables
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    expect(mean(sung.map((s) => s.seconds))).toBeGreaterThan(mean(said.map((s) => s.seconds)) * 2)
  })

  it('gives speech its consonants and its uneven stress, which is where a delay shows itself', () => {
    const said = phrase('spoken').syllables
    expect(said.some((s) => s.consonant)).toBe(true)
    expect(new Set(said.map((s) => s.level)).size).toBeGreaterThan(1)
    expect(phrase('singing').syllables.every((s) => !s.consonant)).toBe(true)
  })
})
