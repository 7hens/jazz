import type { AtmosphereKey, ChapterLine, SceneKind } from './chapter'
import type { SpeechRole } from '@/shared/services'

const NARRATOR: SpeechRole = 'narrator'

export const isNarrator = (role: SpeechRole): boolean => role === NARRATOR

/** 展示组阵容:presets(常驻,保序)+ 台词首现序出现的角色;narrator 与重复一律滤除。 */
export function castFor(lines: readonly ChapterLine[], presets?: readonly SpeechRole[]): SpeechRole[] {
  const out: SpeechRole[] = []
  const seen = new Set<SpeechRole>()
  const push = (r: SpeechRole) => {
    if (r === NARRATOR || seen.has(r)) return
    seen.add(r)
    out.push(r)
  }
  if (presets) for (const r of presets) push(r)
  for (const l of lines) push(l.role)
  return out
}

/** 某词已恢复次数(0..2:两技能层各计一次;语义 = 原 SkyStrip 点亮档)。 */
export function restoreCount(restored: ReadonlyArray<{ wordId: number }>, wordId: number): number {
  let n = 0
  for (const e of restored) if (e.wordId === wordId) n++
  return n
}

/** 氛围兜底:stage.atmosphere 缺失时按场景 kind 取默认。 */
export function defaultAtmosphere(kind: SceneKind): AtmosphereKey {
  switch (kind) {
    case 'boss':
      return 'dark'
    case 'settle':
    case 'ending':
      return 'day'
    case 'break':
      return 'night'
    default:
      return 'dawn'
  }
}

export function progressFraction(restoredLen: number, totalLayers: number): number {
  if (totalLayers <= 0) return 0
  return Math.min(1, Math.max(0, restoredLen / totalLayers))
}

export function skySplit(
  cast: readonly SpeechRole[],
  sky: readonly SpeechRole[] | undefined,
): { ground: SpeechRole[]; sky: SpeechRole[] } {
  const skySet = new Set<SpeechRole>(sky ?? [])
  skySet.delete('narrator')
  const ground: SpeechRole[] = []
  const skyOut: SpeechRole[] = []
  for (const role of cast) {
    if (skySet.has(role)) skyOut.push(role)
    else ground.push(role)
  }
  return { ground, sky: skyOut }
}
