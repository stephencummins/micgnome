import { useEffect, useMemo } from 'react'

/**
 * The way a pack reaches a real mic today: as files you drop onto the mounted
 * `fx-mic disk` yourself. Mic Gnome writes to its virtual mic to prove the
 * pack boots; it does not write to hardware it has never been tested on.
 */
export function Downloads({
  configText,
  files,
  blocked,
}: {
  configText: string
  files: { name: string; data: Uint8Array }[]
  blocked: boolean
}) {
  const links = useMemo(
    () => [
      { name: 'config.json', url: URL.createObjectURL(new Blob([configText], { type: 'application/json' })) },
      ...files.map((f) => ({
        name: f.name,
        url: URL.createObjectURL(new Blob([f.data as BlobPart], { type: 'audio/wav' })),
      })),
    ],
    [configText, files],
  )
  useEffect(() => () => links.forEach((l) => URL.revokeObjectURL(l.url)), [links])

  return (
    <div className="mt-3 border-t border-rule-soft pt-3">
      <p className="label m-0 leading-relaxed">
        for the real mic: plug it in with a usb-c cable and a drive called <b className="font-medium">fx-mic disk</b>{' '}
        appears, like a memory stick. download these, drag them onto that drive, then eject it.
      </p>
      <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
        {links.map((l) =>
          blocked ? (
            <li key={l.name} className="data text-mute line-through">{l.name}</li>
          ) : (
            <li key={l.name}>
              <a href={l.url} download={l.name} className="data text-orange underline hover:no-underline">
                {l.name} ↓
              </a>
            </li>
          ),
        )}
      </ul>
      {blocked && <p className="label m-0 mt-1">fix the errors first — this is the file that stops a mic booting.</p>}
    </div>
  )
}
