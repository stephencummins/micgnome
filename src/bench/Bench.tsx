import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { MicDisk } from '../fxmic/disk'
import { applyEncoding, encodedBytes, fit, nativeEncoding, type FitPlan } from '../fxmic/fit'
import { parseConfig } from '../fxmic/parse'
import { blankConfig, serialize } from '../fxmic/serialize'
import { LIMITS } from '../fxmic/spec'
import type { Config, DiskFile } from '../fxmic/types'
import { validate } from '../fxmic/validate'
import { checkPlayable, decodeWav, encodeWav, WavError } from '../fxmic/wav'
import { Chain } from './Chain'
import { HandleMap } from './HandleMap'
import { HowTo } from './HowTo'
import { Guide } from './Tour'
import { stepStatuses } from './progress'
import { ThemeToggle } from './Theme'
import { Library } from './Library'
import { Mark } from './Mark'
import { Modulation } from './Modulation'
import { SampleBay, type Source } from './SampleBay'
import { Verdict } from './Verdict'
import { WriteDialog } from './WriteDialog'
import { Downloads } from './Downloads'
import type { BenchState } from './state'
import { historyReduce, initialHistory } from './history'
import { decodePack, encodePack, shareUrl } from './share'

const initial: BenchState = { config: blankConfig(), selected: 0, handle: 0, dirty: false }
type Tab = 'chain' | 'samples' | 'library'

