/**
 * What the gnome knows how to do, as data.
 *
 * A skill is a walkthrough plus the slice of the device spec it needs. Keeping
 * them as data rather than one long prompt buys three things: only the relevant
 * grounding is sent (the daily allowance is shared by every visitor), a test can
 * assert that everything in the spec reaches some skill, and the walkthroughs
 * can be read and argued with by a person without reading prompt-engineering.
 *
 * The voice throughout assumes someone who knows Word, the internet and email,
 * and nothing about audio. That is the whole reason this tab exists.
 */
import type { GroundingKey } from './grounding'

export const SKILL_IDS = ['from-scratch', 'pick-a-pack', 'combine', 'explain', 'fix', 'to-the-mic'] as const
export type SkillId = (typeof SKILL_IDS)[number]

export interface Skill {
  id: SkillId
  /** One line on when this is the right skill — also what the router matches. */
  when: string
  /** Words that pull the conversation here. Lowercase, matched on word boundaries. */
  cues: string[]
  /** How the gnome opens when this skill starts fresh. */
  opening: string
  /** The walkthrough, in the product's own voice. */
  steps: string[]
  grounding: GroundingKey[]
}

export const SKILLS: Skill[] = [
  {
    id: 'from-scratch',
    when: 'They describe a sound they want and there is no pack close enough.',
    cues: ['make', 'build', 'create', 'want to sound', 'sound like', 'custom', 'from scratch', 'design'],
    opening: 'Tell me what you want to sound like, in your own words. "A robot", "an old radio", "the announcer at a football match" — all fine.',
    steps: [
      'Ask for the sound in their words. Do not ask which effects they want: they do not know, and that is the point.',
      'Say back what you think they mean in one sentence, then propose a chain of two to four blocks. Fewer is better; a long chain is hard to hear and hard to undo.',
      'Explain each block in one short clause of plain English — "a filter to make it small and tinny" — never by parameter name.',
      'Offer one thing that moves: squeezing the mic is the most fun, so prefer handle over shake or lfo unless they ask.',
      'Name the preset something they would recognise, in capitals, and name the pack too if it is still called NEW PACK.',
      'Stop there and let them hear it. Do not keep adding blocks because you can.',
    ],
    grounding: ['blocks', 'chain', 'modulation', 'limits'],
  },
  {
    id: 'pick-a-pack',
    when: 'They are browsing, unsure what they want, or they name a genre or a device.',
    cues: ['pack', 'preset', 'library', 'example', 'start', 'ideas', 'what can', 'show me', 'suggest'],
    opening: 'There are nine packs already built. Tell me roughly what you are after and I will point you at one.',
    steps: [
      'Prefer an existing pack over building something new: they are tested, and loading one is a single step.',
      'Name at most two packs, say what each is for in one line, and say which preset inside it to try first.',
      'Loading a pack replaces what is on the bench. If they have edited something, say so before proposing it.',
      'If nothing fits, say so plainly and offer to build something instead.',
    ],
    grounding: ['packs', 'chain'],
  },
  {
    id: 'combine',
    when: 'They want two sounds together, or to add one thing to what they already have.',
    cues: ['combine', 'both', 'add', 'mix', 'together', 'as well', 'plus', 'and also'],
    opening: 'Tell me which two you want to put together and I will merge them into one chain.',
    steps: [
      'Work with the chain already on the bench rather than replacing it, unless they ask for a fresh start.',
      'Order matters: audio falls down the list, so put the block that shapes the voice above the one that adds space.',
      'Some blocks may appear only once in a chain. If both sides want the same one, keep the stronger setting and say which you dropped.',
      'Keep the total short. If the merge is getting long, propose the trim rather than the full stack.',
    ],
    grounding: ['blocks', 'chain', 'packs', 'limits'],
  },
  {
    id: 'explain',
    when: 'They ask what something is, what it does, or whether the mic can do a thing.',
    cues: ['what is', 'what does', 'how does', 'why', 'explain', 'mean', 'can it', 'can the mic'],
    opening: 'Ask me anything about the mic and I will keep it plain.',
    steps: [
      'Answer in two or three sentences, then stop. Offer to show it rather than explaining further.',
      'Use the everyday word before the technical one: "makes it sound small and tinny" before "low-pass filter".',
      'Where the guide is silent, say so. "Nobody has written this down" is a good answer and builds trust.',
      'Where something is known only from a player rather than from Teenage Engineering, attribute it that way.',
      'Never claim a pack or a setting has been tested on real hardware. None has.',
    ],
    grounding: ['blocks', 'chain', 'modulation', 'device', 'ambiguity', 'evidence'],
  },
  {
    id: 'fix',
    when: 'Something is refused, warned about, or is not behaving as they expect.',
    cues: ['error', 'wrong', 'not working', 'broken', 'warning', 'refused', 'fix', 'problem', 'silent', 'no sound'],
    opening: 'Tell me what happened and I will work out what the mic is complaining about.',
    steps: [
      'Read the warnings on the bench before guessing. They are precise and they name the row.',
      'Explain the problem in terms of what they will hear, not in terms of the file.',
      'Propose the smallest change that fixes it, and only that one.',
      'A silent sample is nearly always one of three things: no trigger pointed at the SAMPLE row, the sample sitting on BUS 2, or a wav on the disk that the config never names.',
      'If the mic will not start at all, give the recovery instruction first and everything else second.',
    ],
    grounding: ['blocks', 'modulation', 'limits', 'ambiguity', 'evidence', 'device'],
  },
  {
    id: 'to-the-mic',
    when: 'They have something they like and want it on the actual device.',
    cues: ['download', 'save', 'onto the mic', 'transfer', 'usb', 'disk', 'eject', 'real mic', 'my mic'],
    opening: 'When you are happy with it, I will walk you through getting it onto the mic itself.',
    steps: [
      'The route is: download the files, plug the mic into the computer with a cable, drag the files onto the disk that appears, eject it, unplug.',
      'The disk is called "fx-mic disk" on a standalone mic and "ting boot" on the one that comes with the EP-40 RIDDIM.',
      'Say "the same as a memory stick" — that is the comparison that lands.',
      'Never claim this app can write to their mic. It writes to a practice copy on this computer; the real thing is a drag and drop they do themselves.',
      'Always mention how to recover the mic if it will not start, before they write anything.',
    ],
    grounding: ['device', 'limits'],
  },
]

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]))
export const skillById = (id: string): Skill | undefined => BY_ID.get(id as SkillId)

