import { describe, expect, it } from 'vitest'
import { decodePack, encodePack, shareUrl } from '../share'
import { parseConfig } from '../../fxmic/parse'
import { LIBRARY } from '../../packs/library'

describe('a pack as a link', () => {
  it('round-trips every library pack through the fragment', async () => {
    for (const pack of LIBRARY) {
      const fragment = await encodePack(pack.config)
      const json = await decodePack('#' + fragment)
      expect(json).toBeDefined()
      const parsed = parseConfig(json!)
      expect(parsed.repairs).toHaveLength(0)
      expect(parsed.value).toEqual(pack.config)
    }
  })

  it('stays short enough to paste anywhere', async () => {
    for (const pack of LIBRARY) {
      const url = shareUrl(await encodePack(pack.config), 'https://micgnome.stephen8n.com/')
      expect(url.length).toBeLessThan(2000)
      expect(url).toMatch(/^https:\/\/micgnome\.stephen8n\.com\/#p=[A-Za-z0-9_-]+$/)
    }
  })

  it('ignores fragments that are not a pack', async () => {
    expect(await decodePack('')).toBeUndefined()
    expect(await decodePack('#chain')).toBeUndefined()
    expect(await decodePack('#p=not base64 at all!!')).toBeUndefined()
    expect(await decodePack('#p=AAAA')).toBeUndefined()
  })
})
