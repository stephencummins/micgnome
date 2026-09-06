/**
 * The gnome's one server-side endpoint.
 *
 * Everything else in Mic Gnome runs in the browser and talks to your disk. This
 * exists only because a model call needs a credential the browser must not
 * hold. It stays stateless: the conversation lives in the visitor's tab, and
 * nothing about it is stored here.
 *
 * The proposals it returns are NOT applied here. They come back as data, the
 * browser replays them into a throwaway copy of the bench, and the validator
 * decides whether the person is even offered an Apply button. See src/gnome/apply.ts.
 */
import { parseReply } from '../../src/gnome/protocol'
import { buildSystemPrompt } from '../../src/gnome/prompt'
import { routeSkill, skillById } from '../../src/gnome/skills'
import type { SkillId } from '../../src/gnome/skills'
import type { BenchState } from '../../src/bench/state'

interface Env {
  AI: { run: (model: string, input: unknown) => Promise<unknown> }
  /**
   * Turnstile secret. Required — without it the endpoint refuses to serve,
   * because an open model endpoint on a public site is somebody else's free
   * inference. For local development use Cloudflare's documented always-passes
   * test secret: 1x0000000000000000000000000000000AA
   */
  TURNSTILE_SECRET?: string
  /** Override the model without a code change, for trying a different one. */
  GNOME_MODEL?: string
}

/**
 * Chosen by trying the alternatives against the real prompt, not from the
 * catalogue. The reasoning models on the free tier (glm-4.7-flash,
 * gemma-4-26b) spend the whole token budget deliberating and then return an
 * empty answer with finish_reason "length" — the thinking comes out of the same
 * allowance as the reply. A straight instruct model answers immediately, in the
 * right voice, for a fraction of the output tokens.
 *
 * Swapping is this one line, or the GNOME_MODEL binding without a deploy.
 */
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

/** The visitor's own words, capped. Long enough to describe a sound, short enough to bound cost. */
const MAX_MESSAGE = 600
/**
 * How much conversation to carry. Elf keeps 20; the allowance here is shared by
 * every visitor to a public site, so it keeps far less.
 */
const MAX_TURNS = 8

interface Body {
  messages?: { role?: unknown; content?: unknown }[]
  bench?: BenchState
  skill?: SkillId
  token?: string
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

async function verifyTurnstile(secret: string, token: string, ip: string | null): Promise<boolean> {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret, response: token, ...(ip && { remoteip: ip }) }),
    })
    const out = (await res.json()) as { success?: boolean }
    return out.success === true
  } catch {
    return false
  }
}

/**
 * Dig the reply out of whatever the model handed back.
 *
 * Workers AI returns `{ response }` for some models and an OpenAI-shaped
 * `{ choices: [{ message: { content } }] }` for others, and a reasoning model
 * may put its thinking in `reasoning` and leave `content` null when it runs out
 * of room. Returns undefined when there is genuinely nothing to show.
 */
function contentFrom(raw: unknown): unknown {
  if (typeof raw === 'string') return raw
  if (typeof raw !== 'object' || raw === null) return undefined

  const asChat = raw as { choices?: { message?: { content?: unknown } }[]; response?: unknown }
  const content = asChat.choices?.[0]?.message?.content
  if (typeof content === 'string' && content.trim() !== '') return content
  if (content && typeof content === 'object') return content

  const response = asChat.response
  if (typeof response === 'string' && response.trim() !== '') return response
  if (response && typeof response === 'object') return response

  return undefined
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  if (!env.TURNSTILE_SECRET) {
    return json(
      { error: 'The gnome is not configured on this deployment yet.', configured: false },
      503,
    )
  }

  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return json({ error: 'Bad request.' }, 400)
  }

  const ok = await verifyTurnstile(
    env.TURNSTILE_SECRET,
    typeof body.token === 'string' ? body.token : '',
    request.headers.get('cf-connecting-ip'),
  )
  if (!ok) return json({ error: 'Could not confirm you are a person. Reload the page and try again.' }, 403)

  // Accept only what we can use, and only as much of it as we asked for.
  const history = (Array.isArray(body.messages) ? body.messages : [])
    .filter(
      (m): m is { role: 'user' | 'assistant'; content: string } =>
        (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== '',
    )
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE) }))

  if (history.length === 0 || history[history.length - 1].role !== 'user') {
    return json({ error: 'Nothing to answer.' }, 400)
  }
  if (!body.bench || !Array.isArray(body.bench.config?.presets)) {
    return json({ error: 'Bad request.' }, 400)
  }

  const latest = history[history.length - 1].content
  // The client tells us where the conversation was; the router may move it, and
  // stays put when nothing in the new message pulls elsewhere.
  const chosen = routeSkill(latest, skillById(body.skill ?? '')?.id)

  let raw: unknown
  try {
    // Deliberately NOT sending response_format. Constraining generation to the
    // reply schema made every model return only the required field — "say" —
    // and silently drop the actions, which is the entire feature. The contract
    // is taught in the prompt and enforced after the fact by parseReply, which
    // is strict about shape and lenient about wrapping.
    raw = await env.AI.run(env.GNOME_MODEL || MODEL, {
      messages: [{ role: 'system', content: buildSystemPrompt(chosen, body.bench) }, ...history],
      // Enough for a paragraph and a handful of actions. The model does not
      // reason aloud, so this is the reply itself rather than a thinking budget.
      max_tokens: 1024,
    })
  } catch (err) {
    // 3036 is the daily free allowance; 3040 is no capacity. Both are "come back
    // later", and both must read as the gnome resting rather than the site being
    // broken — everything else on the page works without a model.
    const text = err instanceof Error ? err.message : String(err)
    if (/3036|3040|429|capacity|neuron/i.test(text)) {
      return json({ exhausted: true, error: 'The gnome has done all his thinking for today.' }, 429)
    }
    return json({ error: 'The gnome could not answer just now.' }, 502)
  }

  const payload = contentFrom(raw)
  if (payload === undefined) {
    // Logged, never returned: the model's raw output is useful for tuning and is
    // not something to hand back to a browser.
    console.warn('gnome: nothing to show', JSON.stringify(raw).slice(0, 700))
    // Reasoning models spend budget thinking before they write anything. If the
    // answer was cut off mid-thought there is nothing to show, and saying so is
    // better than rendering an empty bubble.
    return json({ error: 'The gnome thought about it for too long. Ask again, more simply.' }, 502)
  }
  const parsed = parseReply(payload)
  if (!parsed.ok) {
    console.warn('gnome: unusable reply —', parsed.reason, String(typeof payload === 'string' ? payload : JSON.stringify(payload)).slice(0, 700))
    return json({ error: 'The gnome got muddled. Ask again, perhaps more simply.', detail: parsed.reason }, 502)
  }

  return json({ reply: parsed.reply, skill: chosen.id })
}
