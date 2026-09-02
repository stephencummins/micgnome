import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import { MicDisk } from '../fxmic/disk'
import { parseConfig } from '../fxmic/parse'
import { blankConfig } from '../fxmic/serialize'
import { LIMITS } from '../fxmic/spec'
import type { Config, DiskFile } from '../fxmic/types'
import { validate } from '../fxmic/validate'
import { Chain } from './Chain'
import { HandleMap } from './HandleMap'
import { Modulation } from './Modulation'
import { Verdict } from './Verdict'
import { WriteDialog } from './WriteDialog'
import { reduce, type BenchState } from './state'

const initial: BenchState = { config: blankConfig('PIER AT NIGHT'), selected: 0, handle: 0 }

export function Bench() {
  const [state, dispatch] = useReducer(reduce, initial)
  const [disk] = useState(() => MicDisk.virtual())
  const [files, setFiles] = useState<DiskFile[]>([])
  const [writing, setWriting] = useState(false)
  const [focus, setFocus] = useState<string>()

  const refresh = useCallback(async () => setFiles(await disk.files()), [disk])
  useEffect(() => {
    void refresh()
  }, [refresh])

  const report = useMemo(() => validate(state.config, { files }), [state.config, files])
  const preset = state.config.presets[state.selected]
  const used = files.reduce((n, f) => n + f.bytes, 0)

  async function importFile(file: File) {
    const parsed = parseConfig(await file.text())
    if (parsed.value === undefined) {
      alert(parsed.diagnostics[0]?.message ?? 'That file could not be read.')
      return
    }
    dispatch({ type: 'load', config: parsed.value as Config })
    if (parsed.repairs.length) {
      // Repairs are reported, never silent — the file on disk is untouched.
      alert(`Opened, after ${parsed.repairs.length} repair(s):\n\n${parsed.repairs.map((r) => r.description).join('\n')}`)
    }
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 flex flex-wrap items-baseline justify-between gap-3 border-b border-rule bg-paper px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <b className="tracking-tight">mic gnome</b>
          <input aria-label="pack name" value={state.config.name ?? ''}
            onChange={(e) => dispatch({ type: 'set-pack-name', name: e.target.value })}
            className="data w-48 border-b border-rule bg-transparent px-1 py-0.5" />
        </div>
        <div className="label flex items-center gap-4">
          <span>{disk.label} · {kb(used)} / {kb(LIMITS.storageBytes)}</span>
          <label className="cursor-pointer underline hover:text-orange">
            import
            <input type="file" accept=".json,application/json" className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void importFile(file)
                e.target.value = ''
              }} />
          </label>
        </div>
      </header>

      <main className="grid min-h-[calc(100dvh-49px)] gap-px bg-rule lg:grid-cols-[190px_minmax(0,1fr)_290px]">
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
                className="data border border-dashed border-rule px-2 py-1.5 hover:border-orange hover:text-orange">
                + preset
              </button>
            )}
            {state.config.presets.length > 1 && (
              <button type="button" onClick={() => dispatch({ type: 'remove-preset', index: state.selected })}
                className="label mt-1 underline hover:text-orange">remove this preset</button>
            )}
          </div>

          <div className="label mt-6 mb-2">samples · white button</div>
          <div className="flex flex-col gap-1">
            {(state.config.samples ?? []).map((s, i) => (
              <div key={i} className="data flex justify-between border border-rule-soft px-2 py-1.5">
                <span>{s.pos ?? i} {s.file}</span>
                <span className="text-mute">{s.playmode?.slice(0, 4)}</span>
              </div>
            ))}
            {!state.config.samples?.length && (
              <p className="label leading-relaxed">
                no samples declared, so the mic uses its four factory sounds. a SAMPLE row is still required.
              </p>
            )}
          </div>
        </section>

        <section className="bg-paper p-4">
          {preset ? (
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
          )}
        </section>

        <section className="flex flex-col gap-4 bg-paper p-4">
          <div>
            <div className="label mb-2">handle</div>
            <input type="range" min={0} max={1} step={0.01} value={state.handle}
              aria-label="handle position"
              onChange={(e) => dispatch({ type: 'set-handle', value: Number(e.target.value) })} />
            <div className="data text-right">{Math.round(state.handle * 100)}%</div>
          </div>

          {preset && <HandleMap preset={preset} handle={state.handle} />}

          <div>
            <div className="label mb-2">write</div>
            <Verdict report={report} onJump={setFocus} />
            <button type="button" onClick={() => setWriting(true)}
              className="data mt-2 w-full border border-orange bg-orange px-3 py-2 tracking-wider text-white disabled:opacity-40"
              disabled={report.diagnostics.some((d) => d.severity === 'error')}>
              write to fx-mic
            </button>
          </div>
        </section>
      </main>

      {writing && (
        <WriteDialog disk={disk} config={state.config} report={report}
          onClose={() => {
            setWriting(false)
            void refresh()
          }} />
      )}
    </div>
  )
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} kb`
