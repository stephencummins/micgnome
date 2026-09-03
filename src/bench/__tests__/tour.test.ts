import { describe, expect, it } from 'vitest'
import { STEPS } from '../Tour'

describe('the tour', () => {
  it('is six steps, each saying where on the bench it happens', () => {
    expect(STEPS).toHaveLength(6)
    for (const s of STEPS) {
      expect(s.title).toBeTruthy()
      expect(s.where).toBeTruthy()
      expect(s.body.length).toBeGreaterThan(120)
    }
  })

  it('ends with the recovery instruction, because that is the one people need most', () => {
    expect(STEPS[STEPS.length - 1].body).toMatch(/white \+ grey/)
  })

  it('tells people how the file reaches the mic — the cable and the disk, not a button', () => {
    const last = STEPS[STEPS.length - 1].body
    expect(last).toMatch(/usb-c/)
    expect(last).toMatch(/fx-mic disk/)
    expect(last).toMatch(/eject/)
  })
})
