/**
 * Talking to the gnome.
 *
 * The other tabs assume you know what a chain is. This one assumes you do not,
 * and is the whole reason it exists: someone can describe a sound in their own
 * words and get a working preset without meeting a parameter.
 *
 * Two rules here, both deliberate:
 *   - the model's text is rendered as TEXT, never as HTML. This is a public
 *     site and the words come from a machine; there is no version of this worth
 *     risking innerHTML for.
 *   - nothing it proposes reaches the bench until the validator has passed it
 *     and the person has pressed Apply.
 */
import { useEffect, useRef, useState } from 'react'
import { dryRun, cautions } from '../gnome/apply'
import type { DryRun } from '../gnome/apply'
import { SKILLS, skillById } from '../gnome/skills'
import type { SkillId } from '../gnome/skills'
import type { ProposedAction } from '../gnome/protocol'
import type { Action, BenchState } from './state'
import { TURNSTILE_SITE_KEY } from '../site'

const STORAGE = 'micgnome:gnome-chat'

interface Message {
  role: 'user' | 'assistant'
  content: string
  /** Present on an assistant turn that proposed something we could actually run. */
  proposal?: { actions: ProposedAction[]; summary: string[]; cautions: string[] }
  /** Set when the gnome proposed something the validator refused. */
  refused?: boolean
  /** Things he thinks you might say next. Rendered as tappable pills, because a
   *  blank box after an answer does not read as a conversation. */
  suggest?: string[]
}

const OPENERS = [
  'I want to sound like a robot',
  'Show me some packs',
  'What does the squeeze do?',
  'How do I get this onto my mic?',
]

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; theme?: string }) => string
      reset: (id?: string) => void
    }
  }
}

