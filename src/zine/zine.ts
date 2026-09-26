/**
 * The pocket manual, generated from `spec.ts` and nothing else.
 *
 * People with this mic have been asking for a printed syntax reference — the
 * guide is a web page, and a web page is no use with the lid off the mic and a
 * text editor open. The whole point of generating it is that a reference which
 * disagrees with the validator is worse than no reference: every block, range,
 * ambiguity and field report below is read out of the same source the validator
 * enforces, so the two cannot drift apart. A test fails if anything in the spec
 * fails to reach the page.
 *
 * `npm run zine` writes it to public/zine.html, so it ships with the site and
 * prints on A4 straight from the browser.
 */
import { KOFI } from '../site.ts'
import {
  AMBIGUOUS,
  BUTTONS,
  DUCK,
  FACTORY_SOUNDS,
  LINE_OUT,
  EFFECTS,
  FIELD_REPORTS,
  LFO_SHAPES,
  LIMITS,
  PLAYMODES,
  RECOVERY,
  type EffectSpec,
} from '../fxmic/spec.ts'

export { KOFI }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const FAMILY: Record<string, string> = {
  LOWPASS: 'filter', HIGHPASS: 'filter', EQUALIZER: 'filter',
  DELAY: 'space', REVERB: 'space', BALANCE: 'space',
  HARMONY: 'pitch', SSB: 'pitch',
  DIST: 'drive', RING: 'drive',
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : String(n))

/**
 * Reader-facing names for the two lists that are keyed by identifier in the
 * spec. Typed against the source, so adding an ambiguity or a report without
 * naming it here fails to compile rather than printing camelCase at a musician.
 */
const AMBIGUOUS_LABEL: Record<keyof typeof AMBIGUOUS, string> = {
  bus: 'how a BUS sums',
  sampleOnBus: 'SAMPLE inside a bus',
  reverbSpring: 'what the reverb\u2019s spring is called',
  triggerOnEffect: 'trigger on an effect row',
  trigger: 'whether a trigger is required',
  paramCase: 'capitalisation of parameters',
  unknownKeys: 'keys the guide never mentions',
}

const REPORT_LABEL: Record<keyof typeof FIELD_REPORTS, string> = {
  'ep2350-ting-config': 'windowbed\u2019s example pack',
  'ep2350-ting-comments': 'the replies under it',
  'ep2350-repl-api': 'the firmware\u2019s own REPL, documented',
}

function block(e: EffectSpec): string {
  const marks = [
    e.oncePerChain ? '<span class="mark once">once per chain</span>' : '',
    e.unverified ? '<span class="mark field">not in the guide</span>' : '',
  ].join('')
  // Name and range on one line, the note on its own beneath it. Three columns
  // in a half-width block put SSB's -20000 - 20000 straight through its note.
  const rows = e.params
    .map(
      (p) =>
        `<tr><td class="k">${esc(p.name)}</td><td class="r">${num(p.min)} &ndash; ${num(p.max)}</td></tr>` +
        (p.note ? `<tr class="note"><td colspan="2">${esc(p.note)}</td></tr>` : ''),
    )
    .join('')
  return `<section class="block fam-${FAMILY[e.name] ?? 'plain'}">
    <h3>${esc(e.name)}${marks}</h3>
    <p class="blurb">${esc(e.blurb)}</p>
    <table class="params"><colgroup><col span="1"><col span="1"></colgroup><tbody>${rows}</tbody></table>
  </section>`
}

const SKELETON = `{
  "name": "MY PACK",
  "comment": "yours to modify and pass on",
  "presets": [
    {
      "pos": 0,
      "name": "PRESET ONE",
      "comment": "what it is for",
      "list": [
        { "effect": "DIST", "amount": 10.0 },
        { "effect": "SAMPLE" },
        { "effect": "REVERB", "time": 0.4 }
      ],
      "handle":  { "row": 0, "param": "amount", "depth": 20.0 },
      "shake":   { "row": 2, "param": "time",   "depth": 0.5 },
      "trigger": { "row": 1 }
    }
  ]
}`

/**
 * The rules as data rather than one blob of markup: the booklet has to split
 * them across pages, and a test can then assert none went missing in the split.
 */
/**
 * How many rules ride on page 6, the rest going to page 7.
 *
 * Measured in a browser, not guessed: at this split every page of the booklet
 * has room to spare, the tightest being about 100px of a 816px page. The pages
 * are declared rather than flowed, so nothing warns you when content outgrows
 * one — it simply prints off the bottom edge. See the fit test.
 */