export function Bench() {
  const [history, dispatch] = useReducer(historyReduce, initial, initialHistory)
  const state = history.present
  const canUndo = history.past.length > 0
  const canRedo = history.future.length > 0
  const [disk] = useState(() => MicDisk.virtual())
  const [diskFiles, setDiskFiles] = useState<DiskFile[]>([])
  const [sources, setSources] = useState(new Map<string, Source>())
  const [plan, setPlan] = useState<FitPlan>()
  const [tab, setTab] = useState<Tab>('chain')
  const [writing, setWriting] = useState(false)
  const [focus, setFocus] = useState<string>()
  const [note, setNote] = useState<string>()
  // Shown unprompted the first time only. Someone landing here cold has no idea
  // what an fx-mic config is; someone on their fifth visit does not need telling.
  // "how it works" docks beside the bench on a first visit; the full guide is a
  // modal one link behind it.
  const [guideOpen, setGuideOpen] = useState(() => {
    try {
      return localStorage.getItem('micgnome.how-to-seen') !== '1'
    } catch {
      return true
    }
  })
  const [fullGuide, setFullGuide] = useState(false)
  const [written, setWritten] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  const closeGuide = () => {
    try {
      localStorage.setItem('micgnome.how-to-seen', '1')
    } catch {
      /* private window — not showing it again this session is enough */
    }
    setGuideOpen(false)
  }

  const refresh = useCallback(async () => setDiskFiles(await disk.files()), [disk])
  useEffect(() => {
    void refresh()
  }, [refresh])

  // A link with a pack in it opens with that pack on the bench — on arrival,
  // and again if a new link is pasted into a tab that already has the bench up.
  // The fragment is cleared afterwards so a reload does not throw away edits.
  useEffect(() => {
    let cancelled = false
    async function openFromHash() {
      const json = await decodePack(location.hash)
      if (json === undefined || cancelled) return
      const parsed = parseConfig(json)
      if (parsed.value === undefined) {
        setNote('That link had a pack in it, but it could not be read.')
      } else {
        dispatch({ type: 'load', config: parsed.value as Config })
        setNote(
          parsed.repairs.length
            ? `Opened a shared pack after ${parsed.repairs.length} repair(s): ${parsed.repairs.map((r) => r.description).join(' ')}`
            : `Opened a shared pack: ${(parsed.value as Config).name ?? 'untitled'}.`,
        )
      }
      window.history.replaceState(null, '', location.pathname + location.search)
    }
    void openFromHash()
    window.addEventListener('hashchange', openFromHash)
    return () => {
      cancelled = true
      window.removeEventListener('hashchange', openFromHash)
    }
  }, [])

  // Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z (or Ctrl+Y). Text fields keep their own
  // undo, so the shortcut is left alone while one has focus.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      const target = e.target as HTMLElement | null
      const typing = target instanceof HTMLTextAreaElement
        || (target instanceof HTMLInputElement && !['range', 'checkbox', 'file'].includes(target.type))
      if (typing) return
      const key = e.key.toLowerCase()
      if (key === 'z' && e.shiftKey) dispatch({ type: 'redo' })
      else if (key === 'z') dispatch({ type: 'undo' })
      else if (key === 'y') dispatch({ type: 'redo' })
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function share() {
    const url = shareUrl(await encodePack(state.config))
    try {
      await navigator.clipboard.writeText(url)
      setNote(`Link copied — ${url.length} characters, and the whole pack is in it. Anyone who opens it gets this bench.`)
    } catch {
      setNote(url)
    }
  }

  const samples = useMemo(() => state.config.samples ?? [], [state.config.samples])
  const configText = useMemo(() => serialize(state.config), [state.config])

  /** What would actually land on the disk, so the meter and the validator agree. */
  const packFiles = useMemo(() => {
    const files: { name: string; data: Uint8Array }[] = []
    for (const sample of samples) {
      const source = sources.get(sample.file)
      if (!source || source.problem) continue
      const audio = applyEncoding(source.audio, source.encoding)
      files.push({ name: sample.file, data: encodeWav(audio, source.encoding.bitDepth, source.encoding.float) })
    }
    return files
  }, [samples, sources])

  const report = useMemo(() => {
    const files: DiskFile[] = packFiles.map((f) => ({ name: f.name, bytes: f.data.byteLength }))
    files.push({ name: 'config.json', bytes: new TextEncoder().encode(configText).byteLength })
    return validate(state.config, { files })
  }, [state.config, packFiles, configText])

  const preset = state.config.presets[state.selected]
  const progress = useMemo(() => stepStatuses(state.config, { written, downloaded }), [state.config, written, downloaded])
  const chooseTab = (t: Tab) => {
    setTab(t)
    // Below the desktop breakpoint the guide sits where the tab content goes,
    // so choosing a tab means "show me the tab", not both.
    if (guideOpen && !window.matchMedia('(min-width: 64rem)').matches) closeGuide()
  }
  const guide = (
    <Guide status={progress} tab={tab} onClose={closeGuide} onFullGuide={() => setFullGuide(true)}
      onGoTo={(t) => chooseTab(t as Tab)} />
  )
  const configBytes = new TextEncoder().encode(configText).byteLength

  async function addSample(file: File) {
    setNote(undefined)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const { audio, format } = decodeWav(bytes)
      const problem = checkPlayable(format)
      const encoding = nativeEncoding(audio, format.float ? 16 : format.bitDepth, false)
      const source: Source = { audio, format, encoding, bytes: encodedBytes(audio, encoding), problem }
      setSources((current) => new Map(current).set(file.name, source))
      dispatch({ type: 'add-sample', file: file.name, playmode: 'oneshot' })
      setPlan(undefined)
      if (problem) setNote(problem)
    } catch (e) {
      setNote(e instanceof WavError ? e.message : `Could not read ${file.name}.`)
    }
  }

  function runFit() {
    const slots = samples
      .map((s) => ({ id: s.file, audio: sources.get(s.file)?.audio }))
      .filter((s): s is { id: string; audio: NonNullable<typeof s.audio> } => Boolean(s.audio))
    if (!slots.length) return

    const next = fit(slots, LIMITS.storageBytes, configBytes)
    setSources((current) => {
      const map = new Map(current)
      for (const slotPlan of next.slots) {
        const source = map.get(slotPlan.id)
        if (source) map.set(slotPlan.id, { ...source, encoding: slotPlan.encoding, bytes: slotPlan.bytes })
      }
      return map
    })
    setPlan(next)
  }

  async function importConfig(file: File) {
    const parsed = parseConfig(await file.text())
    if (parsed.value === undefined) {
      setNote(parsed.diagnostics[0]?.message ?? 'That file could not be read.')
      return
    }
    dispatch({ type: 'load', config: parsed.value as Config })
    setNote(
      parsed.repairs.length
        ? `Opened after ${parsed.repairs.length} repair(s): ${parsed.repairs.map((r) => r.description).join(' ')}`
        : `Opened ${file.name}.`,
    )
  }

  const blocked = report.diagnostics.some((d) => d.severity === 'error')

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 flex flex-wrap items-baseline justify-between gap-3 border-b border-rule bg-paper px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <Mark />
          <b className="tracking-tight">
            mic <span className="text-orange">gnome</span>
          </b>
          <input aria-label="pack name" value={state.config.name ?? ''}
            onChange={(e) => dispatch({ type: 'set-pack-name', name: e.target.value })}
            className="data w-56 border-b border-rule bg-transparent px-1 py-0.5" />
        </div>
        <div className="label flex flex-wrap items-center gap-x-4 gap-y-1 whitespace-nowrap">
          <span>{disk.label} · {kb(diskFiles.reduce((n, f) => n + f.bytes, 0))} on disk</span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => dispatch({ type: 'undo' })} disabled={!canUndo}
              title="undo (⌘Z)" className="underline hover:text-orange disabled:no-underline disabled:opacity-40">
              undo
            </button>
            <button type="button" onClick={() => dispatch({ type: 'redo' })} disabled={!canRedo}
              title="redo (⇧⌘Z)" className="underline hover:text-orange disabled:no-underline disabled:opacity-40">
              redo
            </button>
          </span>
          <button type="button" onClick={() => void share()} title="copy a link that carries this whole pack"
            className="underline hover:text-orange">
            share
          </button>
          <ThemeToggle />
          <button type="button" onClick={() => setGuideOpen((o) => !o)} className="underline hover:text-orange">
            how to use
          </button>
          <label className="cursor-pointer underline hover:text-orange"
            title="Open a config.json you already have. You do not need one to start — Mic Gnome writes it for you.">
            import config
            <input type="file" accept=".json,application/json" className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importConfig(file)
                e.target.value = ''
              }} />
          </label>
          <a href="https://stephen8n.com" target="_blank" rel="noreferrer noopener"
            className="underline hover:text-orange" title="more from Stephen Cummins">
            stephen8n
          </a>
        </div>
      </header>

      <PreviewStrip />

      {note && (
        <p className="data flex items-baseline justify-between gap-3 border-b border-rule bg-orange-soft px-4 py-2 text-orange">
          {note}
          <button type="button" onClick={() => setNote(undefined)} className="label underline">dismiss</button>
        </p>
      )}

      <main className={`grid min-h-[calc(100dvh-49px)] gap-px bg-rule ${
        guideOpen ? 'lg:grid-cols-[270px_minmax(0,1fr)_300px]' : 'lg:grid-cols-[270px_minmax(0,1fr)]'
      }`}>
        <section className="bg-paper p-4">
          <div className="label mb-2">presets · orange button</div>
          <div className="flex flex-col gap-1">
            {state.config.presets.map((p, i) => (
              <button key={i} type="button" onClick={() => dispatch({ type: 'select', index: i })}
                className={`data flex items-center justify-between border px-2 py-1.5 text-left ${
                  i === state.selected ? 'border-orange bg-orange-soft text-orange' : 'border-rule-soft hover:border-rule'
                }`}>
                <span>{p.pos ?? i} {p.name ?? 'untitled'}</span>
                <span aria-hidden>{i === state.selected ? '◆' : ''}</span>
              </button>
            ))}
            {state.config.presets.length < LIMITS.presets && (
              <button type="button" onClick={() => dispatch({ type: 'add-preset' })}
                className="data border border-dashed border-orange/60 px-2 py-1.5 text-orange hover:border-orange hover:bg-orange-soft">
                + preset
              </button>
            )}
            {state.config.presets.length > 1 && (
              <button type="button" onClick={() => dispatch({ type: 'remove-preset', index: state.selected })}
                className="label mt-1 underline hover:text-orange">remove this preset</button>
            )}
          </div>

          <button type="button" onClick={() => setTab('samples')}
            className="label mt-6 mb-2 block w-full text-left underline hover:text-orange">
            samples · white button
          </button>
          <div className="flex flex-col gap-1">
            {samples.map((s, i) => (
              <div key={s.file} className="data flex justify-between border border-rule-soft px-2 py-1.5">
                <span className="truncate">{s.pos ?? i} {s.file}</span>
                <span className="text-mute">{kb(sources.get(s.file)?.bytes ?? 0)}</span>
              </div>
            ))}
            {!samples.length && <p className="label leading-relaxed">none — using the four factory sounds</p>}
          </div>

          {/* The handle and the write panel live down here rather than in a column
              of their own: together they are shorter than the preset list on most
              packs, and the column they used to take is better spent on the guide. */}
          <div className="mt-6 flex flex-col gap-4 border-t border-rule-soft pt-4">
          <div>
            <div className="label mb-2">handle</div>
            <input type="range" min={0} max={1} step={0.01} value={state.handle}
              aria-label="handle position"
              onChange={(e) => dispatch({ type: 'set-handle', value: Number(e.target.value) })} />
            <div className="data text-right text-orange">{Math.round(state.handle * 100)}%</div>
          </div>

          {preset && <HandleMap preset={preset} handle={state.handle} />}

          <div>
            <div className="label mb-2">write</div>
            <Verdict report={report} onJump={setFocus} />
            <button type="button" onClick={() => setWriting(true)} disabled={blocked}
              className="data mt-2 w-full border border-orange bg-orange px-3 py-2 tracking-wider text-white disabled:opacity-40">
              write to {disk.label}
            </button>
            <Downloads configText={configText} files={packFiles} blocked={blocked} onDownload={() => setDownloaded(true)} />
          </div>
          </div>
        </section>

        <section className="bg-paper p-4">
          <div className="mb-4 flex gap-4 border-b border-rule-soft">
            {(['chain', 'samples', 'library'] as const).map((t) => (
              <button key={t} type="button" onClick={() => chooseTab(t)}
                className={`data -mb-px border-b-2 px-1 pb-2 ${
                  tab === t ? 'border-orange text-orange' : 'border-transparent text-mute hover:text-ink'
                }`}>
                {t}
              </button>
            ))}
            <button type="button" onClick={() => (guideOpen ? closeGuide() : setGuideOpen(true))}
              aria-pressed={guideOpen}
              className={`data -mb-px ml-auto border-b-2 px-1 pb-2 ${
                guideOpen ? 'border-orange text-orange' : 'border-transparent text-mute hover:text-ink'
              }`}>
              how it works
            </button>
          </div>

          {/* Below the desktop breakpoint there is no room beside the bench, so the
              guide takes the tab area instead. */}
          {guideOpen && <div className="lg:hidden">{guide}</div>}

          <div className={guideOpen ? 'hidden lg:block' : ''}>
          {tab === 'library' ? (
            <Library dirty={state.dirty} dispatch={dispatch} />
          ) : tab === 'chain' ? (
            preset ? (
              <div className="flex max-w-3xl flex-col gap-5">
                <div className="flex flex-wrap items-baseline gap-3">
                  <input aria-label="preset name" value={preset.name ?? ''}
                    onChange={(e) => dispatch({ type: 'set-preset-field', field: 'name', value: e.target.value })}
                    className="border-b border-rule bg-transparent py-0.5 text-lg font-medium tracking-tight" />
                  <input aria-label="preset comment" placeholder="what it does" value={preset.comment ?? ''}
                    onChange={(e) => dispatch({ type: 'set-preset-field', field: 'comment', value: e.target.value })}
                    className="label flex-1 border-b border-rule-soft bg-transparent py-0.5" />
                </div>
                <Chain preset={preset} dispatch={dispatch} focus={focus} />
                <Modulation preset={preset} dispatch={dispatch} />
              </div>
            ) : (
              <p className="label">no presets. add one on the left.</p>
            )
          ) : (
            <div className="max-w-3xl">
              <SampleBay samples={samples} sources={sources} budget={LIMITS.storageBytes}
                configBytes={configBytes} plan={plan} dispatch={dispatch}
                onDrop={(file) => void addSample(file)} onFit={runFit} />
            </div>
          )}
          </div>
        </section>


        {guideOpen && <aside className="hidden bg-paper p-4 lg:block">{guide}</aside>}
      </main>

      {/* Always reachable. The header link is easy to miss, and the moment someone
          wants the recovery instruction is the moment they are least able to hunt. */}
      <button type="button" onClick={() => setGuideOpen((o) => !o)} title="How to use Mic Gnome"
        aria-label="How to use Mic Gnome"
        className="fixed bottom-4 right-4 z-30 flex h-10 w-10 items-center justify-center border border-orange bg-paper text-base text-orange shadow-[0_1px_6px_rgba(0,0,0,0.08)] hover:bg-orange hover:text-white">
        <span aria-hidden className="font-mono">?</span>
      </button>

      {fullGuide && (
        <HowTo onClose={() => setFullGuide(false)}
          onTour={() => {
            setFullGuide(false)
            setGuideOpen(true)
          }} />
      )}

      {writing && (
        <WriteDialog disk={disk} config={state.config} report={report} files={packFiles}
          onWritten={() => setWritten(true)}
          onClose={() => {
            setWriting(false)
            void refresh()
          }} />
      )}
    </div>
  )
}

/**
 * The site is live before the hardware is. Everything on it writes to a
 * simulated mic, and saying so plainly is cheaper than an email from someone
 * who assumed otherwise. This comes out when the real-disk path lands.
 */
function PreviewStrip() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('micgnome.preview-dismissed') === '1'
    } catch {
      return false
    }
  })
  if (hidden) return null
  return (
    <p className="label flex items-baseline justify-between gap-4 border-b border-rule bg-panel px-4 py-2 leading-relaxed">
      <span>
        preview — the mic here is a <b className="font-medium text-orange">simulation</b>, accurate to the guide but
        not to the hardware. to put a pack on a real fx-mic, download the files under the write button and drop
        them onto its disk.
      </span>
      <button type="button" className="shrink-0 underline hover:text-orange"
        onClick={() => {
          try {
            localStorage.setItem('micgnome.preview-dismissed', '1')
          } catch {
            /* private window — hiding for this session is enough */
          }
          setHidden(true)
        }}>
        got it
      </button>
    </p>
  )
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} kb`
