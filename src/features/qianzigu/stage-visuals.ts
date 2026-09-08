import type { AtmosphereKey, SpeechMood } from './chapter'
import type { SpeechRole } from '@/shared/services'

/** 角色形象比例(emoji 放大系数;静默大反派)。
 *  位图接缝:将来换立绘只改此映射 + stage-visuals 同文件 atmosphere 表,组件零改。 */
export const roleScale = (role: SpeechRole): number => (role === 'jingmo' ? 1.5 : 1)

/** 气泡边框情绪色(mood 缺省 calm 由调用方回退)。 */
export const moodBorder = (mood: SpeechMood): string =>
  mood === 'sad' ? 'border-sky' : mood === 'happy' ? 'border-emerald' : mood === 'scary' ? 'border-red' : 'border-hairline-strong'

/** 氛围背景类(具体渐变在 index.css `.stage-sky--*`)。 */
export const atmosphereToClass = (key: AtmosphereKey): string => `stage-sky stage-sky--${key}`
