import { useEffect, useState, type ReactNode } from 'react'
import { EffectGlyph, Glyph, SourceGlyph } from './Glyphs'
import { STEP_TAB, type StepStatus } from './progress'

/**
 * Six steps, docked beside the bench so they can be followed while doing
 * them, lighting up as each is actually done. The full guide (HowTo) is one
 * link away and says why.
 */
export interface Step {
  title: string
  /** Where on the bench this happens. */
  where: string
  body: string
}

export const STEPS: Step[] = [
  {
    title: 'pick a pack',
    where: 'library tab',
    body: 'a pack is a ready-made set of four sound settings for the mic, a bit like the picture modes on a camera. the library has eight already made. press load on one and it is yours: use it as it is, or change it. you do not have to build anything.',
  },
  {
    title: 'see what is in it',
    where: 'chain tab',
    body: 'each of the four settings is a list of effects your voice passes through, top to bottom, like water through pipes. click a block to adjust it, or add and remove blocks. the block called SAMPLE is where the mic\u2019s button sounds (the horn, the applause) join in.',
  },
  {
    title: 'make the squeeze do something',
    where: 'modulation, under the chain',
    body: 'the mic\u2019s handle is a lever you squeeze while you talk. here you pick one setting for it to change, such as how much echo. the graph on the right shows what happens as you squeeze harder. shaking the mic, and a slow automatic wobble, are set up the same way.',
  },
  {
    title: 'your own sounds',
    where: 'samples tab',
    body: 'skip this and the mic uses the four sounds built into it. if you want your own, drop sound files here (wav files, up to four). together they must fit in about 1 mb, which is not much; mic gnome shrinks them to fit and tells you what it changed.',
  },
  {
    title: 'check it works',
    where: 'write, on the right',
    body: 'the box under write tells you if anything is wrong. red errors must be fixed, because that kind of mistake stops the mic switching on. then press write: that writes to a pretend mic inside your browser, and if the pretend one starts up, the real one will too.',
  },
  {
    title: 'put it on the mic',
    where: 'the cable, then the links under write',
    body: 'take the bottom cover off the mic, plug it into your computer with a usb-c cable (the small oval plug on most new phones and laptops, not the older iphone one) and push the handle so it is switched on. a drive called fx-mic disk appears, just like a memory stick. click the download links under write, drag those files from your downloads folder onto fx-mic disk, then eject it the way you would a memory stick. the mic restarts with your pack. if it ever will not start, hold the white + grey buttons while switching it on and the disk comes back so you can fix or delete config.json.',
  },
]

export const TILE_GLYPHS: ReactNode[] = [
  <Glyph key="library" name="library" size={22} />,
  <Glyph key="chain" name="chain" size={22} />,
  <SourceGlyph key="handle" kind="handle" size={22} />,
  <EffectGlyph key="sample" name="SAMPLE" size={22} />,
  <Glyph key="tick" name="tick" size={22} />,
  <Glyph key="eject" name="eject" size={22} />,
]

/* ---------- one drawing per step, in the sigil's language ---------- */

const W = 240
const H = 108
const stroke = { fill: 'none', stroke: 'var(--color-orange)', strokeWidth: 1.8, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
const rule = { fill: 'none', stroke: 'var(--color-rule)', strokeWidth: 1 }

function Frame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}
      className="block h-auto w-full max-w-[260px] shrink-0">
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} fill="var(--color-panel)" stroke="var(--color-rule-soft)" />
      {children}
    </svg>
  )
}

