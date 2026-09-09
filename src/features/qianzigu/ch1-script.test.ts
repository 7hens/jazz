import { describe, expect, it } from 'vitest'
import type { ChapterLine, Scene } from './chapter'
import { CHAPTER_1 } from './ch1'

// 千字谷台本句长规则(朗读友好):单句台词去标点后,推荐 ≤18 汉字、硬线 ≤20。
// 超 20 必按意群拆成独立可读的短句,此测试守护数据(ch1.ts 顶部注释同规则)。
// 表演性气音/结巴句天然更短,阈值不会误伤;若未来某句确需超线(修辞排比),改注释与测试须同步说明理由。

function sceneLines(s: Scene): readonly ChapterLine[] {
  switch (s.kind) {
    case 'dialogue':
    case 'ending':
      return s.lines
    case 'task':
      return [...s.intro, ...s.onDone]
    case 'social':
      return [...s.lines, ...s.loop, ...s.onGood]
    case 'boss':
      return [...s.intro, ...s.win, ...s.lose]
    case 'settle':
      return s.summary
    case 'break':
      return []
  }
}

const HARD_LIMIT = 20
// 去标点/拼音后只数正文汉字与字母数字(拟声、省略号、感叹号不计入)。
const body = (t: string): string => t.replace(/[^一-龥a-zA-Z0-9]/g, '')

describe('ch1 台本句长规则', () => {
  it(`所有朗读台词去标点 ≤ ${HARD_LIMIT} 字(超线必拆;推荐 ≤18)`, () => {
    const violations: string[] = []
    for (const s of CHAPTER_1.scenes) {
      for (const l of sceneLines(s)) {
        const n = body(l.text).length
        if (n > HARD_LIMIT) violations.push(`${s.id}/${l.role}: ${l.text}（${n} 字）`)
      }
    }
    expect(violations, violations.join('\n')).toEqual([])
  })
})
