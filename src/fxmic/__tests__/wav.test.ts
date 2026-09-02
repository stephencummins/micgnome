import { describe, expect, it } from 'vitest'
import { decodeWav, encodeWav, envelope, findSound, peak, resample, toMono, wavBytes, WavError } from '../wav'
import { applyEncoding, encodedBytes, fit, khz } from '../fit'
import type { Audio } from '../wav'

/** A short tone, so round trips have something to be wrong about. */
function tone(seconds = 0.1, sampleRate = 44100, channelCount = 1): Audio {
  const frames = Math.round(seconds * sampleRate)
  const channels = Array.from({ length: channelCount }, (_, ch) => {
    const out = new Float32Array(frames)
    for (let i = 0; i < frames; i++) out[i] = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * (ch ? 0.5 : 0.9)
    return out
  })
  return { sampleRate, channels }
}

describe('wav round trips', () => {
  for (const depth of [8, 16, 24, 32] as const) {
    it(`survives ${depth}-bit`, () => {
      const source = tone()
      const { audio, format } = decodeWav(encodeWav(source, depth))
      expect(format.bitDepth).toBe(depth)
      expect(format.sampleRate).toBe(44100)
      expect(format.channelCount).toBe(1)
      expect(audio.channels[0].length).toBe(source.channels[0].length)
      // 8-bit is coarse by definition; the rest should be close.
      const tolerance = depth === 8 ? 0.02 : 0.001
      for (let i = 0; i < source.channels[0].length; i += 97) {
        expect(Math.abs(audio.channels[0][i] - source.channels[0][i])).toBeLessThan(tolerance)
      }
    })
  }

  it('survives 32-bit float', () => {
    const source = tone()
    const { audio, format } = decodeWav(encodeWav(source, 32, true))
    expect(format.float).toBe(true)
    expect(audio.channels[0][100]).toBeCloseTo(source.channels[0][100], 6)
  })

  it('keeps both channels of a stereo file distinct', () => {
    const { audio, format } = decodeWav(encodeWav(tone(0.05, 44100, 2), 16))
    expect(format.channelCount).toBe(2)
    expect(peak(audio)).toBeGreaterThan(0.8)
    expect(Math.abs(audio.channels[1][200])).toBeLessThan(Math.abs(audio.channels[0][200]))
  })

  it('reports the byte size it will actually write', () => {
    const encoded = encodeWav(tone(0.1), 16)
    expect(encoded.byteLength).toBe(wavBytes(4410, 1, 16))
  })
})

describe('wav that will not do', () => {
  it('refuses a file that is not a wav', () => {
    expect(() => decodeWav(new TextEncoder().encode('ID3 this is an mp3'))).toThrow(WavError)
  })

  it('explains a compressed wav rather than producing noise', () => {
    const bytes = encodeWav(tone(0.01), 16)
    new DataView(bytes.buffer).setUint16(20, 85, true) // MPEG layer 3 in a wav wrapper
    expect(() => decodeWav(bytes)).toThrow(/uncompressed PCM only/)
  })

  it('reads a file with extra chunks between fmt and data', () => {
    const original = encodeWav(tone(0.02), 16)
    // Splice a LIST chunk in, the way a real exporter would.
    const list = new Uint8Array(12)
    new TextEncoder().encodeInto('LIST', list)
    new DataView(list.buffer).setUint32(4, 4, true)
    new TextEncoder().encodeInto('INFO', list.subarray(8))
    const spliced = new Uint8Array(original.byteLength + list.byteLength)
    spliced.set(original.subarray(0, 36))
    spliced.set(list, 36)
    spliced.set(original.subarray(36), 36 + list.byteLength)
    expect(decodeWav(spliced).format.frames).toBe(decodeWav(original).format.frames)
  })
})

