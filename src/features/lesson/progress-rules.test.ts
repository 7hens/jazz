import { describe, expect, it } from 'vitest'
import { DOMAIN_SKILLS, enabledSkillsFor } from './progress-rules'

describe('领域 → 技能映射', () => {
  it('汉语域捆绑拼音+汉字两技能', () => {
    expect(DOMAIN_SKILLS.chinese).toEqual(['pinyin', 'hanzi'])
    expect(DOMAIN_SKILLS.english).toEqual(['english'])
  })

  it('enabledSkillsFor 双域开 → 三技能按 SKILL_ORDER 序', () => {
    expect(enabledSkillsFor({ enableChinese: true, enableEnglish: true })).toEqual(['pinyin', 'hanzi', 'english'])
  })

  it('只开汉语 → 拼音+汉字;只开英语 → 英语', () => {
    expect(enabledSkillsFor({ enableChinese: true, enableEnglish: false })).toEqual(['pinyin', 'hanzi'])
    expect(enabledSkillsFor({ enableChinese: false, enableEnglish: true })).toEqual(['english'])
  })

  it('双域关 → 空列表(消费侧 stepsFor 兜底英语)', () => {
    expect(enabledSkillsFor({ enableChinese: false, enableEnglish: false })).toEqual([])
  })
})
