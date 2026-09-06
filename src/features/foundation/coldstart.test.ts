import { describe, expect, it } from 'vitest'
import { questionForUnit } from './teach-questions'
import { buildDiagnosisRows, COLDSTART_PROBES } from './coldstart'

describe('coldstart', () => {
  it('探针组含 pinyin 声母/韵母/声调代表 + english 字母', () => {
    expect(COLDSTART_PROBES.pinyin).toHaveLength(3)
    expect(COLDSTART_PROBES.pinyin[0]).toMatch(/^pinyin:/)
    expect(COLDSTART_PROBES.english).toHaveLength(3)
  })

  it('探针均可出题(questionForUnit 非 null,防静默短测)', () => {
    for (const track of ['pinyin', 'english'] as const) {
      for (const probe of COLDSTART_PROBES[track]) {
        expect(questionForUnit(probe), `${probe} 应能出题`).not.toBeNull()
      }
    }
  })

  it('探针全对 → 该轨全单元 known(高阶自动全跳)', () => {
    const rows = buildDiagnosisRows(
      COLDSTART_PROBES.pinyin.map((u) => ({ track: 'pinyin' as const, unitKey: u, correct: true })),
    )
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.state === 'known')).toBe(true)
    expect(rows.every((r) => r.taughtCount === 0)).toBe(true)
    expect(rows.every((r) => r.unitKey.startsWith('pinyin:'))).toBe(true)
  })

  it('部分对 → 答对 known、其余(含未考)learning', () => {
    const rows = buildDiagnosisRows([
      { track: 'pinyin' as const, unitKey: 'pinyin:b', correct: true },
      { track: 'pinyin' as const, unitKey: 'pinyin:ing', correct: false },
      { track: 'pinyin' as const, unitKey: 'pinyin:ton1', correct: false },
    ])
    expect(rows.find((r) => r.unitKey === 'pinyin:b')?.state).toBe('known')
    const rest = rows.filter((r) => r.unitKey !== 'pinyin:b')
    expect(rest.every((r) => r.state === 'learning')).toBe(true)
  })

  it('零对 → 整轨 learning;未作答轨不产出行', () => {
    const rows = buildDiagnosisRows([{ track: 'english' as const, unitKey: 'english:a', correct: false }])
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.unitKey.startsWith('english:') && r.state === 'learning')).toBe(true)
    expect(rows.some((r) => r.unitKey.startsWith('pinyin:'))).toBe(false)
  })
})
