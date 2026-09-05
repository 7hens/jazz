import { useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AudioCue, BasicsProgressData, BasicsProgressRow, BasicsProgressSnapshot, BasicsService, FoundationNeed, FoundationService, SkillKey, WordUnit } from '@/shared/services'
import type { Speak } from '@/shared/ui/quiz/speech'
import { FoundationStepGate } from './FoundationStepGate'

const apple: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }
const noop = () => {}

/** 与 estimator.needFor 同口径:未掌握且从未教过→mandatory;教过仍 learning→soft;全 known→none。 */
function needFor(units: readonly string[], m: Readonly<BasicsProgressData>): FoundationNeed {
  let hasSoft = false
  for (const unit of units) {
    const row = m[unit]
    const model = row ? { state: row.state, taughtCount: row.taughtCount } : { state: 'learning' as const, taughtCount: 0 }
    if (model.state !== 'known' && model.taughtCount === 0) return 'mandatory'
    if (model.state !== 'known') hasSoft = true
  }
  return hasSoft ? 'soft' : 'none'
}

const foundation = { unitsFor: () => ['pinyin:p', 'pinyin:g'], needFor } as unknown as FoundationService
const basics = { recordAnswer: vi.fn(async () => {}), markTaught: vi.fn(async () => {}), saveAll: vi.fn(async () => {}) } as unknown as BasicsService

/** 会发布的 BasicsService fake:写入同步改内部快照并通知订阅者(镜像 App 对 basics 的订阅路径)。 */
function createPublishingBasics(initial: BasicsProgressData = {}) {
  let snapshot: BasicsProgressSnapshot = { status: 'ready', data: Object.freeze({ ...initial }) }
  const listeners = new Set<() => void>()
  function publish(nextData: BasicsProgressData) {
    snapshot = { status: 'ready', data: Object.freeze(nextData) }
    listeners.forEach((listener) => listener())
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    load: async () => {},
    async recordAnswer(unitKey: string, correct: boolean) {
      const row = snapshot.data[unitKey]
      const prev = row ? { state: row.state, correctStreak: row.correctStreak, taughtCount: row.taughtCount } : { state: 'learning' as const, correctStreak: 0, taughtCount: 0 }
      const streak = correct ? prev.correctStreak + 1 : 0
      const state = correct && streak >= 2 ? ('known' as const) : prev.state
      publish({ ...snapshot.data, [unitKey]: { unitKey, state, correctStreak: streak, taughtCount: prev.taughtCount, updatedAt: '' } })
    },
    async markTaught(unitKeys: readonly string[]) {
      const next: BasicsProgressData = { ...snapshot.data }
      for (const key of unitKeys) {
        const row = next[key]
        next[key] = { unitKey: key, state: row?.state ?? 'learning', correctStreak: row?.correctStreak ?? 0, taughtCount: (row?.taughtCount ?? 0) + 1, updatedAt: '' }
      }
      publish(next)
    },
    saveAll: async () => {},
  } as unknown as BasicsService
}

/** 挂载 FoundationStepGate 并从可发布 basics 快照实时取 data(镜像 App 的订阅路径)。 */
function GateHarness({ word, skill, foundation: f, basics: b, speak, playSound, onContinue }: {
  word: WordUnit
  skill: SkillKey
  foundation: FoundationService
  basics: BasicsService
  speak: Speak
  playSound: (cue: AudioCue) => void
  onContinue: () => void
}) {
  const snap = useSyncExternalStore(b.subscribe, b.getSnapshot, b.getSnapshot)
  return <FoundationStepGate word={word} skill={skill} data={snap.data} foundation={f} basics={b} speak={speak} playSound={playSound} onContinue={onContinue} />
}

