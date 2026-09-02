import { getSoundOn } from './audio'

// Web Audio 音效：懒创建 AudioContext（构造不需要用户手势，播放才需要），尊重全局声音开关。

let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx ??= new Ctor()
  // 浏览器自动播放策略下,新 AudioContext 常处于 suspended;播放前尝试恢复
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', vol = 0.15) {
  const c = ac()
  if (!c) return
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
    tone(220, 0, 0.25, 'triangle', 0.12)
  } else if (type === 'victory') {
    tone(523, 0, 0.15)
    tone(659, 0.12, 0.15)
    tone(784, 0.24, 0.15)
    tone(1046, 0.36, 0.35)
  } else {
    tone(330, 0, 0.06, 'triangle', 0.08)
  }
}
