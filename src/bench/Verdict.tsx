import type { Diagnostic, Report } from '../fxmic/diagnostics'

/**
 * The validator's answer, directly above the write button and never behind a
 * tab. You cannot ship a file you have not been told is broken.
 */
export function Verdict({ report, onJump }: { report: Report; onJump?: (path: string) => void }) {
  const errors = report.diagnostics.filter((d) => d.severity === 'error')
  const warnings = report.diagnostics.filter((d) => d.severity === 'warning')

  return (
    <div className="flex flex-col gap-1">
      {errors.length === 0 && (
        <p className="data flex items-center gap-2 bg-pass-soft px-2 py-1.5 text-pass">
          <span aria-hidden>✓</span> safe to write
        </p>
      )}
      {errors.map((d, i) => (
        <Line key={`e${i}`} d={d} onJump={onJump} />
      ))}
      {warnings.map((d, i) => (
        <Line key={`w${i}`} d={d} onJump={onJump} />
      ))}
      {report.diagnostics.length === 0 && (
        <p className="label px-2">nothing to flag — no warnings either</p>
      )}
    </div>
  )
}

function Line({ d, onJump }: { d: Diagnostic; onJump?: (path: string) => void }) {
  const error = d.severity === 'error'
  const Tag = onJump && d.path ? 'button' : 'div'
  return (
    <Tag
      {...(onJump && d.path ? { onClick: () => onJump(d.path), type: 'button' as const } : {})}
      className={`data block w-full px-2 py-1.5 text-left ${
        error ? 'bg-orange-soft text-orange' : 'border border-rule-soft text-mute'
      }`}
    >
      <span className="flex gap-2">
        <span aria-hidden>{error ? '!' : '·'}</span>
        <span>
          {d.message}
          {d.fix && <span className="block opacity-70">{d.fix}</span>}
          {d.path && <span className="block opacity-50">{d.path}</span>}
        </span>
      </span>
    </Tag>
  )
}