export const BOOKLET_RULES_ON_PAGE_6 = 3

export const RULES: { title: string; body: string }[] = [
  {
    title: 'rows count from 0.',
    body: 'The second row is row 1. Every <b>row</b> in a modulation block, and the one in <b>trigger</b>, is an index into <b>list</b>.',
  },
  {
    title: 'audio falls top to bottom.',
    body: 'A block only works on what is above it. Put <b>SAMPLE</b> last and the built-in sounds play dry; put it earlier and everything <i>below</i> it processes them too.',
  },
  {
    title: 'no trigger, no sample.',
    body: 'It has to name the SAMPLE row itself. Pointed at an effect row instead, it is reported to switch that effect in and out while held &mdash; and the sample button stops working.',
  },
  {
    title: 'effect names are UPPERCASE.',
    body: 'Parameters are lowercase and hyphenated: <b>wet-level</b>, <b>cross-feed</b>, <b>lowpass-cutoff</b>.',
  },
  {
    title: 'use once per chain:',
    body: `${EFFECTS.filter((e) => e.oncePerChain).map((e) => e.name).join(', ')}.`,
  },
  {
    title: `BUS is ${LIMITS.busValues.join(' or ')}.`,
    body: "A bus row is a copy of whatever is at that point &mdash; dry included, unless the block's own dry-level says otherwise. <b>SAMPLE on BUS 2 is reported silent;</b> put it on BUS 1.",
  },
  {
    title: 'a wav the config never names does not play.',
    body: `Every file needs an entry under <b>samples</b>, with a playmode: ${PLAYMODES.join(', ')}. Add <b>"duck": ${DUCK.max}</b> to drop your voice while it plays (firmware ${DUCK.since}+).`,
  },
  {
    title: 'check your braces, quotes and commas.',
    body: 'A broken file is a mic that will not boot &mdash; see the recovery note.',
  },
]

const rulesList = (rules: typeof RULES) =>
  `<ul class="rules">${rules.map((r) => `<li><b>${r.title}</b> ${r.body}</li>`).join('')}</ul>`

const LEDE =
  'Every block, range and rule the EP&ndash;2350 understands, on paper, because a web page ' +
  'is no help with the lid off and a text editor open. Generated from the same source Mic ' +
  'Gnome validates against, so it cannot quietly disagree with the tool.'

const recoverBox = () =>
  `<p class="recover"><b>If the mic will not start.</b> ${esc(RECOVERY.replace(/^If the mic will not start, /, ''))}</p>`

const buttonsTable = () => `<table><tbody>
  <tr><td class="k">orange</td><td class="n">${esc(BUTTONS.orange)}</td></tr>
  <tr><td class="k">white</td><td class="n">${esc(BUTTONS.white)}</td></tr>
  <tr><td class="k">grey</td><td class="n">${esc(BUTTONS.grey)}</td></tr>
</tbody></table>
<p class="lede">The four sounds already in it are ${FACTORY_SOUNDS.join(', ')} &mdash; the beep
mutes the mic while it plays, which is the point of it. A pack needs no wav of your own
unless you want one.</p>`

const lineOutBox = () =>
  `<p class="danger"><b>Mind your ears.</b> The socket is a ${esc(LINE_OUT.what)} &mdash;
   ${esc(LINE_OUT.maxLevel)} max, ${esc(LINE_OUT.snr)} SNR. ${esc(LINE_OUT.warning)}</p>`

const modulationTable = () => `<table><tbody>
  <tr><td class="k">handle</td><td class="n">the squeeze. one per preset. { "row": n, "param": "x", "depth": d }</td></tr>
  <tr><td class="k">shake</td><td class="n">the gyroscope. keeps moving after you let go.</td></tr>
  <tr><td class="k">lfo</td><td class="n">the only motion that runs on its own. shapes: ${LFO_SHAPES.join(', ')}. also takes speed, mpy, phase.</td></tr>
  <tr><td class="k">trigger</td><td class="n">the sample button. point it at the SAMPLE row, counting from 0.</td></tr>
  <tr><td class="k">target: "lfo"</td><td class="n">on the handle, squeezes the lfo itself rather than an effect.</td></tr>
</tbody></table>`

