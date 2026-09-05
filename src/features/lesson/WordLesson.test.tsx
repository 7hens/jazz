import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Question, SkillKey, UserSettings, WordUnit } from '@/shared/services'
import { WordLesson } from './WordLesson'

const settings: UserSettings = {
  enablePinyin: true,
  enableHanzi: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '',
}
const word: WordUnit = { id: 21, emoji: '🍎', pinyin: 'píng guǒ', hanzi: '苹果', english: 'apple', category: 'food' }
const noop = () => {}
const makeQuestions = () => [{ kind: 'choice', prompt: 'x', options: [{ id: 'a', text: 'A' }], answerId: 'a' }] as unknown as Question[]

function renderLesson(over: Partial<Parameters<typeof WordLesson>[0]> = {}) {
  const base = { word, settings, combo: 0, makeQuestions, playSound: noop, speak: () => true, celebrate: noop, onAnswer: noop, onStepPass: noop, onLessonComplete: noop, onExit: noop }
  return render(<WordLesson {...base} {...over} />)
}

describe('WordLesson stepGate', () => {
  afterEach(cleanup)
  it('无 stepGate:直接出题(现状回归)', () => {
    renderLesson()
    expect(screen.getByText('x')).toBeTruthy()
  })
  it('stepGate.judge true 首步 → 渲染 gate.render,cont 后出题', async () => {
    const renderGate = vi.fn((ctx: { word: WordUnit; skill: SkillKey; cont: () => void }) => (
      <button onClick={ctx.cont}>我先学一下</button>
    ))
    renderLesson({ stepGate: { judge: () => true, render: renderGate } })
    expect(renderGate).toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: '我先学一下' }))
    expect(screen.getByText('x')).toBeTruthy() // cont 后装题
  })
  it('judge false → 不渲染 gate', () => {
    const renderGate = vi.fn(() => null)
    renderLesson({ stepGate: { judge: () => false, render: renderGate } })
    expect(renderGate).not.toHaveBeenCalled()
    expect(screen.getByText('x')).toBeTruthy()
  })
})
