// 词课步前教学门:算 need,只在存在「未教单元」(mandatory)时插强制短教 overlay;soft/none 一律放行直接答题。
// 非 Entry 不自取服务:所需服务/快照由 app 组装层注入。
import { useState } from 'react'
import type { AudioCue, BasicsProgressData, BasicsService, FoundationService, SkillKey, WordUnit } from '@/shared/services'
import type { Speak } from '@/shared/ui/quiz/speech'
import { TeachOverlay } from './TeachOverlay'

export type FoundationStepGateProps = {
  word: WordUnit
  skill: SkillKey // hanzi 不会到这(判定已滤)
  data: Readonly<BasicsProgressData> // 当前熟度快照(组装层订阅后传入)
  foundation: FoundationService
  basics: BasicsService
  speak: Speak
  playSound: (cue: AudioCue) => void
  onContinue: () => void // 学完回正题
  onExit?: () => void // 教学出口(可选):直接回群岛
}

export function FoundationStepGate({ word, skill, data, foundation, basics, speak, playSound, onContinue, onExit }: FoundationStepGateProps) {
  // 开门即锁存本次判定:need 只在挂载算一次;自身子树写 basics 触发的重渲染不回抽/抽空已开门,
  // 让在飞的 TeachOverlay 一路跑到 onDone(教学结课的 praise 不被吞)。后续步的开门判定仍在 App judge / WordLesson.enterStep。
  const [{ units, need }] = useState(() => {
    if (skill === 'hanzi') return { units: [] as const, need: 'none' as const }
    const u = foundation.unitsFor(word.id, skill)
    return { units: u, need: u.length > 0 ? foundation.needFor(u, data) : 'none' }
  })
  if (skill === 'hanzi') return null // 组件级防御(正常已被 App 判定滤除);顺带把 skill 窄化到 pinyin|english
  // 只挡 mandatory(该步有从未教过的单元 → 强制短教);soft(教过仍 learning)与 none 一样放行,不弹「想先学一下?」浮条打断。
  if (need !== 'mandatory') return null
  return <TeachOverlay word={word} skill={skill} units={units} basics={basics} speak={speak} playSound={playSound} onDone={onContinue} onExit={onExit} />
}
