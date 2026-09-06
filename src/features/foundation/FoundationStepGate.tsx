// 词课步前教学门:算 need,分派 强制 overlay / 软提示浮条 / 无(返回 null)。
// 非 Entry 不自取服务:所需服务/快照由 app 组装层注入。
import { useState } from 'react'
import { Button } from '@/shared/ui/button'
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
  onContinue: () => void // 跳过或学完回正题
  onExit?: () => void // 教学出口(可选):直接回群岛
}

export function FoundationStepGate({ word, skill, data, foundation, basics, speak, playSound, onContinue, onExit }: FoundationStepGateProps) {
  // 开门即锁存本次判定:units/need 只在挂载算一次;自身子树写 basics 触发的重渲染不回抽/抽空已开门,
  // 让在飞的 TeachOverlay 一路跑到 onDone(教学结课的 praise 不被吞)。后续步的开门判定仍在 App judge / WordLesson.enterStep。
  const [{ units, need }] = useState(() => {
    if (skill === 'hanzi') return { units: [] as const, need: 'none' as const } // 汉字技能无基础单元
    const u = foundation.unitsFor(word.id, skill)
    return { units: u, need: u.length > 0 ? foundation.needFor(u, data) : 'none' }
  })
  const [teaching, setTeaching] = useState(false) // soft → 点「先学一下」切强制 overlay
  if (skill === 'hanzi') return null // 组件级防御(正常已被 App 判定滤除);顺带把 skill 窄化到 pinyin|english
  if (need === 'none') return null
  if (need === 'mandatory' || teaching) {
    return <TeachOverlay word={word} skill={skill} units={units} basics={basics} speak={speak} playSound={playSound} onDone={onContinue} onExit={onExit} />
  }
  // soft 浮条:一步一停,可去学可跳过
  return (
    <div className="flex flex-col items-center gap-4 pt-6 text-center" data-testid="soft-bar">
      <p className="text-lg font-bold text-ink">
        这个词里有还没学过的单元,想先学一下吗?
      </p>
      <div className="flex gap-3">
        <Button size="lg" onClick={() => setTeaching(true)}>先学一下</Button>
        <Button variant="ghost" size="lg" onClick={onContinue}>直接答题</Button>
      </div>
    </div>
  )
}
