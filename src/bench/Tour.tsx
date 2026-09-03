import { useEffect, useState, type ReactNode } from 'react'
import { EffectGlyph, Glyph, SourceGlyph } from './Glyphs'

/**
 * Five tiles, one screen each: the shortest path from landing here cold to a
 * mic that starts. The full guide (HowTo) is one link away and says why.
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
    body: 'eight packs are ready to go. load one and it fills the four preset slots on the orange button. or start from NEW PACK and build your own from an empty chain.',
  },
  {
    title: 'build the chain',
    where: 'chain tab',
    body: 'add blocks; audio falls through them top to bottom. the SAMPLE row is where the button sound comes in — put it last to keep it clean, earlier to run it through the blocks above.',
  },
  {
    title: 'make it move',
    where: 'modulation, under the chain',
    body: 'give the handle, a shake or an lfo one parameter on one row. the map on the right plots the squeeze from 0 to 100% and marks where the value hits its rail and the rest of the travel does nothing.',
  },
  {
    title: 'add sounds, or don’t',
    where: 'samples tab',
    body: 'with no wavs the mic plays its four built-in sounds: horn, applause, bell and the censor beep. drop up to four wavs for your own. all four share 1 mb, and the fitter trims and folds until they fit, then says what it traded.',
  },
  {
    title: 'write and eject',
    where: 'write, on the right',
    body: 'safe to write means nothing blocks: errors block, warnings never do. write, then eject the disk and wait for the mic to restart. if a mic ever will not start, hold white + grey while powering on and the disk comes back.',
  },
]

const TILE_GLYPHS: ReactNode[] = [
  <Glyph key="library" name="library" size={22} />,
  <Glyph key="chain" name="chain" size={22} />,
  <SourceGlyph key="handle" kind="handle" size={22} />,
  <EffectGlyph key="sample" name="SAMPLE" size={22} />,
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
      className="block h-auto w-full max-w-[240px] shrink-0">
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} fill="var(--color-panel)" stroke="var(--color-rule-soft)" />
      {children}
    </svg>
  )
}

const PICTURES: ReactNode[] = [
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

  // The tick, then the eject.
  <Frame key="4" label="a tick for the verdict, then the eject symbol">
    <rect x="18" y="22" width="126" height="24" fill="var(--color-pass-soft)" stroke="var(--color-pass)" />
    <polyline points="26,34 32,40 42,28" fill="none" stroke="var(--color-pass)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <text x="50" y="38" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="0.04em" fill="var(--color-pass)">safe to write</text>
    <rect x="18" y="58" width="126" height="24" fill="var(--color-orange)" />
    <text x="81" y="74" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="9" letterSpacing="0.06em" fill="#fff">write to fx-mic</text>
    <line x1="160" y1="34" x2="180" y2="34" {...rule} />
    <polyline points="180,34 194,34" {...stroke} strokeWidth={1.4} />
    <polyline points="186,30 194,34 186,38" {...stroke} strokeWidth={1.4} />
    <path d="M200 62l10 12h-20z" {...stroke} />
    <line x1="190" y1="80" x2="220" y2="80" {...stroke} />
  </Frame>,
]

export function Tour({ onClose, onGuide }: { onClose: () => void; onGuide: () => void }) {
  const [step, setStep] = useState(0)
  const last = step === STEPS.length - 1
  const current = STEPS[step]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setStep((s) => Math.min(s + 1, STEPS.length - 1))
      else if (e.key === 'ArrowLeft') setStep((s) => Math.max(s - 1, 0))
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:items-center sm:p-10">
      <div role="dialog" aria-modal="true" aria-label="mic gnome in five steps"
        className="w-full max-w-2xl border border-rule bg-paper p-5">
        <div className="flex items-baseline justify-between border-b border-ink pb-2">
          <h2 className="m-0 text-lg font-medium tracking-tight">mic gnome in five steps</h2>
          <button type="button" onClick={onClose} className="label underline hover:text-orange">close</button>
        </div>

        {/* The tiles: progress and navigation in one strip. */}
        <ol className="m-0 mt-4 grid list-none grid-cols-5 gap-1.5 p-0" aria-label="steps">
          {STEPS.map((s, i) => {
            const on = i === step
            const done = i < step
            return (
              <li key={s.title}>
                <button type="button" onClick={() => setStep(i)} aria-current={on ? 'step' : undefined}
                  className={`flex h-full w-full flex-col items-center gap-1.5 border px-1 py-2.5 text-center transition-colors sm:items-start sm:px-3 sm:text-left ${
                    on ? 'border-orange bg-orange-soft text-orange' : done ? 'border-rule text-ink hover:border-orange' : 'border-rule-soft text-mute hover:border-rule hover:text-ink'
                  }`}>
                  <span className="flex items-center gap-2">
                    <span className="data">{i + 1}</span>
                    <span className={on ? 'text-orange' : done ? 'text-ink' : 'text-mute'}>{TILE_GLYPHS[i]}</span>
                  </span>
                  <span className="data hidden leading-tight sm:block">{s.title}</span>
                </button>
              </li>
            )
          })}
        </ol>

        {/* The step itself. */}
        <div className="mt-4 flex flex-col gap-4 border border-rule-soft p-4 sm:min-h-[176px] sm:flex-row sm:items-start sm:gap-6">
          {PICTURES[step]}
          <div className="min-w-0 flex-1">
            <p className="label m-0">step {step + 1} of {STEPS.length} · {current.where}</p>
            <h3 className="data m-0 mt-1 text-[15px] font-medium">{current.title}</h3>
            <p className="label m-0 mt-2 leading-relaxed">{current.body}</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setStep((s) => Math.max(s - 1, 0))} disabled={step === 0}
            className="data border border-rule px-3 py-2 tracking-wider hover:border-orange disabled:opacity-30 disabled:hover:border-rule">
            back
          </button>
          {last ? (
            <button type="button" onClick={onClose}
              className="data border border-orange bg-orange px-4 py-2 tracking-wider text-white">
              start
            </button>
          ) : (
            <button type="button" onClick={() => setStep((s) => s + 1)}
              className="data border border-orange bg-orange px-4 py-2 tracking-wider text-white">
              next
            </button>
          )}
          <button type="button" onClick={onGuide} className="label ml-auto underline hover:text-orange">
            the full guide →
          </button>
        </div>
      </div>
    </div>
  )
}