const limitsTable = () => `<table><tbody>
  <tr><td class="k">presets</td><td class="r">${LIMITS.presets}</td><td class="n">the orange button, pos 0&ndash;${LIMITS.presets - 1}</td></tr>
  <tr><td class="k">samples</td><td class="r">${LIMITS.samples}</td><td class="n">the white button, pos 0&ndash;${LIMITS.samples - 1}</td></tr>
  <tr><td class="k">storage</td><td class="r">${LIMITS.storageBytes / 1024} kb</td><td class="n">everything on the disk, together</td></tr>
  <tr><td class="k">audio</td><td class="r">wav</td><td class="n">mono or stereo, ${LIMITS.audio.bitDepths.join('/')}-bit, up to ${LIMITS.audio.maxSampleRate / 1000} khz</td></tr>
</tbody></table>`

const ambiguousList = () =>
  `<ul>${Object.entries(AMBIGUOUS)
    .map(([k, v]) => `<li><b>${esc(AMBIGUOUS_LABEL[k as keyof typeof AMBIGUOUS])}</b> &mdash; ${esc(v)}</li>`)
    .join('')}</ul>`

/**
 * `brief` is for the booklet, where a 5.5in page has no room for the full
 * provenance and a person with the lid off their mic does not want it. The A4
 * sheet carries the whole account.
 */
const reportsList = (brief = false) =>
  `<ul>${Object.entries(FIELD_REPORTS)
    .map(
      ([k, v]) =>
        `<li><b>${esc(REPORT_LABEL[k as keyof typeof FIELD_REPORTS])}</b> &mdash; ${esc(brief ? v.short : v.what)} <span class="src">${esc(v.where)}, ${esc(v.when)}</span></li>`,
    )
    .join('')}</ul>`

/** Shared by both layouts, so the page and the booklet cannot look like different documents. */
const BASE_CSS = `
  :root {
    --ink: #111110; --mute: #6e6a64; --rule: #d9d6d1; --paper: #fff;
    --orange: #ff4b00; --filter: #1d6fd6; --space: #0f8a7a; --pitch: #7a4fd8; --drive: #c2257a;
    --sans: "Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  * { box-sizing: border-box; }
  h1 { font-size: 19pt; letter-spacing: -0.01em; margin: 0 0 2px; }
  h2 {
    font-size: 8pt; letter-spacing: 0.12em; text-transform: uppercase; color: var(--mute);
    margin: 26px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--rule);
    break-after: avoid;
  }
  h3 { font: 600 10.5pt/1.3 var(--mono); margin: 0 0 2px; display: flex; flex-wrap: wrap; gap: 6px; align-items: baseline; }
  p { margin: 0 0 8px; }
  .lede { color: var(--mute); }
  .recover { border: 1.5px solid var(--orange); padding: 8px 10px; margin: 0 0 12px; }
  .recover b { color: var(--orange); }
  .danger { border: 1.5px solid var(--drive); padding: 8px 10px; margin: 0 0 12px; }
  .danger b { color: var(--drive); }
  .block { padding-left: 8px; margin: 0 0 13px; border-left: 2px solid var(--rule); }
  .fam-filter { border-left-color: var(--filter); } .fam-filter h3 { color: var(--filter); }
  .fam-space  { border-left-color: var(--space); }  .fam-space h3  { color: var(--space); }
  .fam-pitch  { border-left-color: var(--pitch); }  .fam-pitch h3  { color: var(--pitch); }
  .fam-drive  { border-left-color: var(--drive); }  .fam-drive h3  { color: var(--drive); }
  .blurb { color: var(--mute); font-size: 9pt; margin-bottom: 4px; }
  .mark {
    font: 400 6.5pt/1 var(--sans); letter-spacing: 0.08em; text-transform: uppercase;
    border: 1px solid currentColor; padding: 2px 4px; color: var(--mute);
  }
  .mark.field { color: var(--orange); }
  table { width: 100%; border-collapse: collapse; font: 400 8.5pt/1.45 var(--mono); }
  td { vertical-align: top; padding: 1px 6px 1px 0; border-top: 1px solid #f0eeeb; }
  .params { table-layout: fixed; }
  .params col:nth-child(1) { width: 52%; }
  .params col:nth-child(2) { width: 48%; }
  .params tr.note td {
    border-top: 0; padding: 0 0 3px 0;
    font-family: var(--sans); font-size: 7.5pt; line-height: 1.35; color: var(--mute);
  }
  td.k { white-space: nowrap; overflow-wrap: break-word; }
  td.r { white-space: nowrap; color: var(--mute); text-align: right; }
  td.n { color: var(--mute); font-family: var(--sans); font-size: 8pt; }
  pre {
    font: 400 8.5pt/1.5 var(--mono); background: #f6f5f3; padding: 10px 12px; margin: 0;
    overflow-x: auto; break-inside: avoid;
  }
  ul { margin: 0; padding-left: 1.1em; }
  li { margin-bottom: 5px; }
  .rules li { margin-bottom: 7px; }
  .rules b { font-family: var(--mono); font-weight: 600; }
  .src { color: var(--mute); font-size: 8pt; }
  .tip a, a.tip { color: var(--orange); }
`