describe('FoundationStepGate', () => {
  afterEach(cleanup)
  it('need mandatory → 渲染 TeachOverlay(出现「直接答题」/教学文案)', () => {
    render(<FoundationStepGate word={apple} skill="pinyin" data={{}} foundation={foundation} basics={basics} speak={() => true} playSound={noop} onContinue={vi.fn()} />)
    expect(screen.getByRole('button', { name: /直接答题/ })).toBeTruthy()
    expect(screen.getAllByText(/苹果/).length).toBeGreaterThan(0)
  })
  it('need none → 返回 null(不渲染)', () => {
    const { container } = render(<FoundationStepGate word={apple} skill="pinyin" data={{ 'pinyin:p': { unitKey: 'pinyin:p', state: 'known', correctStreak: 2, taughtCount: 1, updatedAt: '' }, 'pinyin:g': { unitKey: 'pinyin:g', state: 'known', correctStreak: 2, taughtCount: 1, updatedAt: '' } }} foundation={foundation} basics={basics} speak={() => true} playSound={noop} onContinue={vi.fn()} />)
    expect(container.firstChild).toBeNull()
  })
  it('soft(教过仍在 learning)→ 浮条,点「直接答题」走 onContinue', async () => {
    const cont = vi.fn()
    render(<FoundationStepGate word={apple} skill="pinyin" data={{}} foundation={{ ...foundation, needFor: () => 'soft' as const }} basics={basics} speak={() => true} playSound={noop} onContinue={cont} />)
    expect(screen.getByText(/想先学一下/)).toBeTruthy()
    await userEvent.click(screen.getByRole('button', { name: /直接答题/ }))
    expect(cont).toHaveBeenCalled()
  })
  it('soft 浮条点「先学一下」→ 切 TeachOverlay,onContinue 后走回调', async () => {
    const cont = vi.fn()
    render(<FoundationStepGate word={apple} skill="pinyin" data={{}} foundation={{ ...foundation, needFor: () => 'soft' as const }} basics={basics} speak={() => true} playSound={noop} onContinue={cont} />)
    await userEvent.click(screen.getByRole('button', { name: /先学一下/ }))
    expect(screen.getByRole('button', { name: /直接答题/ })).toBeTruthy() // 已切 TeachOverlay(其 header 带「直接答题」跳过)
  })
})

describe('FoundationStepGate (reactive basics — 自身写入不回抽)', () => {
  afterEach(cleanup)

  it('强制门:自身 recordAnswer/markTaught 写入不回抽,overlay 存活到 praise「开始答题!」', async () => {
    const publishing = createPublishingBasics()
    const onContinue = vi.fn()
    render(<GateHarness word={apple} skill="pinyin" foundation={foundation} basics={publishing} speak={() => true} playSound={noop} onContinue={onContinue} />)

    fireEvent.click(await screen.findByRole('button', { name: /下一步/ })) // demo → tap
    fireEvent.click(await screen.findByRole('button', { name: /下一步/ })) // tap → quiz
    fireEvent.click(await screen.findByText('p'))
    fireEvent.click(await screen.findByText('g')) // 末题答对 → recordAnswer + markTaught → 发布新快照(taughtCount=1 仍 learning)
    // 锁存:不得抽成 soft 浮条,overlay 须继续到 praise 结课
    expect(screen.queryByText(/想先学一下/)).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /开始答题/ }))
    expect(onContinue).toHaveBeenCalled()
  })

  it('soft →「先学一下」:即使自身写入把单元升到 known 也不抽空,仍到 praise/onContinue', async () => {
    const rowP: BasicsProgressRow = { unitKey: 'pinyin:p', state: 'learning', correctStreak: 1, taughtCount: 1, updatedAt: '' }
    const rowG: BasicsProgressRow = { unitKey: 'pinyin:g', state: 'learning', correctStreak: 1, taughtCount: 1, updatedAt: '' }
    const publishing = createPublishingBasics({ 'pinyin:p': rowP, 'pinyin:g': rowG })
    const onContinue = vi.fn()
    render(<GateHarness word={apple} skill="pinyin" foundation={foundation} basics={publishing} speak={() => true} playSound={noop} onContinue={onContinue} />)

    expect(screen.getByText(/想先学一下/)).toBeTruthy() // soft 浮条
    await userEvent.click(screen.getByRole('button', { name: /先学一下/ }))
    fireEvent.click(await screen.findByRole('button', { name: /下一步/ })) // demo → tap
    fireEvent.click(await screen.findByRole('button', { name: /下一步/ })) // tap → quiz
    fireEvent.click(await screen.findByText('p')) // streak2 → known;发布
    fireEvent.click(await screen.findByText('g')) // 同 + markTaught;发布(全 known → need none,teaching latch 仍须保 overlay)
    expect(screen.queryByText(/想先学一下/)).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: /开始答题/ }))
    expect(onContinue).toHaveBeenCalled()
  })
})
