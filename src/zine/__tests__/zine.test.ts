import { describe, expect, it } from 'vitest'
import { BOOKLET_PAGE_COUNT, KOFI, RULES, renderBooklet, renderZine } from '../zine'
import { AMBIGUOUS, EFFECTS, FACTORY_SOUNDS, FIELD_REPORTS, LFO_SHAPES, PLAYMODES } from '../../fxmic/spec'

/**
 * The manual is only worth printing if it cannot disagree with the validator.
 * These are the tests that keep that true: everything in the spec has to reach
 * the page, so adding a block or a parameter and forgetting the manual is a
 * failing build rather than a wrong sheet of paper in somebody's mic case.
 */
const unescape_ = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')

describe('the printable manual', () => {
  const html = renderZine()

  it('prints every block, with every parameter and its range', () => {
    for (const effect of EFFECTS) {
      expect(html, effect.name).toContain(`>${effect.name}`)
      for (const param of effect.params) {
        expect(html, `${effect.name}.${param.name}`).toContain(`>${param.name}</td>`)
        expect(html, `${effect.name}.${param.name} range`).toContain(
          `${param.min} &ndash; ${param.max}`,
        )
      }
    }
  })

  it('marks the blocks that may only be used once, and the ones TE never documented', () => {
    for (const effect of EFFECTS.filter((e) => e.oncePerChain)) {
      expect(html).toContain(effect.name)
    }
    expect(html).toContain('once per chain')
    expect(html).toContain('not in the guide')
  })

  it('carries every ambiguity and every field report, with its source', () => {
    // Compared against the unescaped page, so the assertion is the whole
    // sentence rather than whatever prefix survives entity encoding.
    const text = unescape_(html)
    for (const note of Object.values(AMBIGUOUS)) expect(text).toContain(note)
    for (const report of Object.values(FIELD_REPORTS)) {
      expect(text).toContain(report.what)
      expect(text).toContain(report.where)
    }
  })

  it('lists the shapes and playmodes rather than hardcoding them', () => {
    for (const shape of LFO_SHAPES) expect(html).toContain(shape)
    for (const mode of PLAYMODES) expect(html).toContain(mode)
  })

  it('leads with the recovery instruction, which is the thing to find in a panic', () => {
    const recovery = html.indexOf('If the mic will not start')
    expect(recovery).toBeGreaterThan(0)
    expect(recovery).toBeLessThan(html.indexOf('the shape of the file'))
  })

  it('is a self-contained page — nothing to fetch, so it prints offline', () => {
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<link[^>]+stylesheet/i)
    expect(html).not.toMatch(/src=["']http/i)
  })
})

describe('the booklet', () => {
  const html = renderBooklet()
  const pages = html.split('<section class="page">').length - 1

  it('has a page count saddle stitch can actually bind', () => {
    // Not a style point: a folded sheet is four pages, so a printer either gets
    // a multiple of four or pads the back with blanks you did not design.
    expect(BOOKLET_PAGE_COUNT % 4, `${BOOKLET_PAGE_COUNT} pages`).toBe(0)
    expect(pages).toBe(BOOKLET_PAGE_COUNT)
  })

  it('loses no block and no rule in the split across pages', () => {
    // The booklet distributes the blocks and rules by hand. Forgetting one in a
    // slice is invisible on screen and permanent once printed.
    for (const effect of EFFECTS) expect(html, effect.name).toContain(`>${effect.name}`)
    for (const rule of RULES) expect(html, rule.title).toContain(rule.title)
  })

  it('opens on the cover and gets the recovery note onto page two', () => {
    const cover = html.indexOf('class="cover"')
    const recovery = html.indexOf('If the mic will not start')
    expect(cover).toBeGreaterThan(0)
    expect(recovery).toBeGreaterThan(cover)
    // Nothing may come between them: in a panic this is the only page that matters.
    expect(html.slice(cover, recovery).split('<section class="page">').length - 1).toBe(1)
  })

  it('is print-order, not printer spreads', () => {
    // Imposition is the printer's job. Doing it here is a mistake nobody sees
    // until the box arrives, so the folios must simply run 2, 3, 4 ...
    const folios = [...html.matchAll(/<div class="folio">(\d+)<\/div>/g)].map((m) => Number(m[1]))
    expect(folios).toEqual(Array.from({ length: BOOKLET_PAGE_COUNT - 1 }, (_, i) => i + 2))
  })

  it('carries the tip jar, and the same one the bench uses', () => {
    expect(html).toContain(KOFI)
    expect(renderZine()).toContain(KOFI)
    expect(KOFI).toBe('https://ko-fi.com/stejcu')
  })

  it('carries the two warnings that are about a person, not a file', () => {
    // The recovery note saves the mic; the line-out note saves the reader's
    // hearing. Both are the guide's own words and both belong up front.
    expect(html).toContain('If the mic will not start')
    expect(html).toContain('very loud')
    const ear = html.indexOf('very loud')
    expect(ear).toBeLessThan(html.indexOf('the blocks'))
  })

  it('names the three buttons and the four sounds already in the mic', () => {
    for (const sound of FACTORY_SOUNDS) expect(html).toContain(sound)
    expect(html).toContain('no effect and the four preset slots')
  })

  it('is self-contained, so it prints from a folder with no network', () => {
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<link[^>]+stylesheet/i)
    expect(html).not.toMatch(/src=["\']http/i)
  })
})