export const PICTURES: ReactNode[] = [
  // Four cards; one of them chosen.
  <Frame key="0" label="a grid of pack cards, one selected">
    {[0, 1, 2, 3].map((i) => {
      const x = 22 + (i % 2) * 102
      const y = 14 + Math.floor(i / 2) * 42
      const on = i === 1
      return (
        <g key={i}>
          <rect x={x} y={y} width="94" height="34" fill="var(--color-paper)"
            stroke={on ? 'var(--color-orange)' : 'var(--color-rule)'} strokeWidth={on ? 1.5 : 1} />
          <polyline {...stroke} strokeWidth={1.4} opacity={on ? 1 : 0.45}
            points={Array.from({ length: 25 }, (_, t) => `${x + 8 + t * 1.6},${y + 17 - 7 * Math.sin(t / (2.2 + i * 0.7))}`).join(' ')} />
          <line x1={x + 54} y1={y + 12} x2={x + 86} y2={y + 12} {...rule} />
          <line x1={x + 54} y1={y + 20} x2={x + 78} y2={y + 20} {...rule} />
        </g>
      )
    })}
  </Frame>,

  // Three rows with the spine, the sample row last.
  <Frame key="1" label="three effect rows stacked, audio falling top to bottom, the sample row last">
    <line x1="30" y1="14" x2="30" y2="92" {...rule} />
    <polyline points="26,86 30,92 34,86" {...rule} />
    {['LOWPASS', 'DELAY', 'SAMPLE'].map((name, i) => {
      const y = 12 + i * 27
      const last = i === 2
      return (
        <g key={name}>
          <circle cx="30" cy={y + 10} r="2.5" fill="var(--color-paper)" stroke="var(--color-orange)" />
          <rect x="44" y={y} width="170" height="20" fill="var(--color-paper)"
            stroke={last ? 'var(--color-orange)' : 'var(--color-rule)'} />
          <text x="52" y={y + 13.5} fontFamily="var(--font-mono)" fontSize="9.5" letterSpacing="0.06em"
            fill={last ? 'var(--color-orange)' : 'var(--color-ink)'}>{name}</text>
          {last && <text x="206" y={y + 13.5} textAnchor="end" fontFamily="var(--font-mono)" fontSize="8.5"
            fill="var(--color-mute)">dry</text>}
        </g>
      )
    })}
  </Frame>,

  // The handle map: a line that climbs and hits the rail before the end.
  <Frame key="2" label="a handle map: the value climbs with the squeeze and hits its ceiling at about seventy percent">
    <line x1="28" y1="22" x2="220" y2="22" {...rule} strokeDasharray="2 3" />
    <line x1="28" y1="88" x2="220" y2="88" {...rule} />
    <line x1="28" y1="22" x2="28" y2="88" {...rule} />
    <polyline {...stroke} points="28,80 162,22 220,22" />
    <line x1="162" y1="16" x2="162" y2="94" stroke="var(--color-orange)" strokeDasharray="2 3" opacity="0.6" />
    <text x="30" y="100" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--color-mute)">0%</text>
    <text x="220" y="100" textAnchor="end" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--color-mute)">100%</text>
    <text x="166" y="102" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--color-orange)">rail</text>
  </Frame>,

  // Four slots, and the one storage bar they share.
  <Frame key="3" label="four sample slots sharing one storage bar">
    {[0, 1, 2, 3].map((i) => {
      const x = 22 + i * 51
      const filled = i < 3
      return (
        <g key={i}>
          <rect x={x} y="16" width="42" height="42" fill="var(--color-paper)"
            stroke={filled ? 'var(--color-orange)' : 'var(--color-rule)'} strokeDasharray={filled ? undefined : '3 3'} />
          {filled ? (
            <polyline {...stroke} strokeWidth={1.4}
              points={Array.from({ length: 17 }, (_, t) => `${x + 6 + t * 1.9},${37 - (i === 2 ? 4 : 11) * Math.sin(t / 1.3 + i)}`).join(' ')} />
          ) : (
            <text x={x + 21} y="41" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" fill="var(--color-mute)">+</text>
          )}
        </g>
      )
    })}
    <rect x="22" y="72" width="195" height="8" fill="var(--color-paper)" stroke="var(--color-rule)" />
    <rect x="22.5" y="72.5" width="146" height="7" fill="var(--color-orange)" opacity="0.85" />
    <text x="22" y="96" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--color-mute)">1 mb, shared by all four</text>
  </Frame>,

  // The verdict, the button, and the virtual mic coming back up.
  <Frame key="4" label="a green tick saying safe to write, the write button, and the virtual mic restarting">
    <polyline points="24,36 31,43 43,27" fill="none" stroke="var(--color-pass)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <text x="52" y="39" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="0.04em" fill="var(--color-pass)">safe to write</text>
    <rect x="22" y="56" width="84" height="24" fill="var(--color-orange)" />
    <text x="64" y="72" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="0.06em" fill="#fff">write</text>
    <line x1="118" y1="68" x2="146" y2="68" {...stroke} strokeWidth={1.4} />
    <polyline points="140,63 146,68 140,73" {...stroke} strokeWidth={1.4} />
    <rect x="158" y="20" width="62" height="72" rx="8" fill="var(--color-paper)" stroke="var(--color-rule)" />
    <circle cx="189" cy="44" r="9" fill="none" stroke="var(--color-orange)" strokeWidth="1.6" />
    <polyline points="184,44 188,48 195,40" fill="none" stroke="var(--color-orange)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <text x="189" y="70" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--color-mute)">virtual</text>
    <text x="189" y="81" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fill="var(--color-mute)">booted</text>
  </Frame>,

  // The mic on its cable, the disk it becomes, and the files dropping in.
  <Frame key="5" label="the mic connected by a cable to a disk called fx-mic disk, with config.json and a wav on it, then eject">
    <rect x="22" y="18" width="30" height="72" rx="8" fill="var(--color-paper)" stroke="var(--color-rule)" />
    <circle cx="37" cy="34" r="6" fill="none" stroke="var(--color-rule)" />
    <rect x="34" y="52" width="6" height="26" rx="1" fill="var(--color-orange)" opacity="0.8" />
    <path d="M52 84h18c6 0 6-30 12-30h14" {...rule} strokeDasharray="3 3" />
    <rect x="96" y="30" width="96" height="50" fill="var(--color-paper)" stroke="var(--color-orange)" />
    <text x="102" y="42" fontFamily="var(--font-mono)" fontSize="8" letterSpacing="0.04em" fill="var(--color-orange)">fx-mic disk</text>
    <text x="102" y="58" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--color-ink)">config.json</text>
    <text x="102" y="71" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--color-ink)">1.wav</text>
    <line x1="150" y1="14" x2="150" y2="26" {...stroke} strokeWidth={1.4} />
    <polyline points="145,21 150,26 155,21" {...stroke} strokeWidth={1.4} />
    <path d="M214 46l9 12h-18z" {...stroke} strokeWidth={1.4} />
    <line x1="205" y1="64" x2="223" y2="64" {...stroke} strokeWidth={1.4} />
  </Frame>,
]

