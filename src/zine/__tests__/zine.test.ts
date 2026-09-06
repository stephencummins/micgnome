import { describe, expect, it } from 'vitest'
import { BOOKLET_PAGE_COUNT, BOOKLET_RULES_ON_PAGE_6, KOFI, RULES, renderBooklet, renderZine } from '../zine'
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

describe('the booklet still fits on the paper', () => {
  /**
   * The booklet declares its pages instead of flowing them, which is the only
   * way to promise a printer a count divisible by four. The cost is that
   * nothing warns you when a page outgrows 5.5 x 8.5in — it simply prints off
   * the bottom edge, and on 2026-09-06 it did: adding a third field report
   * pushed the last page past the trim and nobody noticed until it was live.
   *
   * These numbers were measured in a browser at the sizes below, where the
   * tightest page had about 86px of a 816px page to spare. They are the inputs
   * that grow. If one of them trips, the fix is not to raise the number here —
   * it is to open /zine-booklet, measure every page again, and rebalance.
   */
  const MEASURED = { rules: 9, ambiguities: 7, reports: 3, blocks: 11 }

  it('carries no more of each growing thing than was measured to fit', () => {
    expect(RULES.length, 'rules').toBeLessThanOrEqual(MEASURED.rules)
    expect(Object.keys(AMBIGUOUS).length, 'ambiguities').toBeLessThanOrEqual(MEASURED.ambiguities)
    expect(Object.keys(FIELD_REPORTS).length, 'field reports').toBeLessThanOrEqual(MEASURED.reports)
    expect(EFFECTS.length, 'blocks').toBeLessThanOrEqual(MEASURED.blocks)
  })

  it('splits the rules across two pages, since one page cannot hold them beside the gaps', () => {
    expect(BOOKLET_RULES_ON_PAGE_6).toBeGreaterThan(0)
    expect(BOOKLET_RULES_ON_PAGE_6).toBeLessThan(RULES.length)
  })

  it('gives the booklet the short form of each source, and the sheet the full one', () => {
    // A 5.5in page has no room for the full provenance, and someone with the lid
    // off their mic does not want it there.
    // Both are read de-escaped: the renderer turns quotes into entities, and the
    // reports are full of quoted key names.
    const booklet = unescape_(renderBooklet())
    const sheet = unescape_(renderZine())
    for (const report of Object.values(FIELD_REPORTS)) {
      expect(booklet, 'booklet carries the short form').toContain(report.short)
      expect(sheet, 'the sheet carries the whole account').toContain(report.what)
    }
  })
})
