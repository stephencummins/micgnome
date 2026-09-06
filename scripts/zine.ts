/** npm run zine — regenerates the printable manual from the spec. */
import { writeFileSync } from 'node:fs'
import { BOOKLET_PAGE_COUNT, renderBooklet, renderZine } from '../src/zine/zine.ts'

for (const [file, html] of [
  ['../public/zine.html', renderZine()],
  ['../public/zine-booklet.html', renderBooklet()],
] as const) {
  const out = new URL(file, import.meta.url)
  writeFileSync(out, html)
  console.log(`wrote ${out.pathname}`)
}
console.log(`booklet is ${BOOKLET_PAGE_COUNT} pages (saddle stitch needs a multiple of 4)`)