export function renderZine(): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>fx-mic pocket manual</title>
<style>
  @page { size: A4; margin: 14mm 15mm; }
${BASE_CSS}
  body {
    margin: 0 auto; padding: 24px 20px 60px; max-width: 46rem;
    background: var(--paper); color: var(--ink);
    font: 400 10.5pt/1.5 var(--sans); -webkit-text-size-adjust: 100%;
  }
  .lede { max-width: 34rem; }
  .recover { margin: 14px 0 0; }
  /* Columns, not a grid: a grid gives every row the height of its tallest cell,
     which left holes beside the long blocks. Columns let short ones close up. */
  .grid { columns: 2; column-gap: 22px; }
  .block { break-inside: avoid; -webkit-column-break-inside: avoid; }
  footer { margin-top: 30px; padding-top: 8px; border-top: 1px solid var(--rule); color: var(--mute); font-size: 8pt; }
  @media print {
    body { padding: 0; max-width: none; font-size: 9.5pt; }
    a { color: inherit; text-decoration: none; }
  }
</style>
</head><body>

<h1>fx-mic pocket manual</h1>
<p class="lede">${LEDE}</p>

${recoverBox()}
${lineOutBox()}

<h2>the three buttons</h2>
${buttonsTable()}

<h2>the shape of the file</h2>
<pre>${esc(SKELETON)}</pre>

<h2>the ${EFFECTS.length} blocks</h2>
<div class="grid">${EFFECTS.map(block).join('')}</div>

<h2>modulation</h2>
${modulationTable()}

<h2>the rules that bite</h2>
${rulesList(RULES)}

<h2>what it holds</h2>
${limitsTable()}

<h2>where the guide says nothing</h2>
${ambiguousList()}

<h2>who told us the rest</h2>
<p class="lede">Not from Teenage Engineering. People with the mic in front of them, which is
weaker than the guide and stronger than nothing &mdash; enough to warn you, never enough to
stop you.</p>
${reportsList()}

<footer>
  Generated from the Mic Gnome spec &mdash; <b>micgnome.stephen8n.com</b>. Free, like the tool.
  If it saved you an evening, <a class="tip" href="${KOFI}">chip in</a>.
  Anything marked <i>not in the guide</i> is waiting to be confirmed on hardware.
</footer>

