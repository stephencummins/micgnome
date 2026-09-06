import { describe, expect, it } from 'vitest'
import { STEPS, TILE_GLYPHS, PICTURES } from '../Tour'

describe('the tour', () => {
  it('is eight steps, each saying where on the bench it happens', () => {
    expect(STEPS).toHaveLength(8)
    for (const s of STEPS) {
      expect(s.title).toBeTruthy()
      expect(s.where).toBeTruthy()
      expect(s.body.length).toBeGreaterThan(120)
    }
  })

  it('the mic step carries the recovery instruction, because that is the one people need most', () => {
    expect(STEPS[6].body).toMatch(/white \+ grey/)
  })

  it('tells people how the file reaches the mic — the cable and the disk, not a button', () => {
    const last = STEPS[6].body
    expect(last).toMatch(/usb-c/)
    expect(last).toMatch(/fx-mic disk/)
    expect(last).toMatch(/eject/)
  })
})

describe('the way in, for someone who does not want to build anything', () => {
  it('opens with the gnome, because that is the shortest route to a sound', () => {
    expect(STEPS[0].title).toContain('gnome')
    expect(STEPS[0].where).toContain('gnome')
  })

  it('promises he changes nothing without being told to', () => {
    expect(STEPS[0].body).toMatch(/apply/)
  })

  it('points at listen where it explains the chain, so a chain can be heard as it is read', () => {
    expect(STEPS[2].body).toMatch(/listen/)
  })

  it('has a tile and a drawing for every step, or the guide renders a hole', () => {
    expect(TILE_GLYPHS).toHaveLength(STEPS.length)
    expect(PICTURES).toHaveLength(STEPS.length)
  })
})
