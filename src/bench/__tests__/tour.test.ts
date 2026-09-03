import { describe, expect, it } from 'vitest'
import { STEPS } from '../Tour'

describe('the five-step tour', () => {
  it('is five steps, each saying where on the bench it happens', () => {
    expect(STEPS).toHaveLength(5)
    for (const s of STEPS) {
      expect(s.title).toBeTruthy()
      expect(s.where).toBeTruthy()
      expect(s.body.length).toBeGreaterThan(80)
    }
  })

  it('ends with the recovery instruction, because that is the one people need most', () => {
    expect(STEPS[STEPS.length - 1].body).toMatch(/white \+ grey/)
  })
})
