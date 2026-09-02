import { getSoundOn } from './audio'

// Web Audio 音效。Firefox/Chrome 自动播放策略下:
// - 若 AudioContext 在非用户手势里创建(如 useEffect 里自动播放)会被永久困在 suspended,
//   之后的 resume() 即使在手势内也救不回 → 必须丢弃重建。
// - 策略:任何非 running 的 ctx 一律 close 重建;新 ctx 创建于播放调用点。
//   手势内的播放(点击卡/按钮)→ 新建即 running → 出声;非手势的播放(victory 结算动效)
//   → 本次无声但留下 suspended ctx,下一次手势播放会自愈(重建 running)。
// 首个用户手势(pointerdown/keydown)预建 ctx,让首次答题点击即可出声。

let ctx: AudioContext | null = null

/** 返回一个 running 或刚重建、待 resume 的 ctx;非 running 的旧实例被丢弃。 */
function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (ctx && ctx.state !== 'running') {
    // suspended(困死)实例:关闭丢弃,下次 new 若在手势内即 running
    void ctx.close().catch(() => {})
    ctx = null
  }
  ctx ??= new Ctor()
  return ctx
}

/** 在用户手势内调用:确保 ctx 已就绪(running 或重建中)。 */
export function unlockAudio() {
  ensureCtx()
}

if (typeof window !== 'undefined') {
  // 捕获阶段最先执行,任何按钮点击前 ctx 已在手势内就绪
  window.addEventListener('pointerdown', unlockAudio, { capture: true })
  window.addEventListener('keydown', unlockAudio, { capture: true })
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.3) {
  const c = ensureCtx()
  if (!c) return
  // Firefox:resume() 异步,suspended 期间排程的音不播。
  // 等 resume 完成进入 running 后才真正 start。
  const playNow = () => {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, c.currentTime + start)
    gain.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur)
    osc.connect(gain).connect(c.destination)
    osc.start(c.currentTime + start)
    osc.stop(c.currentTime + start + dur + 0.05)
  }
  if (c.state === 'running') {
    playNow()
    return
  }
  const p = c.resume()
  if (p) void p.then(playNow).catch(() => {})
  else playNow()
}

export function play(type: 'correct' | 'wrong' | 'streak' | 'victory' | 'tap') {
  if (!getSoundOn()) return
  if (type === 'correct') {
    tone(523, 0, 0.15)
    tone(659, 0.08, 0.18)
  } else if (type === 'streak') {
    tone(523, 0, 0.1)
    tone(659, 0.07, 0.1)
    tone(784, 0.14, 0.2)
  } else if (type === 'wrong') {
    tone(330, 0, 0.3, 'square', 0.22)
  } else if (type === 'victory') {
    tone(523, 0, 0.15, 'sine', 0.3)
    tone(659, 0.12, 0.15, 'sine', 0.3)
    tone(784, 0.24, 0.15, 'sine', 0.3)
    tone(1046, 0.36, 0.4, 'sine', 0.3)
  } else {
    tone(440, 0, 0.08, 'triangle', 0.18)
  }
}
