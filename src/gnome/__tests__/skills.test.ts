import { describe, expect, it } from 'vitest'
import { GROUNDING_IN_USE, SKILLS, SKILL_IDS, routeSkill } from '../skills'
import { buildGrounding } from '../grounding'
import { buildSystemPrompt, describeBench } from '../prompt'
import { AMBIGUOUS, EFFECTS, FIELD_REPORTS, LFO_SHAPES, LIMITS } from '../../fxmic/spec'
import { LIBRARY } from '../../packs/library'
import { blankConfig } from '../../fxmic/serialize'
import type { BenchState } from '../../bench/state'

const state = (): BenchState => ({
  config: { ...blankConfig('TEST PACK'), presets: [{ pos: 0, name: 'ONE', list: [{ effect: 'SAMPLE' }], trigger: { row: 0 } }] },
  selected: 0,
  handle: 0,
  dirty: false,
})

const everything = buildGrounding(GROUNDING_IN_USE)

// The drift guard, copied from the zine's. Adding something to the spec and
// forgetting to tell the gnome about it should fail the build, not degrade the
// answers quietly six months from now.

describe('everything in the spec reaches the gnome', () => {
  it('names every block, with its blurb', () => {
    for (const effect of EFFECTS) {
      expect(everything, effect.name).toContain(effect.name)
      expect(everything, effect.name).toContain(effect.blurb)
    }
  })

  it('names every parameter of every block, so it cannot invent one', () => {
    for (const effect of EFFECTS) {
      for (const param of effect.params) {
        expect(everything, `${effect.name}.${param.name}`).toContain(param.name)
      }
    }
  })

  it('carries every place the guide is silent, so it does not answer with false certainty', () => {
    for (const note of Object.values(AMBIGUOUS)) expect(everything).toContain(note)
  })

  it('carries every field report, so player claims stay attributed', () => {
    for (const report of Object.values(FIELD_REPORTS)) expect(everything).toContain(report.what)
  })

  it('names every pack in the library', () => {
    for (const pack of LIBRARY) {
      expect(everything, pack.name).toContain(pack.name)
      expect(everything, pack.name).toContain(pack.blurb)
    }
  })

  it('carries the shapes and the hard limits', () => {
    for (const shape of LFO_SHAPES) expect(everything).toContain(shape)
    expect(everything).toContain(String(LIMITS.maxRowsPerPreset))
  })

  it('tells it audio falls downwards, which is the most misunderstood thing about the mic', () => {
    expect(everything).toContain('BELOW it, never above')
  })
})

describe('the skills themselves', () => {
  it('has one entry per declared id, and no duplicates', () => {
    expect(SKILLS.map((s) => s.id).sort()).toEqual([...SKILL_IDS].sort())
  })

  it('gives every skill something to say and something to do', () => {
    for (const skill of SKILLS) {
      expect(skill.opening.length, skill.id).toBeGreaterThan(20)
      expect(skill.steps.length, skill.id).toBeGreaterThan(2)
      expect(skill.grounding.length, skill.id).toBeGreaterThan(0)
      expect(skill.cues.length, skill.id).toBeGreaterThan(2)
    }
  })

  it('asks for only the grounding it needs, or the allowance goes by lunchtime', () => {
    // Every skill taking everything would defeat the point of slicing at all.
    const all = new Set(GROUNDING_IN_USE)
    expect(SKILLS.some((s) => s.grounding.length < all.size)).toBe(true)
  })
})

describe('choosing a skill for what was typed', () => {
  it('hears a request to build something', () => {
    expect(routeSkill('I want to sound like a robot').id).toBe('from-scratch')
  })

  it('hears a request for a suggestion from the library', () => {
    expect(routeSkill('show me some packs').id).toBe('pick-a-pack')
  })

  it('hears a question', () => {
    expect(routeSkill('what does RING do?').id).toBe('explain')
  })

  it('hears trouble', () => {
    expect(routeSkill('there is no sound coming out').id).toBe('fix')
  })

  it('hears someone ready to use their mic', () => {
    expect(routeSkill('how do I get this onto my mic').id).toBe('to-the-mic')
  })

  it('stays where the conversation already is when nothing matches', () => {
    expect(routeSkill('yes please', 'from-scratch').id).toBe('from-scratch')
  })

  it('starts a newcomer at the library, which is the best first answer', () => {
    expect(routeSkill('hello').id).toBe('pick-a-pack')
  })
})

describe('what the model is told about the bench', () => {
  it('shows the chain with rows numbered from zero, the way actions count them', () => {
    const text = describeBench(state())
    expect(text).toContain('0: SAMPLE')
  })

  it('marks which preset is being edited, so an edit lands where the person is looking', () => {
    expect(describeBench(state())).toContain('they are editing')
  })

  it('says plainly when nothing moves, rather than leaving it unmentioned', () => {
    const bare = state()
    bare.config.presets[0] = { pos: 0, name: 'ONE', list: [{ effect: 'DIST' }] }
    expect(describeBench(bare)).toContain('nothing moves')
  })

  it('builds a prompt that carries the voice, the skill and the bench together', () => {
    const prompt = buildSystemPrompt(SKILLS[0], state())
    expect(prompt).toContain('Mic Gnome')
    expect(prompt).toContain(SKILLS[0].steps[0])
    expect(prompt).toContain('ON THE BENCH RIGHT NOW')
    // The honesty rules are not optional, whichever skill is running.
    expect(prompt).toContain('tested on real hardware')
  })
})
