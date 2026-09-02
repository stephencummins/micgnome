import { describe, expect, it } from 'vitest'
import { CONFIG_NAME, DiskFullError, MicDisk } from '../disk'
import { blankConfig, serialize } from '../serialize'
import { encode } from '../store'

const GOOD = serialize(blankConfig('PIER AT NIGHT'))
const BRICKED = '{ "name": "OOPS", "presets": [ { "list": [ { "effect": "SAMPLE" } ] }, ] }'

describe('the virtual fx-mic', () => {
  it('boots the factory sounds when there is no config at all', async () => {
    const mic = MicDisk.inMemory()
    const result = await mic.eject()
    expect(result.booted).toBe(true)
    expect(result.packName).toBe('factory')
  })

  it('loads a good pack and reports its name', async () => {
    const mic = MicDisk.inMemory()
    await mic.write(CONFIG_NAME, GOOD)
    const result = await mic.eject()
    expect(result.booted).toBe(true)
    expect(result.packName).toBe('PIER AT NIGHT')
    expect(result.report?.ok).toBe(true)
  })

  // The test this whole product exists for.
  it('does not come back from a trailing comma, and says how to recover', async () => {
    const mic = MicDisk.inMemory()
    await mic.write(CONFIG_NAME, BRICKED)
    const result = await mic.eject()

    expect(result.booted).toBe(false)
    expect(result.state).toBe('frozen')
    expect(result.recovery).toContain('white + grey')
    expect(mic.getState()).toBe('frozen')
  })

  it('stays frozen for a file that only opens after repairs — the firmware cannot repair', async () => {
    const mic = MicDisk.inMemory()
    await mic.write(CONFIG_NAME, '{ "presets": [ /* nearly */ { "list": [] } ] }')
    const result = await mic.eject()
    expect(result.booted).toBe(false)
    expect(result.reason).toMatch(/comment/i)
  })

  it('still boots a config that is valid JSON but bad music', async () => {
    // The guide says syntax stops the unit starting. It does not say an
    // out-of-range value does, so we do not pretend to know that it does.
    const mic = MicDisk.inMemory()
    await mic.write(CONFIG_NAME, '{ "name": "LOUD", "presets": [ { "list": [ { "effect": "DIST", "amount": 400 } ] } ] }')
    const result = await mic.eject()
    expect(result.booted).toBe(true)
    expect(result.report?.ok).toBe(false)
    expect(result.report?.diagnostics.map((d) => d.code)).toContain('param-out-of-range')
  })

  it('comes back after holding white + grey', async () => {
    const mic = MicDisk.inMemory()
    await mic.write(CONFIG_NAME, BRICKED)
    await mic.eject()
    expect(mic.getState()).toBe('frozen')

    await mic.recover()
    expect(mic.getState()).toBe('idle')
    // The disk is still readable while frozen — that is the whole point of the trick.
    expect(await mic.readText(CONFIG_NAME)).toBe(BRICKED)
  })
})

describe('the 1 mb ceiling', () => {
  it('refuses a file that does not fit rather than truncating it', async () => {
    const mic = MicDisk.inMemory({ capacityBytes: 1024 })
    await expect(mic.write('big.wav', new Uint8Array(2048))).rejects.toBeInstanceOf(DiskFullError)
    expect(await mic.files()).toEqual([])
  })

  it('counts the file it is replacing as free space', async () => {
    const mic = MicDisk.inMemory({ capacityBytes: 1024 })
    await mic.write('a.wav', new Uint8Array(1000))
    // Replacing a 1000-byte file with another 1000-byte file must fit.
    await expect(mic.write('a.wav', new Uint8Array(1000))).resolves.toBeUndefined()
    expect(await mic.used()).toBe(1000)
  })

  it('reports what is used and what is left', async () => {
    const mic = MicDisk.inMemory({ capacityBytes: 1024 })
    await mic.write('a.wav', new Uint8Array(400))
    expect(await mic.used()).toBe(400)
    expect(await mic.free()).toBe(624)
  })

  it('says how much to free up, in the message', async () => {
    const mic = MicDisk.inMemory({ capacityBytes: 1024 })
    const error = await mic
      .write('big.wav', new Uint8Array(4096))
      .then(() => undefined)
      .catch((e: unknown) => e as DiskFullError)
    expect(error?.message).toMatch(/4 kb needed, 1 kb free/)
    expect(error?.message).toMatch(/mono|sample rate/)
  })
})

describe('put it back how it was', () => {
  it('restores a bricking write from a snapshot taken first', async () => {
    const mic = MicDisk.inMemory()
    await mic.write(CONFIG_NAME, GOOD)
    await mic.write('horn.wav', encode('RIFF....'))
    const before = await mic.snapshot()

    await mic.write(CONFIG_NAME, BRICKED)
    await mic.remove('horn.wav')
    expect((await mic.eject()).booted).toBe(false)

    await mic.restore(before)
    await mic.recover()

    const result = await mic.eject()
    expect(result.booted).toBe(true)
    expect(result.packName).toBe('PIER AT NIGHT')
    expect((await mic.files()).map((f) => f.name)).toEqual([CONFIG_NAME, 'horn.wav'])
  })

  it('removes files the snapshot did not have', async () => {
    const mic = MicDisk.inMemory()
    const empty = await mic.snapshot()
    await mic.write('stray.wav', new Uint8Array(10))
    await mic.restore(empty)
    expect(await mic.files()).toEqual([])
  })
})

describe('a real disk', () => {
  it('does not pretend to reboot', async () => {
    // simulateBoot is off for real hardware: ejecting writes, the mic does the rest.
    const mic = new MicDisk(new (await import('../store')).MemoryStore(), { simulateBoot: false })
    await mic.write(CONFIG_NAME, BRICKED)
    const result = await mic.eject()
    expect(result.booted).toBe(true)
    expect(result.state).toBe('idle')
  })
})
