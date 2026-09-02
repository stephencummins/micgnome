import type { LfoShape, Playmode } from './spec'

/** One row of a preset's effect chain. Extra keys are the effect's parameters. */
export interface EffectRow {
  effect: string
  BUS?: number
  [param: string]: string | number | undefined
}

export interface Modulation {
  /** Index into the preset's `list`. Mutually exclusive with `target`. */
  row?: number
  /** "lfo" means: modulate the LFO itself rather than an effect row. */
  target?: 'lfo'
  param?: string
  depth?: number
}

export interface Lfo extends Modulation {
  shape?: LfoShape
  speed?: number
  phase?: number
}

export interface Preset {
  /** Preset slot on the orange button, 0-3. */
  pos?: number
  name?: string
  comment?: string
  list: EffectRow[]
  handle?: Modulation
  shake?: Modulation
  lfo?: Lfo
  trigger?: { row?: number }
}

export interface SampleRef {
  /** Sample slot on the white button, 0-3. */
  pos?: number
  file: string
  playmode?: Playmode
}

export interface Config {
  name?: string
  /** Omit entirely to use the mic's four factory sounds. */
  samples?: SampleRef[]
  presets: Preset[]
}

/** A file present on the disk alongside config.json. */
export interface DiskFile {
  name: string
  bytes: number
}
