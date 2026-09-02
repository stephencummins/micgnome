import { useState } from 'react'
import { CONFIG_NAME, DiskFullError, type MicDisk, type RestartResult, type Snapshot } from '../fxmic/disk'
import type { Report } from '../fxmic/diagnostics'
import { serialize } from '../fxmic/serialize'
import { RECOVERY } from '../fxmic/spec'
import type { Config } from '../fxmic/types'

type Stage = 'confirm' | 'working' | 'done' | 'failed'

/**
 * The write ritual. It is short and deliberate because it is the only
 * irreversible step: back up first, write, eject, and show what the mic did
 * when it came back — with the recovery instruction on the same screen as the
 * button that could make you need it.
 */
export function WriteDialog({
  disk,
  config,
  report,
  onClose,
}: {
  disk: MicDisk
  config: Config
  report: Report
  onClose: () => void
}) {
  const [stage, setStage] = useState<Stage>('confirm')
  const [backup, setBackup] = useState<Snapshot>()
  const [result, setResult] = useState<RestartResult>()
  const [error, setError] = useState<string>()

  const blocked = report.diagnostics.some((d) => d.severity === 'error')

  async function write() {
    setStage('working')
    setError(undefined)
    try {
      const snapshot = await disk.snapshot()
      setBackup(snapshot)
      await disk.write(CONFIG_NAME, serialize(config))
      const restart = await disk.eject()
      setResult(restart)
      setStage(restart.booted ? 'done' : 'failed')
    } catch (e) {
      setError(
        e instanceof DiskFullError
          ? e.message
          : `The write did not finish: ${e instanceof Error ? e.message : String(e)}`,
      )
      setStage('failed')
    }
  }

  async function restore() {
    if (!backup) return
    setStage('working')
    await disk.restore(backup)
    await disk.recover()
    setResult(await disk.eject())
    setStage('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-10">
      <div role="dialog" aria-modal="true" aria-label="write to fx-mic"
        className="w-full max-w-lg border border-rule bg-paper p-5">
        <div className="flex items-baseline justify-between border-b border-ink pb-2">
          <h2 className="m-0 text-lg font-medium tracking-tight">write to {disk.label}</h2>
          <button type="button" onClick={onClose} className="label underline hover:text-orange">close</button>
        </div>

        {stage === 'confirm' && (
          <div className="mt-4 flex flex-col gap-3">
            <ol className="m-0 flex list-none flex-col gap-2 p-0">
              <Step n="1">back up everything already on the disk, so putting it back is one click</Step>
              <Step n="2">write {CONFIG_NAME} and any samples</Step>
              <Step n="3">eject, and wait for the mic to restart — do not pull the cable</Step>
            </ol>
            {blocked ? (
              <p className="data bg-orange-soft px-2 py-1.5 text-orange">
                the validator found errors. fix those first — this is exactly the file that stops the mic booting.
              </p>
            ) : (
              <button type="button" onClick={write}
                className="data w-full border border-orange bg-orange px-3 py-2 tracking-wider text-white">
                write and eject
              </button>
            )}
          </div>
        )}

        {stage === 'working' && <p className="data mt-4">writing…</p>}

        {stage === 'done' && result && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="data bg-pass-soft px-2 py-1.5 text-pass">
              ✓ the mic restarted and loaded {result.packName ?? 'your pack'}
            </p>
            {result.report && result.report.diagnostics.length > 0 && (
              <p className="label">{result.report.diagnostics.length} thing(s) still flagged — see the verdict panel</p>
            )}
            <TipJar />
            <button type="button" onClick={onClose} className="data mt-1 border border-rule px-3 py-2">done</button>
          </div>
        )}

        {stage === 'failed' && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="data bg-orange-soft px-2 py-2 text-orange">
              {error ?? result?.reason ?? 'the mic did not come back.'}
            </p>
            <div className="border border-orange p-3">
              <p className="label m-0 mb-1 text-orange">recovery</p>
              <p className="data m-0 leading-relaxed">{result?.recovery ?? RECOVERY}</p>
            </div>
            {backup && (
              <button type="button" onClick={restore}
                className="data w-full border border-ink px-3 py-2 tracking-wider">
                put the disk back how it was
              </button>
            )}
            <button type="button" onClick={onClose} className="label underline">close</button>
          </div>
        )}
      </div>
    </div>
  )
}

function Step({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <li className="data flex gap-3 border-b border-rule-soft pb-2">
      <span className="text-orange">{n}</span>
      <span>{children}</span>
    </li>
  )
}

/**
 * The only place a tip is ever asked for: straight after it worked. Never a
 * modal on arrival, and dismissible for good.
 */
function TipJar() {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('micgnome.tip-dismissed') === '1'
    } catch {
      return false
    }
  })
  if (hidden) return null
  return (
    <p className="label flex items-baseline justify-between gap-3 border-t border-rule-soft pt-2 leading-relaxed">
      <span>
        mic gnome is free.{' '}
        <a href="https://github.com/sponsors/stephencummins" target="_blank" rel="noreferrer"
          className="text-orange underline">chip in</a>{' '}
        if it saved you an evening.
      </span>
      <button type="button" className="underline"
        onClick={() => {
          try {
            localStorage.setItem('micgnome.tip-dismissed', '1')
          } catch {
            /* private window — hiding for this session is enough */
          }
          setHidden(true)
        }}>
        no thanks
      </button>
    </p>
  )
}
