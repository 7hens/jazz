import type { AtmosphereKey, SpeechMood } from './chapter'
import type { SpeechRole } from '@/shared/services'

/** 角色形象比例(emoji 放大系数;静默大反派)。
 *  位图接缝:将来换立绘只改此映射与 index.css 的 .stage-sky--* 规则即可,组件零改。 */
export const roleScale = (role: SpeechRole): number => (role === 'changmo' ? 1.5 : 1)

/** 气泡边框情绪色(mood 缺省 calm 由调用方回退)。 */
export const moodBorder = (mood: SpeechMood): string =>
  mood === 'sad' ? 'border-sky' : mood === 'happy' ? 'border-emerald' : mood === 'scary' ? 'border-red' : 'border-hairline-strong'

/** 氛围背景类(具体渐变在 index.css `.stage-sky--*`)。 */
export const atmosphereToClass = (key: AtmosphereKey): string => `stage-sky stage-sky--${key}`

/** 世界「回春」:低进度满灰(失血),高进度无色差。给布景叠滤镜层用(样式 token 见 index.css)。 */
export function worldDesatClass(fraction: number): string {
  return fraction >= 0.8 ? '' : fraction >= 0.5 ? 'stage-world--half' : fraction >= 0.2 ? 'stage-world--light' : 'stage-world--dim'
}

/** 布景元素位图映射(位置接缝:换位图/改元素只改此表 + index.css token,组件零改)。 */
export const STAGE_BODIES = {
  sun: '☀️',
  clouds: '☁️  ☁️  ☁️  ☁️',
  mountains: '⛰️ ⛰️ ⛰️',
  village: '🏠 🏘️ 🌳',
  river: '🏞️',
  waves: '💧 🌊 💧',
} as const
