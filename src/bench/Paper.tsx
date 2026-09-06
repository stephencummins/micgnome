/**
 * The bottom of the left column: the two printable versions of the manual, and
 * the tip jar.
 *
 * They live here rather than only inside the guide because that is two clicks
 * deep, and these are the things people have actually asked for — a reference
 * they can hold, and somewhere to pay for it if they want to. Each carries a
 * small drawing for the same reason the pack cards do: a shape is quicker to
 * find again than a line of text.
 */
import { Glyph } from './Glyphs'
import { KOFI } from '../site'

function Row({
  href,
  glyph,
  title,
  note,
  accent,
}: {
  href: string
  glyph: 'sheet' | 'booklet' | 'cup'
  title: string
  note: string
  accent?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex items-start gap-2.5 border border-rule px-2.5 py-2 hover:border-orange ${
        accent ? 'text-orange' : 'hover:text-orange'
      }`}>
      <Glyph name={glyph} size={20} className="mt-0.5 shrink-0" />
      <span className="min-w-0">
        <span className="data block font-medium leading-tight">{title}</span>
        <span className="label block leading-snug text-mute">{note}</span>
      </span>
    </a>
  )
}

export function Paper() {
  return (
    <div>
      <div className="label mb-2">on paper</div>
      <div className="flex flex-col gap-1.5">
        <Row href="/zine" glyph="sheet" title="the manual" note="every block and rule on one a4 sheet" />
        <Row
          href="/zine-booklet"
          glyph="booklet"
          title="the booklet"
          note="eight pages — two sheets folded, fits in the case"
        />
        <Row href={KOFI} glyph="cup" title="tip jar" note="mic gnome and the manual are free" accent />
      </div>
    </div>
  )
}