</body></html>
`
}

/**
 * The booklet: the same manual laid out for a 5.5 x 8.5in digest saddle-stitch,
 * which is what a print-on-demand shop wants. Pages are declared rather than
 * flowed, for one reason that matters commercially: saddle stitch requires a
 * page count divisible by four, and a reflowing document does not have a page
 * count you can promise. Reader order, not printer spreads — the printer does
 * the imposition, and doing it here would be an error nobody sees until it is
 * printed and paid for.
 */
function bookletPages(): string[] {
  const blocksFor = (...names: string[]) =>
    EFFECTS.filter((e) => names.includes(e.name)).map(block).join('')

  // Eight, not twelve. Twelve left every page about half empty, which reads as
  // unfinished rather than airy — and eight is two folded sheets, so it is also
  // the version somebody can make at home with a long-arm stapler.
  return [
    // 1 — cover
    `<div class="cover">
       <h1>fx-mic<br>pocket manual</h1>
       <p class="sub">EP&ndash;2350 &mdash; the fx-mic, and the TING that ships with the EP&ndash;40 RIDDIM</p>
       <p class="sub">every block, range and rule, on paper</p>
       <p class="foot">micgnome.stephen8n.com</p>
     </div>`,

    // 2 — the way out of trouble, then the file it is all about
    `<h2>first, the way back</h2>
     ${recoverBox()}
     ${lineOutBox()}
     <p class="lede">${LEDE}</p>
     <h2>the shape of the file</h2>
     <pre>${esc(SKELETON)}</pre>
     <p class="lede">Four presets go in <b>presets</b>, one per slot on the orange button.
     Inside each, <b>list</b> is the chain, top to bottom. The three lines under it are the
     only things that move: the handle you squeeze, the shake of the mic, and the sample
     button. Each names a <b>row</b> &mdash; a position in that list, counting from zero.</p>`,

    // 3-5 — the blocks
    `<h2>the ${EFFECTS.length} blocks &mdash; 1</h2>${blocksFor('DELAY', 'DIST', 'EQUALIZER')}`,
    `<h2>the blocks &mdash; 2</h2>${blocksFor('HARMONY', 'LOWPASS', 'HIGHPASS', 'SAMPLE')}`,
    `<h2>the blocks &mdash; 3</h2>${blocksFor('REVERB', 'RING', 'SSB', 'BALANCE')}`,

    // 6 — what moves, then the first of the rules. The rules are split because
    // page 7 also carries the gaps; the test asserts none is lost in the split.
    `<h2>the three buttons</h2>${buttonsTable()}
     <h2>modulation</h2>${modulationTable()}
     <h2>what it holds</h2>${limitsTable()}
     <h2>the rules that bite</h2>${rulesList(RULES.slice(0, BOOKLET_RULES_ON_PAGE_6))}`,

    // 7 — the rest of the rules, and the places the guide simply stops. Both are
    // "what the manual does not tell you". Page 8 could not hold the gaps as
    // well as the sources: it overflowed the moment a third report was added.
    `<h2>the rules that bite &mdash; 2</h2>${rulesList(RULES.slice(BOOKLET_RULES_ON_PAGE_6))}
     <h2>where the guide says nothing</h2>${ambiguousList()}`,

    // 8 — who filled the gaps, and the back cover
    `<h2>who told us the rest</h2>
     <p class="lede">Not Teenage Engineering, but people with the mic in front of them &mdash; enough to warn you, never enough to stop you.</p>
     ${reportsList(true)}
     <div class="back">
       <p><b>micgnome.stephen8n.com</b> &mdash; the editor this was generated from. It checks a
       config before it can stop your mic booting, and it is free.</p>
       <p>If it saved you an evening, <a class="tip" href="${KOFI}">${KOFI.replace('https://', '')}</a>.</p>
     </div>`,
  ]
}

export function renderBooklet(): string {
  const pages = bookletPages()
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>fx-mic pocket manual — booklet</title>
<style>
  @page { size: 5.5in 8.5in; margin: 0; }
${BASE_CSS}
  body {
    margin: 0; background: #e8e5e1; color: var(--ink);
    font: 400 9pt/1.45 var(--sans); -webkit-text-size-adjust: 100%;
  }
  .page {
    width: 5.5in; height: 8.5in; padding: 0.42in 0.4in 0.5in;
    background: var(--paper); position: relative;
    margin: 0 auto 14px; break-after: page;
  }
  .page:last-child { break-after: auto; }
  h2 { margin-top: 0; }
  .page h2 ~ h2 { margin-top: 18px; }
  .folio {
    position: absolute; left: 0; right: 0; bottom: 0.2in;
    text-align: center; font: 400 7pt var(--mono); color: var(--mute);
  }
  .cover { height: 100%; display: flex; flex-direction: column; justify-content: center; }
  .cover h1 { font-size: 30pt; line-height: 1.05; margin-bottom: 14px; }
  .cover .sub { color: var(--mute); margin: 0 0 4px; max-width: 3.6in; }
  .cover .foot { margin-top: auto; font: 600 9pt var(--mono); color: var(--orange); }
  .back { margin-top: 16px; padding-top: 8px; border-top: 1px solid var(--rule); font-size: 8pt; color: var(--mute); }
  .block { font-size: 8.5pt; }
  /* On screen an over-wide <pre> scrolls; on paper it is simply cut off. Smaller
     type buys the width back, and pre-wrap guarantees a long line wraps rather
     than disappearing off the trim edge. */
  pre { font-size: 7pt; line-height: 1.45; white-space: pre-wrap; overflow-x: visible; }
  @media print {
    body { background: none; }
    /* Only in print: on screen an overflowing page must be visible, not clipped,
       or a page that no longer fits would look finished. */
    .page { margin: 0; overflow: hidden; box-shadow: none; }
    a { color: inherit; text-decoration: none; }
  }
  @media screen {
    .page { box-shadow: 0 1px 4px rgba(0,0,0,0.18); outline: 1px solid var(--rule); }
    body { padding: 14px 0; }
  }
</style>
</head><body>
${pages
  .map(
    (html, i) =>
      `<section class="page">${html}${i ? `<div class="folio">${i + 1}</div>` : ''}</section>`,
  )
  .join('\n')}
</body></html>
`
}

/** Saddle stitch folds sheets in half, so the page count must divide by four. */
export const BOOKLET_PAGE_COUNT = bookletPages().length