export function Guide({
  status,
  tab,
  onClose,
  onFullGuide,
}: {
  status: StepStatus[]
  /** The bench tab in view, so the guide opens the step that matches it. */
  tab: string
  onClose: () => void
  onFullGuide: () => void
}) {
  const current = status.indexOf('current')
  const tabStep = STEP_TAB.findIndex((t, i) => t === tab && status[i] !== 'done')
  const auto = tabStep >= 0 ? tabStep : current >= 0 ? current : STEPS.length - 1
  const [picked, setPicked] = useState<number>()
  // A fresh reason to move (a tab change, a step completed) beats a manual pick.
  useEffect(() => setPicked(undefined), [auto])
  const open = picked ?? auto
  const doneCount = status.filter((s) => s === 'done').length

  return (
    <div className="flex h-full flex-col" aria-label="how it works">
      <div className="mb-3 flex items-baseline justify-between border-b border-rule-soft pb-2">
        <span className="data font-medium">how it works</span>
        <span className="flex items-baseline gap-3">
          <span className="label">{doneCount} of {STEPS.length}</span>
          <button type="button" onClick={onClose} className="label underline hover:text-orange">close</button>
        </span>
      </div>

      <ol className="m-0 flex list-none flex-col gap-1.5 p-0" aria-label="steps">
        {STEPS.map((s, i) => {
          const st = status[i]
          const isOpen = i === open
          const tone =
            st === 'done' ? 'text-pass' : st === 'current' ? 'text-orange' : st === 'optional' ? 'text-mute' : 'text-mute'
          const border =
            isOpen ? 'border-orange' : st === 'done' ? 'border-pass/40' : 'border-rule-soft hover:border-rule'
          return (
            <li key={s.title} className={`border ${border} ${isOpen ? 'bg-paper' : ''}`}>
              <button type="button" onClick={() => setPicked(i)} aria-expanded={isOpen}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left">
                <span className={`data w-4 shrink-0 ${tone}`}>{st === 'done' ? '✓' : i + 1}</span>
                <span className={`shrink-0 ${tone}`}>{TILE_GLYPHS[i]}</span>
                <span className={`data min-w-0 flex-1 leading-tight ${st === 'done' ? 'text-mute line-through decoration-pass/50' : st === 'current' ? 'text-ink' : 'text-mute'}`}>
                  {s.title}
                </span>
                {st === 'current' && <span className="label shrink-0 text-orange">now</span>}
                {st === 'optional' && <span className="label shrink-0">optional</span>}
              </button>
              {isOpen && (
                <div className="border-t border-rule-soft px-3 pb-3 pt-3">
                  {PICTURES[i]}
                  <p className="label m-0 mt-3">{s.where}</p>
                  <p className="label m-0 mt-1 leading-relaxed text-ink">{s.body}</p>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <button type="button" onClick={onFullGuide} className="label mt-4 self-start underline hover:text-orange">
        the full guide →
      </button>
    </div>
  )
}
