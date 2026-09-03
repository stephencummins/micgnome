import { describe, expect, it } from 'vitest'
import { submitUrl, REPO } from '../submit'
import { LIBRARY } from '../../packs/library'

describe('sending a pack in', () => {
  it('opens a new issue on the repo with the pack name as the title', () => {
    const url = new URL(submitUrl(LIBRARY[0].config, 'https://example.test/#x'))
    expect(url.href.startsWith(`${REPO}/issues/new?`)).toBe(true)
    expect(url.searchParams.get('title')).toBe('pack: PUNCH IN')
    expect(url.searchParams.get('labels')).toBe('pack')
  })

  it('carries the share link and, when it fits, the json too', () => {
    const body = new URL(submitUrl(LIBRARY[0].config, 'https://example.test/#x')).searchParams.get('body')!
    expect(body).toContain('https://example.test/#x')
    expect(body).toContain('"name": "PUNCH IN"')
  })

  it('drops the json rather than the link when the pack is too big for a url', () => {
    const big = { ...LIBRARY[0].config, presets: LIBRARY[0].config.presets.map((p) => ({ ...p, comment: 'x'.repeat(2000) })) }
    const body = new URL(submitUrl(big, 'https://example.test/#x')).searchParams.get('body')!
    expect(body).toContain('https://example.test/#x')
    expect(body).not.toContain('```json')
  })
})
