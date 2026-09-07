import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BasicsProgressRow, BasicsService, UserSettings } from '@/shared/services'
import { ColdStartWizard } from './ColdStartWizard'

const settings: UserSettings = {
  enableChinese: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}
const noop = () => {}

function createFakeBasics() {
  const load = vi.fn(async () => {})
  const recordAnswer = vi.fn(async (_unitKey: string, _correct: boolean) => {})
  const markTaught = vi.fn(async (_unitKeys: readonly string[]) => {})
  const saveAll = vi.fn(async (_rows: readonly BasicsProgressRow[]) => {})
  const service: BasicsService = {
    load,
    recordAnswer,
    markTaught,
    saveAll,
    subscribe: () => () => undefined,
    getSnapshot: () => ({ status: 'ready', data: {} }),
  }
  return { service, load, recordAnswer, markTaught, saveAll }
}

/** 渲染向导(默认 settings 双轨开)。 */
function renderWizard(overrides: { settings?: UserSettings; onClose?: () => void } = {}) {
  const { service, load, recordAnswer, markTaught, saveAll } = createFakeBasics()
  const onClose = overrides.onClose ?? vi.fn()
  const utils = render(
    <ColdStartWizard
      settings={overrides.settings ?? settings}
      basics={service}
      speak={() => true}
      playSound={noop}
      onClose={onClose}
    />,
  )
  return { basics: service, load, recordAnswer, markTaught, saveAll, onClose, ...utils }
}

/** 点当前题首个选项(题面 shuffle 随机;对错都推进,故任选即可)。 */
function clickAnyOption(container: HTMLElement) {
  const grid = Array.from(container.querySelectorAll('div.grid')).find((el) => el.querySelectorAll('button').length > 0)
  expect(grid, '应存在选项 grid').toBeTruthy()
  const btn = grid!.querySelectorAll('button')[0] as HTMLElement
  fireEvent.click(btn)
}

/** 新确认制:点「确定」提交当前选中。 */
function confirmAnswer() {
  fireEvent.click(screen.getByRole('button', { name: '确定' }))
}

const ADVANCE = () => act(() => { vi.advanceTimersByTime(700) })

describe('ColdStartWizard', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { cleanup(); vi.useRealTimers() })

  it('逐题推进并答题 → 全程零写,「开始游戏」才一次性 saveAll(非空)+ onClose', () => {
    const { recordAnswer, saveAll, onClose, container } = renderWizard()

    // intro → question:首题(声母 g 锚点)题干出现
    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    expect(screen.getByText(/声母|韵母|第几声|听一听/)).toBeInTheDocument()

    const total = 6 // 双轨开 → 3 pinyin + 3 english 探针
    for (let i = 0; i < total; i++) {
      clickAnyOption(container)
      confirmAnswer()
      ADVANCE()
      // 逐题只本地记录,不落库:中途答几题就「跳过」也不会提前写行
      expect(recordAnswer).not.toHaveBeenCalled()
      expect(saveAll).not.toHaveBeenCalled()
    }

    // done → 「开始游戏」一次性写入基线并收尾
    fireEvent.click(screen.getByRole('button', { name: '开始游戏' }))
    expect(recordAnswer).not.toHaveBeenCalled()
    expect(saveAll).toHaveBeenCalledTimes(1)
    const rows = saveAll.mock.calls[0][0] as readonly BasicsProgressRow[]
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.taughtCount === 0)).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('跳过/退出 → 不 saveAll,onClose', () => {
    const { saveAll, recordAnswer, onClose } = renderWizard()

    fireEvent.click(screen.getByRole('button', { name: /跳过|退出/ }))

    expect(saveAll).not.toHaveBeenCalled()
    expect(recordAnswer).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('家长关英语 → 只抽拼音段,无英语听选题', () => {
    const { saveAll, recordAnswer, container } = renderWizard({ settings: { ...settings, enableEnglish: false } })

    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    expect(screen.getByText(/声母/)).toBeInTheDocument() // 首题仍是拼音声母锚点题

    for (let i = 0; i < 3; i++) {
      clickAnyOption(container)
      confirmAnswer()
      ADVANCE()
    }

    expect(screen.getByRole('button', { name: '开始游戏' })).toBeInTheDocument()
    expect(screen.queryByText(/听一听,选出你听到的字母/)).not.toBeInTheDocument()
    expect(saveAll).toHaveBeenCalledTimes(0) // 未点「开始游戏」,尚未写基线
    expect(recordAnswer).not.toHaveBeenCalled() // 逐题零写:答完就跳也不落库
  })

  it('家长关汉语 → 只抽英语听选段,无拼音题(0004 纯英语档案镜像)', () => {
    const { saveAll, recordAnswer, onClose, container } = renderWizard({ settings: { ...settings, enableChinese: false } })

    fireEvent.click(screen.getByRole('button', { name: '开始' }))
    expect(screen.getByText(/听一听,选出你听到的字母/)).toBeInTheDocument() // 首题是英语听选探针

    for (let i = 0; i < 3; i++) {
      clickAnyOption(container)
      confirmAnswer()
      ADVANCE()
    }

    expect(screen.getByRole('button', { name: '开始游戏' })).toBeInTheDocument()
    expect(screen.queryByText(/声母/)).not.toBeInTheDocument()

    // 「开始游戏」写基线:只答过 english 轨 → 只产英语单元行,无 pinyin 行
    fireEvent.click(screen.getByRole('button', { name: '开始游戏' }))
    expect(recordAnswer).not.toHaveBeenCalled()
    expect(saveAll).toHaveBeenCalledTimes(1)
    const rows = saveAll.mock.calls[0][0] as readonly BasicsProgressRow[]
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((r) => r.unitKey.startsWith('english:'))).toBe(true)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('家长双关(防御兜底)→ items 空,挂载即 onClose 且零写', () => {
    const { saveAll, recordAnswer, onClose } = renderWizard({
      settings: { ...settings, enableChinese: false, enableEnglish: false },
    })

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(saveAll).not.toHaveBeenCalled()
    expect(recordAnswer).not.toHaveBeenCalled()
  })
})
