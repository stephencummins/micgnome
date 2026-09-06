import { describe, expect, it } from 'vitest'
import { MAX_ACTIONS, PROPOSABLE, extractJson, parseAction, parseReply } from '../protocol'

// The model answering these is small, free, and shared with every other visitor
// on the site. It will return junk sometimes. Junk has to be inert.

describe('reading what the model sent back', () => {
  it('accepts the plain JSON object it was asked for', () => {
    const out = parseReply('{"say":"Try KO LO-FI."}')
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.reply.say).toBe('Try KO LO-FI.')
  })

  it('forgives a fenced code block, because models add them unbidden', () => {
    expect(extractJson('```json\n{"say":"hello"}\n```')).toEqual({ say: 'hello' })
  })

  it('forgives a sentence in front of the JSON, and takes the object', () => {
    expect(extractJson('Sure! Here you go:\n{"say":"hello"}')).toEqual({ say: 'hello' })
  })

  it('refuses a reply with nothing to say, rather than showing an empty bubble', () => {
    expect(parseReply('{"actions":[]}').ok).toBe(false)
    expect(parseReply('{"say":"   "}').ok).toBe(false)
  })

  it('refuses prose that is not JSON at all', () => {
    expect(parseReply('I think you should add a reverb.').ok).toBe(false)
  })

  it('drops an empty actions array rather than offering an Apply button that does nothing', () => {
    const out = parseReply('{"say":"Just talking.","actions":[]}')
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.reply.actions).toBeUndefined()
  })

  it('refuses a reply proposing more edits than a person could agree to', () => {
    const actions = Array.from({ length: MAX_ACTIONS + 1 }, () => ({ type: 'add-preset' }))
    const out = parseReply(JSON.stringify({ say: 'ok', actions }))
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain('Too many actions')
  })

  it('keeps at most three suggestions, however many it was given', () => {
    const out = parseReply(JSON.stringify({ say: 'ok', suggest: ['a', 'b', 'c', 'd', 'e'] }))
    expect(out.ok).toBe(true)
    if (out.ok) expect(out.reply.suggest).toEqual(['a', 'b', 'c'])
  })

  it('tells the model which action it got wrong, so the next try can be better', () => {
    const out = parseReply(JSON.stringify({ say: 'ok', actions: [{ type: 'add-row', effect: 'WOBBLE' }] }))
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain('add-row')
  })
})

describe('checking one proposed action', () => {
  it('takes an effect name spelled exactly as the guide requires', () => {
    expect(parseAction({ type: 'add-row', effect: 'REVERB' })).toEqual({ type: 'add-row', effect: 'REVERB' })
  })

  it('refuses the wrong case rather than silently correcting it', () => {
    // Correcting here would hide a model that has not learned the rule, and the
    // guide is explicit that names are uppercase.
    expect(parseAction({ type: 'add-row', effect: 'Reverb' })).toBeNull()
  })

  it('refuses a block that does not exist, however plausible it sounds', () => {
    expect(parseAction({ type: 'add-row', effect: 'CHORUS' })).toBeNull()
  })

  it('reads null as "leave this parameter at the mic\'s own setting"', () => {
    expect(parseAction({ type: 'set-param', row: 0, param: 'cutoff', value: null })).toEqual({
      type: 'set-param',
      row: 0,
      param: 'cutoff',
      value: undefined,
    })
  })

  it('refuses a parameter value that is not a number', () => {
    expect(parseAction({ type: 'set-param', row: 0, param: 'cutoff', value: 'loud' })).toBeNull()
    expect(parseAction({ type: 'set-param', row: 0, param: 'cutoff', value: Infinity })).toBeNull()
  })

  it('refuses a row number that is negative, fractional, or absurd', () => {
    expect(parseAction({ type: 'remove-row', row: -1 })).toBeNull()
    expect(parseAction({ type: 'remove-row', row: 1.5 })).toBeNull()
    expect(parseAction({ type: 'remove-row', row: 9999 })).toBeNull()
  })

  it('refuses an LFO shape the device does not have', () => {
    expect(parseAction({ type: 'set-mod', kind: 'lfo', patch: { shape: 'triangle' } })).toBeNull()
  })

  it('refuses to touch samples, because a made-up filename is a dead sample button', () => {
    expect(parseAction({ type: 'add-sample', file: '1.wav', playmode: 'oneshot' })).toBeNull()
    expect(PROPOSABLE).not.toContain('add-sample')
  })

  it('refuses to move the handle, which is performance rather than an edit to agree to', () => {
    expect(parseAction({ type: 'set-handle', value: 0.5 })).toBeNull()
  })

  it('refuses anything that is not an action at all', () => {
    for (const junk of [null, 42, 'add-row', [], {}, { type: 7 }]) {
      expect(parseAction(junk)).toBeNull()
    }
  })
})
