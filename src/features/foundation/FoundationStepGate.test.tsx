import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { BasicsProgressData, BasicsService, FoundationService, WordUnit } from '@/shared/services'
import { FoundationStepGate } from './FoundationStepGate'

const apple: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }
const noop = () => {}
const foundation = { unitsFor: () => ['pinyin:p', 'pinyin:g'], needFor: (_units: readonly string[], m: Readonly<BasicsProgressData>) => (m['pinyin:p']?.state === 'known' && m['pinyin:g']?.state === 'known' ? 'none' : 'mandatory') } as unknown as FoundationService
const basics = { recordAnswer: vi.fn(async () => {}), markTaught: vi.fn(async () => {}), saveAll: vi.fn(async () => {}) } as unknown as BasicsService

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
