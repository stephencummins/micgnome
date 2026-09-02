/**
 * A tiny file-store abstraction, so the same disk logic runs in three places:
 * in memory (tests), in the browser's origin-private file system (the virtual
 * fx-mic), and against a real directory handle (the mic itself).
 */
export interface FileStore {
  list(): Promise<string[]>
  read(name: string): Promise<Uint8Array | undefined>
  write(name: string, data: Uint8Array): Promise<void>
  remove(name: string): Promise<void>
}

export class MemoryStore implements FileStore {
  private files = new Map<string, Uint8Array>()

  async list() {
    return [...this.files.keys()].sort()
  }
  async read(name: string) {
    const found = this.files.get(name)
    return found ? new Uint8Array(found) : undefined
  }
  async write(name: string, data: Uint8Array) {
    this.files.set(name, new Uint8Array(data))
  }
  async remove(name: string) {
    this.files.delete(name)
  }
}

/**
 * Origin-private file system. Survives reloads, is invisible to the user's own
 * file system, and is per-origin — exactly right for a fake device.
 */
export class OpfsStore implements FileStore {
  private readonly dirName: string

  constructor(dirName = 'virtual-fx-mic') {
    this.dirName = dirName
  }

  private async dir(): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory()
    return root.getDirectoryHandle(this.dirName, { create: true })
  }

  async list() {
    const dir = await this.dir()
    const names: string[] = []
    for await (const name of dir.keys()) names.push(name)
    return names.sort()
  }

  async read(name: string) {
    const dir = await this.dir()
    try {
      const handle = await dir.getFileHandle(name)
      const file = await handle.getFile()
      return new Uint8Array(await file.arrayBuffer())
    } catch {
      return undefined
    }
  }

  async write(name: string, data: Uint8Array) {
    const dir = await this.dir()
    const handle = await dir.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(toBuffer(data))
    await writable.close()
  }

  async remove(name: string) {
    const dir = await this.dir()
    await dir.removeEntry(name).catch(() => undefined)
  }
}

/** A real directory the user picked — the mounted `fx-mic disk`. */
export class DirectoryStore implements FileStore {
  private readonly handle: FileSystemDirectoryHandle

  constructor(handle: FileSystemDirectoryHandle) {
    this.handle = handle
  }

  async list() {
    const names: string[] = []
    for await (const name of this.handle.keys()) names.push(name)
    return names.sort()
  }

  async read(name: string) {
    try {
      const file = await (await this.handle.getFileHandle(name)).getFile()
      return new Uint8Array(await file.arrayBuffer())
    } catch {
      return undefined
    }
  }

  async write(name: string, data: Uint8Array) {
    const handle = await this.handle.getFileHandle(name, { create: true })
    const writable = await handle.createWritable()
    await writable.write(toBuffer(data))
    await writable.close()
  }

  async remove(name: string) {
    await this.handle.removeEntry(name).catch(() => undefined)
  }
}

/**
 * `writable.write` wants a view backed by a plain ArrayBuffer; a Uint8Array
 * that might sit on a SharedArrayBuffer does not satisfy it.
 */
const toBuffer = (data: Uint8Array): ArrayBuffer => {
  const out = new ArrayBuffer(data.byteLength)
  new Uint8Array(out).set(data)
  return out
}

export const encode = (text: string) => new TextEncoder().encode(text)
export const decode = (data: Uint8Array) => new TextDecoder().decode(data)
