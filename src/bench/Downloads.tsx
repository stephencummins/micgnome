import { useEffect, useMemo } from 'react'

/**
 * The way a pack reaches a real mic today: as files you drop onto the mounted
 * `fx-mic disk` yourself (`ting boot` on the TING, the EP-2350 bundled with the EP-40
 * RIDDIM — same mic, different label on the volume). Mic Gnome writes to its virtual mic to prove the
 * pack boots; it does not write to hardware it has never been tested on.
 */
export function Downloads({
  configText,
  files,
  blocked,
  onDownload,
}: {
  configText: string
  files: { name: string; data: Uint8Array }[]
  blocked: boolean
  /** config.json was downloaded — the pack is on its way to a mic. */
  onDownload?: () => void
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
        for the real mic: plug it in with a usb-c cable and a drive appears, like a memory stick —{' '}
        <b className="font-medium">fx-mic disk</b>, or <b className="font-medium">ting boot</b> if yours came
        with an ep–40 riddim. download these, drag them onto that drive, then eject it. if you delete old
        files from it first, empty the bin (the trash on a mac) before ejecting: until then they still use the
        mic’s 1 mb, and it says there is not enough space.
      </p>
      <ul className="m-0 mt-1.5 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
        {links.map((l) =>
          blocked ? (
            <li key={l.name} className="data text-mute line-through">{l.name}</li>
          ) : (
            <li key={l.name}>
              <a href={l.url} download={l.name} className="data text-orange underline hover:no-underline"
                onClick={() => l.name === 'config.json' && onDownload?.()}>
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
