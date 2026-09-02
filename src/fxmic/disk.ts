/**
 * The fx-mic disk, real or virtual.
 *
 * The virtual one exists because the write path is the only part of Mic Gnome
 * that can damage anything, and it is the last part you want to debug against
 * real hardware. It models the device closely enough to be useful:
 *
 *   - a 1 mb ceiling that refuses writes the way a full FAT volume does
 *   - eject -> restart -> boot, with the boot actually reading config.json
 *   - a frozen state when the JSON is broken, which is the failure this whole
 *     product exists to prevent
 *   - the white + grey recovery, so the escape hatch is testable too
 *
 * Boot rules follow the guide and stop there. The guide says syntax errors stop
 * the unit starting; it does not say what the firmware does with a value out of
 * range or an unknown key. So only a parse failure freezes the virtual mic —
 * everything else boots and is reported as a validator finding. Guessing
 * harder than the manual would make the simulator lie.
 */
import { parseConfig } from './parse'
import { type Report } from './diagnostics'
import { LIMITS, RECOVERY } from './spec'
import { DirectoryStore, type FileStore, MemoryStore, OpfsStore, decode, encode } from './store'
import type { DiskFile } from './types'
import { validate } from './validate'

export const CONFIG_NAME = 'config.json'

export type MicState = 'idle' | 'running' | 'frozen'

export interface RestartResult {
  /** False means the mic did not come back — the state this app exists to prevent. */
  booted: boolean
  state: MicState
  /** The pack that loaded, when one did. */
  packName?: string
  /** Why it did not boot, in the user's language. */
  reason?: string
  /** What to do about it. Always present when booted is false. */
  recovery?: string
  /** Validator findings for a config that parsed, whether or not it is perfect. */
  report?: Report
}

export interface Snapshot {
  takenAt: number
  files: { name: string; data: Uint8Array }[]
}

export class DiskFullError extends Error {
  readonly needed: number
  readonly free: number

  constructor(needed: number, free: number) {
    super(
      `Not enough disk space: ${Math.round(needed / 1024)} kb needed, ${Math.round(free / 1024)} kb free. ` +
        'Trim a sample, drop it to mono, or lower the sample rate.',
    )
    this.name = 'DiskFullError'
    this.needed = needed
    this.free = free
  }
}

export interface MicDiskOptions {
  capacityBytes?: number
  /** Virtual mics simulate boot on eject; a real one just gets written to. */
  simulateBoot?: boolean
  label?: string
}

export class MicDisk {
  readonly label: string
  readonly capacityBytes: number
  private readonly store: FileStore
  private readonly simulateBoot: boolean
  private state: MicState = 'idle'

  constructor(store: FileStore, options: MicDiskOptions = {}) {
    this.store = store
    this.capacityBytes = options.capacityBytes ?? LIMITS.storageBytes
    this.simulateBoot = options.simulateBoot ?? false
    this.label = options.label ?? 'fx-mic disk'
  }

  /** The virtual mic, backed by browser storage that survives a reload. */
  static virtual(options: MicDiskOptions = {}) {
    return new MicDisk(new OpfsStore(), { simulateBoot: true, label: 'virtual fx-mic', ...options })
  }

  /** The virtual mic, backed by nothing — for tests. */
  static inMemory(options: MicDiskOptions = {}) {
    return new MicDisk(new MemoryStore(), { simulateBoot: true, label: 'virtual fx-mic', ...options })
  }

  /** A real mounted disk the user picked with the directory picker. */
  static real(handle: FileSystemDirectoryHandle, options: MicDiskOptions = {}) {
    return new MicDisk(new DirectoryStore(handle), { simulateBoot: false, ...options })
  }

  getState(): MicState {
    return this.state
  }

  async files(): Promise<DiskFile[]> {
    const names = await this.store.list()
    const out: DiskFile[] = []
    for (const name of names) {
      const data = await this.store.read(name)
      out.push({ name, bytes: data?.byteLength ?? 0 })
    }
    return out
  }

  async used(): Promise<number> {
    return (await this.files()).reduce((n, f) => n + f.bytes, 0)
  }

  async free(): Promise<number> {
    return Math.max(0, this.capacityBytes - (await this.used()))
  }

  async read(name: string): Promise<Uint8Array | undefined> {
    return this.store.read(name)
  }

  async readText(name: string): Promise<string | undefined> {
    const data = await this.store.read(name)
    return data ? decode(data) : undefined
  }

  /** Throws DiskFullError rather than writing a truncated file. */
  async write(name: string, data: Uint8Array | string): Promise<void> {
    const bytes = typeof data === 'string' ? encode(data) : data
    const existing = (await this.store.read(name))?.byteLength ?? 0
    const free = (await this.free()) + existing
    if (bytes.byteLength > free) throw new DiskFullError(bytes.byteLength, free)
    await this.store.write(name, bytes)
  }

  async remove(name: string): Promise<void> {
    await this.store.remove(name)
  }

  /** Everything on the disk, so "put it back how it was" is always one call away. */
  async snapshot(): Promise<Snapshot> {
    const files: Snapshot['files'] = []
    for (const name of await this.store.list()) {
      const data = await this.store.read(name)
      if (data) files.push({ name, data })
    }
    return { takenAt: Date.now(), files }
  }

  async restore(snapshot: Snapshot): Promise<void> {
    for (const name of await this.store.list()) await this.store.remove(name)
    for (const file of snapshot.files) await this.store.write(file.name, file.data)
  }

  /**
   * Eject the disk. On the real device this is where the mic restarts and loads
   * the new sounds; on the virtual one we actually perform that boot, so a
   * config that would stop the mic starting stops this one too.
   */
  async eject(): Promise<RestartResult> {
    if (!this.simulateBoot) {
      this.state = 'idle'
      return { booted: true, state: 'idle' }
    }
    return this.boot()
  }

  private async boot(): Promise<RestartResult> {
    const text = await this.readText(CONFIG_NAME)

    if (text === undefined) {
      // No config at all is legitimate: the mic runs its factory presets.
      this.state = 'running'
      return { booted: true, state: 'running', packName: 'factory' }
    }

    const parsed = parseConfig(text)
    if (parsed.value === undefined) {
      this.state = 'frozen'
      const detail = parsed.diagnostics.find((d) => d.code === 'json-broken')
      return {
        booted: false,
        state: 'frozen',
        reason: detail?.message ?? 'config.json is not valid JSON, so the mic will not start.',
        recovery: RECOVERY,
      }
    }

    if (parsed.repairs.length) {
      // Mic Gnome can repair a file to open it. The firmware cannot.
      this.state = 'frozen'
      return {
        booted: false,
        state: 'frozen',
        reason:
          'config.json only parses after repairs, so the mic will not start: ' +
          parsed.repairs.map((r) => r.description).join(' '),
        recovery: RECOVERY,
      }
    }

    const report = validate(parsed.value, { files: await this.files() })
    const name = (parsed.value as { name?: unknown }).name
    this.state = 'running'
    return {
      booted: true,
      state: 'running',
      packName: typeof name === 'string' ? name : undefined,
      report,
    }
  }

  /** Guide 7.2: hold white + grey during startup to get the disk back. */
  async recover(): Promise<void> {
    this.state = 'idle'
  }
}
