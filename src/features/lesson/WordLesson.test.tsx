import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

/** 新确认制作答:点选项(即念) → 点「确定」提交。 */
function answerChoice(text: string) {
  fireEvent.click(screen.getByText(text))
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
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
  it('judge 命中后续步:cont 过首步,答对进第二步再次开门', async () => {
    const renderGate = vi.fn((ctx: { word: WordUnit; skill: SkillKey; cont: () => void }) => (
      <button onClick={ctx.cont}>先学一下</button>
    ))
    renderLesson({
      makeQuestions: (_w: WordUnit, s: SkillKey) => [{ kind: 'choice', prompt: s, options: [{ id: 'a', text: 'A' }], answerId: 'a' }] as unknown as Question[],
      stepGate: { judge: () => true, render: renderGate },
    })
    expect(renderGate).toHaveBeenCalledTimes(1) // 首步(pinyin)门
    await userEvent.click(screen.getByRole('button', { name: '先学一下' }))
    answerChoice('A') // 答对首步 → 推进到第二步
    await waitFor(() => expect(renderGate).toHaveBeenCalledTimes(2), { timeout: 3000 }) // 第二步(hanzi)再开门
    expect(renderGate.mock.calls[1]?.[0]?.skill).toBe('hanzi')
    await userEvent.click(screen.getByRole('button', { name: '先学一下' }))
    expect(screen.getByText('hanzi')).toBeTruthy() // cont 后第二步装题
  })
  it('步内换题与 round 重试均不重判、不再开门', async () => {
    const renderGate = vi.fn((ctx: { word: WordUnit; skill: SkillKey; cont: () => void }) => (
      <button onClick={ctx.cont}>先学一下</button>
    ))
    const q1 = { kind: 'choice', prompt: 'x', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], answerId: 'a' }
    const q2 = { kind: 'choice', prompt: 'y', options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }], answerId: 'a' }
    renderLesson({
      makeQuestions: () => [q1, q2] as unknown as Question[],
      stepGate: { judge: () => true, render: renderGate },
    })
    await userEvent.click(screen.getByRole('button', { name: '先学一下' }))
    // 换题:首题答对 → 同一步内进第二题,不开门
    answerChoice('A')
    await waitFor(() => expect(screen.getByText('y')).toBeTruthy(), { timeout: 3000 })
    expect(renderGate).toHaveBeenCalledTimes(1)
    // round 重试:第二题连错两次 → reveal「再练一次」,点了仍在原步重出首题,不开门
    answerChoice('B')
    answerChoice('B')
    fireEvent.click(screen.getByRole('button', { name: '再练一次' }))
    expect(renderGate).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: '再练一次' })).toBeNull()
  })
  it('仅首步 judge 命中:末步(english)不开门,答完直通 onLessonComplete', async () => {
    const onComplete = vi.fn()
    const renderGate = vi.fn((ctx: { word: WordUnit; skill: SkillKey; cont: () => void }) => (
      <button onClick={ctx.cont}>先学一下</button>
    ))
    renderLesson({
      makeQuestions: (_w: WordUnit, s: SkillKey) => [{ kind: 'choice', prompt: s, options: [{ id: 'a', text: 'A' }], answerId: 'a' }] as unknown as Question[],
      stepGate: { judge: (_w, s) => s === 'pinyin', render: renderGate },
      onLessonComplete: onComplete,
    })
    expect(renderGate).toHaveBeenCalledTimes(1) // 首步(pinyin)门
    await userEvent.click(screen.getByRole('button', { name: '先学一下' }))
    answerChoice('A')
    await waitFor(() => expect(screen.getByText('hanzi')).toBeTruthy(), { timeout: 3000 }) // 第二步 judge false → 无门直出题
    expect(renderGate).toHaveBeenCalledTimes(1)
    answerChoice('A')
    await waitFor(() => expect(screen.getByText('english')).toBeTruthy(), { timeout: 3000 }) // 末步 judge false → 无门直出题
    expect(renderGate).toHaveBeenCalledTimes(1)
    answerChoice('A')
    await waitFor(() => expect(onComplete).toHaveBeenCalled(), { timeout: 3000 }) // 末步答完直通结课
  })
})
