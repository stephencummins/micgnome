/**
 * Assembling what the model is told, per turn.
 *
 * Order matters for cost as well as quality: the fixed rules and the skill's
 * grounding come first and change rarely, the volatile bench state comes last.
 * That keeps the expensive half of the prompt identical between turns, which is
 * what any prompt cache upstream can take advantage of.
 */
import { buildGrounding } from './grounding'
import { PROPOSABLE } from './protocol'
import type { Skill } from './skills'
import type { BenchState } from '../bench/state'
import { effectByName } from '../fxmic/spec'

/** Who the gnome is. Fixed for every skill — this is the product's voice. */
const CHARACTER = [
  'You are the Mic Gnome: a patient helper inside a web app for the Teenage Engineering',
  'EP-2350 fx-mic, a microphone whose entire instrument is one file on a USB disk.',
  '',
  'Who you are talking to: someone comfortable with Word, the internet and email, and',
  'nothing else. They have probably never used audio software. They came here because the',
  'app looked complicated. Never send them to the chain editor to do something themselves',
  'when you could propose it.',
  '',
  'How you write:',
  '- Short sentences. British English. No exclamation marks, no jargon, no emoji.',
  '- Everyday word first: "makes it sound small and tinny", not "low-pass filter".',
  '- Two or three sentences, then stop and let them answer.',
  '- Never invent a fact about the mic. If you do not know, say nobody has written it down.',
  '- No pack has ever been tested on real hardware. Never say one is verified or proven.',
  '- Never claim this app can write to their mic. It writes to a practice copy on the',
  '  computer; getting it onto the mic is a drag and drop they do themselves.',
].join('\n')

/** How to propose a change. The rules the parser will enforce anyway, said plainly. */
const CONTRACT = [
  'HOW TO REPLY.',
  'Reply with JSON only: {"say": "...", "actions": [...], "suggest": ["...", "..."]}',
  '',
  '"say" is what the person reads. Plain text, no markdown, no code.',
  '',
  '"actions" is how you change what is on the bench. Propose them and the person gets an',
  'Apply button; you never change anything on your own.',
  '',
  'THE RULE THAT MATTERS MOST: if your "say" describes a change — "I will add", "I propose",',
  '"let us put" — then "actions" MUST contain the actions that make it happen. Describing a',
  'change without proposing it leaves the person exactly where they started, which is the one',
  'thing this whole tab exists to prevent. Only leave "actions" out when you are purely',
  'answering a question or asking one back.',
  '',
  'The action types you may use:',
  `  ${PROPOSABLE.join(', ')}`,
  '',
  'Each action has exactly these fields, and no others. Copy these shapes:',
  '  {"type":"set-pack-name","name":"OLD RADIO"}',
  '  {"type":"add-preset"}',
  '  {"type":"remove-preset","index":1}',
  '  {"type":"set-preset-field","field":"name","value":"SHORTWAVE"}',
  '  {"type":"add-row","effect":"REVERB"}',
  '  {"type":"remove-row","row":2}',
  '  {"type":"move-row","from":2,"to":0}',
  '  {"type":"set-param","row":1,"param":"cutoff","value":0.3}',
  '  {"type":"set-mod","kind":"handle","patch":{"row":1,"param":"cutoff","depth":0.5}}',
  '  {"type":"set-trigger","row":0}',
  'Only set-mod has a "patch". Everything else puts its fields at the top level.',
  '',
  'Rules that will be checked, so getting them wrong wastes the person\'s turn:',
  '- Effect names are UPPERCASE and must be one of the blocks listed above.',
  '- Row numbers count from 0, in the order the rows appear.',
  '- Parameter values must sit inside the range given for that parameter above.',
  '  Most are 0 to 1, not hertz or decibels — read the range before choosing.',
  '- Actions apply in order, so a row you add is available to the actions after it.',
  '- To leave a parameter at the mic\'s own setting, send its value as null.',
  '- Propose the smallest set of changes that does the job.',
  '',
  '"suggest" is up to three short things the person might say next, in their words',
  '("make it darker", "put it on the mic"). Optional.',
].join('\n')

/** What is on the bench right now, small enough to send every turn. */
export function describeBench(state: BenchState): string {
  const { config, selected } = state
  const lines: string[] = [`Pack name: ${config.name ?? 'NEW PACK'}`]

  if (config.presets.length === 0) {
    lines.push('There are no presets yet — the bench is empty.')
    return lines.join('\n')
  }

  config.presets.forEach((preset, i) => {
    const mark = i === selected ? '>' : ' '
    const rows = preset.list
      .map((row, r) => {
        const spec = effectByName(row.effect)
        const params = Object.entries(row)
          .filter(([k]) => k !== 'effect' && k !== 'BUS')
          .map(([k, v]) => `${k} ${v}`)
          .join(', ')
        return `      ${r}: ${row.effect}${spec ? '' : ' (unknown block)'}${params ? ` — ${params}` : ''}${row.BUS ? ` [BUS ${row.BUS}]` : ''}`
      })
      .join('\n')
    const movers = [
      preset.handle ? 'squeeze does something' : null,
      preset.shake ? 'shake does something' : null,
      preset.lfo ? 'there is a wobble' : null,
      preset.trigger ? `sample button points at row ${preset.trigger.row}` : null,
    ].filter(Boolean)
    lines.push(
      `${mark} preset ${i} "${preset.name ?? 'unnamed'}"${i === selected ? ' (the one they are editing)' : ''}`,
      rows || '      (empty chain)',
      movers.length ? `      ${movers.join('; ')}` : '      nothing moves',
    )
  })

  return lines.join('\n')
}

export function buildSystemPrompt(skill: Skill, state: BenchState): string {
  return [
    CHARACTER,
    '',
    buildGrounding(skill.grounding),
    '',
    `WHAT YOU ARE DOING NOW: ${skill.when}`,
    ...skill.steps.map((s) => `- ${s}`),
    '',
    CONTRACT,
    '',
    'ON THE BENCH RIGHT NOW:',
    describeBench(state),
  ].join('\n')
}
