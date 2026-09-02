// 全局声音开关：localStorage 持久化。存储不可用时（隐私模式等）默认开启、写入静默忽略。

const KEY = 'jazz_sound_on'

export function getSoundOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}
