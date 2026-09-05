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
}

export function FoundationStepGate({ word, skill, data, foundation, basics, speak, playSound, onContinue }: FoundationStepGateProps) {
  const [teaching, setTeaching] = useState(false) // soft → 点「先学一下」切强制 overlay
  if (skill === 'hanzi') return null // 汉字技能无基础单元(组件级防御;正常已被 App 判定滤除)
  const units = foundation.unitsFor(word.id, skill)
  const need = units.length > 0 ? foundation.needFor(units, data) : 'none'
  if (need === 'none') return null
  if (need === 'mandatory' || teaching) {
    return <TeachOverlay word={word} skill={skill} units={units} basics={basics} speak={speak} playSound={playSound} onDone={onContinue} />
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