export function GnomeTab({ state, dispatch }: { state: BenchState; dispatch: (a: Action) => void }) {
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE)
      return saved ? (JSON.parse(saved) as Message[]) : []
    } catch {
      return []
    }
  })
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exhausted, setExhausted] = useState(false)
  const [skill, setSkill] = useState<SkillId | undefined>()
  const [token, setToken] = useState<string | null>(null)
  const widget = useRef<HTMLDivElement>(null)
  const foot = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(messages.slice(-30)))
    } catch {
      // A full or blocked store is not a reason to lose the conversation on screen.
    }
    foot.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  // Turnstile proves there is a person here before spending the shared daily
  // allowance. Loaded only when this tab is opened, so the rest of the app stays
  // free of third-party script — most visitors never come here.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

    const draw = () => {
      if (!widget.current || !window.turnstile) return
      widget.current.replaceChildren()
      window.turnstile.render(widget.current, { sitekey: TURNSTILE_SITE_KEY, callback: setToken })
    }

    if (window.turnstile) {
      draw()
      return
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`)
    if (existing) {
      existing.addEventListener('load', draw)
      return () => existing.removeEventListener('load', draw)
    }
    const script = document.createElement('script')
    script.src = SRC
    script.async = true
    script.addEventListener('load', draw)
    document.head.append(script)
  }, [])

  async function send(text: string) {
    const clean = text.trim()
    if (!clean || busy) return
    const outgoing: Message[] = [...messages, { role: 'user', content: clean }]
    setMessages(outgoing)
    setDraft('')
    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/gnome', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: outgoing.map(({ role, content }) => ({ role, content })),
          bench: { config: state.config, selected: state.selected, handle: state.handle, dirty: state.dirty },
          skill,
          token,
        }),
      })
      const data = (await res.json()) as {
        reply?: { say: string; actions?: ProposedAction[]; suggest?: string[] }
        skill?: SkillId
        error?: string
        exhausted?: boolean
      }

      if (data.exhausted) {
        setExhausted(true)
        return
      }
      if (!res.ok || !data.reply) {
        setError(data.error ?? 'The gnome could not answer just now.')
        return
      }

      if (data.skill) setSkill(data.skill)

      // Try the proposal against a throwaway copy of the bench. Only a clean run
      // earns an Apply button.
      let proposal: Message['proposal']
      let refused = false
      if (data.reply.actions?.length) {
        const run: DryRun = dryRun(state, data.reply.actions)
        if (run.ok) {
          proposal = { actions: data.reply.actions, summary: run.summary, cautions: cautions(run) }
        } else {
          refused = true
        }
      }

      setMessages((m) => [...m, { role: 'assistant', content: data.reply!.say, proposal, refused, suggest: data.reply!.suggest }])
    } catch {
      setError('Could not reach the gnome. Check your connection and try again.')
    } finally {
      setBusy(false)
      window.turnstile?.reset()
    }
  }

  function apply(proposal: NonNullable<Message['proposal']>) {
    for (const action of proposal.actions) dispatch(action)
    setMessages((m) => [...m, { role: 'assistant', content: 'Done. Have a listen, and tell me what to change.' }])
  }

  function discard(index: number) {
    setMessages((m) => m.map((msg, i) => (i === index ? { ...msg, proposal: undefined } : msg)))
  }

  const opening = skillById(skill ?? '')?.opening ?? SKILLS[1].opening

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {messages.length === 0 && (
        <div className="rounded border border-rule-soft p-4">
          <p className="mb-1 text-lg font-medium tracking-tight">The gnome</p>
          <p className="text-mute">{opening}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {OPENERS.map((o) => (
              <button key={o} type="button" onClick={() => void send(o)}
                className="label rounded-full border border-rule px-3 py-1 hover:border-orange hover:text-orange">
                {o}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'self-end max-w-[85%]' : 'max-w-[90%]'}>
            <div
              className={
                m.role === 'user'
                  ? 'rounded border border-rule px-3 py-2'
                  : 'whitespace-pre-wrap leading-relaxed'
              }
            >
              {/* Text, never HTML: these words come from a model, on a public page. */}
              {m.content}
            </div>

            {m.refused && (
              <p className="label mt-1 text-mute">
                He had an idea that would not have worked on the mic, so it was not offered. Try asking again.
              </p>
            )}

            {m.suggest && i === messages.length - 1 && !busy && (
              <div className="mt-2 flex flex-wrap gap-2">
                {m.suggest.map((sug) => (
                  <button key={sug} type="button" onClick={() => void send(sug)}
                    className="label rounded-full border border-rule px-3 py-1 hover:border-orange hover:text-orange">
                    {sug}
                  </button>
                ))}
              </div>
            )}

            {m.proposal && (
              <div className="mt-2 rounded border border-orange/60 bg-orange/5 p-3">
                <p className="label mb-2">He would like to change this</p>
                <ul className="mb-2 flex flex-col gap-1">
                  {m.proposal.summary.map((line, k) => (
                    <li key={k}>{line}</li>
                  ))}
                </ul>
                {m.proposal.cautions.length > 0 && (
                  <ul className="label mb-2 flex flex-col gap-1 text-mute">
                    {m.proposal.cautions.map((c, k) => (
                      <li key={k}>Worth knowing: {c}</li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => apply(m.proposal!)}
                    className="label rounded border border-orange px-3 py-1 text-orange hover:bg-orange hover:text-paper">
                    apply
                  </button>
                  <button type="button" onClick={() => discard(i)}
                    className="label rounded border border-rule px-3 py-1 text-mute hover:text-ink">
                    no thanks
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {busy && <p className="text-mute">thinking…</p>}
        <div ref={foot} />
      </div>

      {exhausted && (
        <div className="rounded border border-rule p-3">
          <p className="mb-1">The gnome has done all his thinking for today.</p>
          <p className="text-mute">
            He gets a fresh set of ideas at midnight. Everything else still works without him — the packs in
            the library, the guide beside the bench, and the{' '}
            <a href="/zine" className="underline">printed manual</a>.
          </p>
        </div>
      )}

      {error && <p className="text-mute">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(draft)
        }}
        className="flex gap-2 pt-1"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy || exhausted}
          placeholder="say anything — ask him a question, or tell him what to change"
          aria-label="message the gnome"
          className="flex-1 rounded border border-rule bg-transparent px-3 py-2 placeholder:text-mute focus:border-orange focus:outline-none"
        />
        <button type="submit" disabled={busy || exhausted || draft.trim() === ''}
          className="label rounded border border-rule px-3 py-1 disabled:opacity-40 hover:border-orange hover:text-orange">
          send
        </button>
      </form>

      <p className="label text-mute">
        He is a small helper and he gets things wrong. Nothing he suggests reaches your pack until you press
        apply, and anything that would stop the mic starting is refused before you see it.
      </p>

      <div ref={widget} className="opacity-70" />
    </div>
  )
}
