const STEPS: { title: string; body: string }[] = [
  {
    title: 'build a chain',
    body: 'add effect blocks in the chain tab. audio falls through them top to bottom, and the SAMPLE row is where your sound gets injected — put it last to keep it dry, earlier to run it through the effects above.',
  },
  {
    title: 'drop in sounds',
    body: 'the samples tab takes wav files, up to four. all four share 1 mb, which is the real limit on this device. go over and the fitter will trim, fold to mono and step the sample rate down until it fits, and tell you what it traded.',
  },
  {
    title: 'wire up the handle',
    body: 'pick a row and a parameter for the handle, shake or lfo to move. the map on the right plots it as you squeeze, and marks the point where it hits its ceiling and the rest of your travel stops doing anything.',
  },
  {
    title: 'read the verdict',
    body: 'errors block the write — an unknown effect, a value out of range, modulation pointing at a row that is not there. warnings never block: they are the places the guide itself is silent, and refusing a config that works would be worse.',
  },
  {
    title: 'write and eject',
    body: 'mic gnome generates the config.json and encodes your wavs, backs up whatever is already on the disk so putting it back is one click, then writes. eject and wait for the restart — do not pull the cable. if a mic ever refuses to start, hold the white + grey buttons during startup to get the disk back and fix the file.',
  },
]

export function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 sm:p-10">
      <div role="dialog" aria-modal="true" aria-label="how to use mic gnome"
        className="w-full max-w-xl border border-rule bg-paper p-5">
        <div className="flex items-baseline justify-between border-b border-ink pb-2">
          <h2 className="m-0 text-lg font-medium tracking-tight">five steps</h2>
          <button type="button" onClick={onClose} className="label underline hover:text-orange">close</button>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <p className="label m-0 leading-relaxed">
            the EP&ndash;2350 fx-mic keeps its whole personality in one file: a <code>config.json</code> on the disk it
            mounts as over usb-c, next to up to four wav files. break that json and the mic will not start.
          </p>
          <p className="label m-0 leading-relaxed">
            you do not need to find one or write one. a new mic has none at all &mdash; it plays its four factory
            sounds until you give it one. <b className="font-medium text-orange">mic gnome writes the file for you</b>,
            from whatever you do on this page. <b className="font-medium">import</b> in the header is only for a config
            you already have: one you made earlier, or somebody else&rsquo;s pack.
          </p>
        </div>

        <ol className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-3 border-b border-rule-soft pb-3">
              <span className="data shrink-0 text-orange">{i + 1}</span>
              <span>
                <b className="data block font-medium">{step.title}</b>
                <span className="label block leading-relaxed">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <button type="button" onClick={onClose}
          className="data mt-4 w-full border border-orange bg-orange px-3 py-2 tracking-wider text-white">
          got it
        </button>
      </div>
    </div>
  )
}