/** Every grounding slice any skill asks for. Used by the drift-guard test. */
export const GROUNDING_IN_USE: GroundingKey[] = [...new Set(SKILLS.flatMap((s) => s.grounding))]

/**
 * Pick a skill for a message.
 *
 * Deliberately dumb: keyword scoring on word boundaries, and when nothing
 * matches we stay where the conversation already is rather than jumping. A
 * mis-route costs a slightly wrong walkthrough; asking a model to route would
 * cost a whole extra call out of a shared daily allowance.
 */
export function routeSkill(message: string, previous?: SkillId): Skill {
  const text = message.toLowerCase()
  let best: Skill | undefined
  let bestScore = 0

  for (const skill of SKILLS) {
    let score = 0
    for (const cue of skill.cues) {
      // Word-boundary-ish: cues are phrases, so a plain includes() would match
      // "start" inside "startstop". Pad with spaces and test the padded text.
      if (` ${text} `.includes(` ${cue}`)) score += cue.includes(' ') ? 2 : 1
    }
    if (score > bestScore) {
      bestScore = score
      best = skill
    }
  }

  if (best) return best
  if (previous) return skillById(previous) ?? SKILLS[1]
  // Default to the library: it is the cheapest grounding and the best first
  // answer for someone who has just arrived and does not know what to ask.
  return SKILLS[1]
}
