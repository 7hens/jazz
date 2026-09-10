import type { ServiceToken } from './core'

/** 千字谷台词角色(各角色有独立语速/音高配置)。 */
export type SpeechRole =
  | 'lingling' | 'sun' | 'moon' | 'jingmo' | 'narrator' | 'villager'
  | 'xuwannian' | 'pixiaonao' | 'changmo'

/** speakRole 可选覆盖(rate/pitch 缺省按角色映射表)。 */
export type SpeakRoleOptions = { rate?: number; pitch?: number }

export interface SpeechService {
  speak(text: string, lang?: string): boolean
  speakRole(text: string, role: SpeechRole, opts?: SpeakRoleOptions): boolean
  stop(): void
}

export const SpeechService = Symbol('SpeechService') as unknown as ServiceToken<SpeechService>
