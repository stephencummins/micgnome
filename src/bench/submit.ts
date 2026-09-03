import { serialize } from '../fxmic/serialize'
import type { Config } from '../fxmic/types'

export const REPO = 'https://github.com/stephencummins/micgnome'

/**
 * Offering a pack for the library is a hand-off, not an upload: the library
 * is read-only until there is something to moderate, so "send it in" opens a
 * GitHub issue with the pack filled in and a person reads it. The share link
 * carries the whole pack on its own; the JSON is included too when the URL
 * stays short enough for GitHub to accept.
 */
export function submitUrl(config: Config, shareLink: string): string {
  const name = config.name?.trim() || 'untitled pack'
  const lines = [
    '**what it is after** (a device, a sound, a job — or nothing):',
    '',
    '**what the handle does**, in one line:',
    '',
    '**anything you heard on a real mic** (say if you have not):',
    '',
    `**link that carries the pack:** ${shareLink}`,
  ]
  const json = serialize(config)
  const withJson = [...lines, '', '```json', json, '```'].join('\n')
  const body = withJson.length <= 6000 ? withJson : lines.join('\n')
  const q = new URLSearchParams({ title: `pack: ${name}`, labels: 'pack', body })
  return `${REPO}/issues/new?${q.toString()}`
}