describe('transforms', () => {
  it('halves the data when going to mono', () => {
    const mono = toMono(tone(0.1, 44100, 2))
    expect(mono.channels).toHaveLength(1)
    expect(encodeWav(mono, 16).byteLength).toBeLessThan(encodeWav(tone(0.1, 44100, 2), 16).byteLength / 1.9)
  })

  it('resamples to the requested rate and roughly the right length', () => {
    const out = resample(tone(1, 44100), 22050)
    expect(out.sampleRate).toBe(22050)
    expect(out.channels[0].length).toBe(22050)
  })

  it('finds the sound inside leading and trailing silence', () => {
    const sampleRate = 44100
    const frames = sampleRate
    const channel = new Float32Array(frames)
    for (let i = 20000; i < 25000; i++) channel[i] = 0.8
    const { start, end } = findSound({ sampleRate, channels: [channel] })
    expect(start).toBeLessThanOrEqual(20000)
    expect(start).toBeGreaterThan(19000)
    expect(end).toBeGreaterThanOrEqual(25000)
    expect(end).toBeLessThan(26000)
  })

  it('does not trim a file that is quiet all the way through to nothing', () => {
    const channel = new Float32Array(1000) // pure silence
    const { start, end } = findSound({ sampleRate: 44100, channels: [channel] })
    expect(start).toBe(0)
    expect(end).toBe(1000)
  })

  it('draws an envelope with the peak in the right place', () => {
    const channel = new Float32Array(1000)
    for (let i = 500; i < 600; i++) channel[i] = 1
    const shape = envelope({ sampleRate: 44100, channels: [channel] }, 10)
    expect(shape).toHaveLength(10)
    expect(shape[5]).toBeCloseTo(1)
    expect(shape[0]).toBe(0)
  })
})

describe('reading rates back', () => {
  it('writes rates the way people say them', () => {
    expect(khz(44100)).toBe('44.1 khz')
    expect(khz(48000)).toBe('48 khz')
    expect(khz(22050)).toBe('22.05 khz')
    expect(khz(8000)).toBe('8 khz')
  })
})

describe('the fitter', () => {
  const big = () => tone(6, 48000, 2) // ~1.1 mb at 16-bit stereo

  it('leaves everything alone when it already fits', () => {
    const plan = fit([{ id: 'a.wav', audio: tone(0.1) }])
    expect(plan.fits).toBe(true)
    expect(plan.slots[0].notes).toEqual([])
    expect(plan.summary).toMatch(/nothing to trade/i)
  })

  it('gets four long stereo sounds into 1 mb and says what it traded', () => {
    const plan = fit([
      { id: 'horn.wav', audio: big() },
      { id: 'gull.wav', audio: big() },
      { id: 'bell.wav', audio: big() },
      { id: 'beep.wav', audio: big() },
    ])
    expect(plan.fits).toBe(true)
    expect(plan.totalBytes).toBeLessThanOrEqual(plan.budget)
    expect(plan.summary).toMatch(/khz|mono|bit/)
    for (const slot of plan.slots) expect(slot.notes.length).toBeGreaterThan(0)
  })

  it('concedes the cheapest thing first — mono before sample rate', () => {
    const plan = fit([{ id: 'a.wav', audio: big() }], 700_000)
    expect(plan.slots[0].notes[0]).toBe('stereo → mono')
  })

  it('protects the slot you said matters and takes it out of the others', () => {
    const plan = fit([
      { id: 'keep.wav', audio: big(), priority: 1 },
      { id: 'spend.wav', audio: big() },
    ])
    expect(plan.fits).toBe(true)
    expect(plan.slots[1].notes.length).toBeGreaterThan(plan.slots[0].notes.length)
  })

  it('reserves room for config.json', () => {
    const plan = fit([{ id: 'a.wav', audio: big() }], 1024 * 1024, 400_000)
    expect(plan.budget).toBe(1024 * 1024 - 400_000)
    expect(plan.totalBytes).toBeLessThanOrEqual(plan.budget)
  })

  it('says so rather than pretending when nothing will fit', () => {
    const plan = fit([{ id: 'a.wav', audio: big() }], 200)
    expect(plan.fits).toBe(false)
    expect(plan.summary).toMatch(/over — remove a sample/)
  })

  it('predicts the byte size of what it will actually write', () => {
    const audio = big()
    const plan = fit([{ id: 'a.wav', audio }], 300_000)
    const encoding = plan.slots[0].encoding
    const actual = encodeWav(applyEncoding(audio, encoding), encoding.bitDepth, encoding.float)
    // The prediction is what the budget meter shows, so it has to be right.
    expect(Math.abs(actual.byteLength - encodedBytes(audio, encoding))).toBeLessThan(64)
  })
})
