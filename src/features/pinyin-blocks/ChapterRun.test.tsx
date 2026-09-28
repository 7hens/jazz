import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import { UNITS } from './levels'
import { canPlace, slotsFor } from './rules'
import { ChapterRun, type ChapterItem, type QuestionEnd } from './ChapterRun'

const unit = UNITS[0]!
const speak = vi.fn()

/** 推一段虚拟时间 —— 落块到「题结束」之间有一段动画(成功 1.6s / 焊死 2.1s)。 */
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms)
  })
}

// 显式给回调形参 `_end` 标型:vitest 4 的 `vi.fn` 按「实现」的函数签名推 `mock.calls` 的元素类型。
// 用 `vi.fn(async () => {})`(零参)会推成 `[]`,`calls[0]![0]` 就是 TS2493。
// 这里仍**不用** vitest 1 的元组泛型 `vi.fn<[], Promise<void>>`(vitest 4 下非法)。
function mount(items: readonly ChapterItem[], onQuestionEnd = vi.fn(async (_end: QuestionEnd) => {})) {
  const onDone = vi.fn()
  const view = render(
    <ChapterRun
      unit={unit}
      unitIndex={0}
      chapter="easy"
      items={items}
      speak={speak}
      onQuestionEnd={onQuestionEnd}
      onDone={onDone}
    />,
  )
  return { view, onDone, onQuestionEnd }
}

// 下面三个辅助**照抄** `LevelEntry.test.tsx:109-151` 的同名实现(托盘取块 / 读块身份 / 点选落位),
// 只把写死的 `UNITS[0].levels[0]` 换成「当前这一题」。别另发明一套取法 ——
// 那套已经踩过坑:块的身份印在里层 `[data-value]` 上,点选走的是 `keyDown Enter`(不是 click)。

/** 托盘里还没入槽的块。 */
function trayBlocks(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).filter(
    (el) => el.closest('[data-slot-id]') === null,
  )
}

/** 读一块托盘积木的身份 —— 类型与值印在里层的 .pblock 上。 */
function blockOf(el: HTMLElement): Block {
  const chip = el.querySelector<HTMLElement>('[data-value]')
  const type = chip?.dataset.type as BlockType | undefined
  const value = chip?.dataset.value
  if (!type || !(type in SPEAK_OF) || value === undefined) {
    throw new Error(`托盘块读不出身份:${chip?.outerHTML ?? '(没有块)'}`)
  }
  return { type, value }
}

/** 把**当前这一题**拼对:按槽序逐个点选正确块,一次不错。 */
function solveCurrent(levelIndex: number): void {
  for (const slot of slotsFor(unit.levels[levelIndex]!)) {
    const fits = trayBlocks().filter((el) => canPlace(blockOf(el), slot))
    const pick = fits.find((el) => blockOf(el).type === slot.type) ?? fits[0]
    expect(pick, `${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
}

describe('ChapterRun', () => {
  it('章内一道接一道:第一题结束后自动换到第二题', async () => {
    vi.useFakeTimers()
    const items: ChapterItem[] = [{ kind: 'level', levelIndex: 0 }, { kind: 'level', levelIndex: 1 }]
    const { view, onDone, onQuestionEnd } = mount(items)
    expect(view.container.textContent).toContain(unit.levels[0]!.emoji)

    solveCurrent(0)
    await advance(2000)

    expect(onQuestionEnd, '每题结束都该交一次账').toHaveBeenCalledTimes(1)
    const end = onQuestionEnd.mock.calls[0]![0] as QuestionEnd
    expect(end.levelId).toBe(unit.levels[0]!.id)
    expect(end.exact, '简单章的错块按家族记账').toBe(false)
    expect(onDone, '还有题没走完,不该交账').not.toHaveBeenCalled()
    expect(view.container.textContent).toContain(unit.levels[1]!.emoji)
    vi.useRealTimers()
  })

  it('最后一题走完交 onDone,不再往下走', async () => {
    vi.useFakeTimers()
    const items: ChapterItem[] = [{ kind: 'level', levelIndex: 0 }]
    const { onDone } = mount(items)
    solveCurrent(0)
    await advance(2000)
    expect(onDone).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('困难章的错块按精确身份记账', async () => {
    vi.useFakeTimers()
    const items: ChapterItem[] = [{ kind: 'level', levelIndex: 0 }]
    const onQuestionEnd = vi.fn(async (_end: QuestionEnd) => {})
    const onDone = vi.fn()
    const view = render(
      <ChapterRun
        unit={unit}
        unitIndex={0}
        chapter="hard"
        items={items}
        speak={speak}
        onQuestionEnd={onQuestionEnd}
        onDone={onDone}
      />,
    )
    expect(view.container.textContent).toContain(unit.levels[0]!.emoji)
    solveCurrent(0)
    await advance(2500)
    expect(onQuestionEnd).toHaveBeenCalledTimes(1)
    expect((onQuestionEnd.mock.calls[0]![0] as QuestionEnd).exact).toBe(true)
    vi.useRealTimers()
  })

  it('不传 onQuestionEnd 时(复习章)照走,只是不交账', async () => {
    vi.useFakeTimers()
    const items: ChapterItem[] = [{ kind: 'level', levelIndex: 0 }]
    const onDone = vi.fn()
    const view = render(
      <ChapterRun unit={unit} unitIndex={0} chapter="review" items={items} speak={speak} onDone={onDone} />,
    )
    expect(view.container.textContent).toContain(unit.levels[0]!.emoji)
    solveCurrent(0)
    await advance(2000)
    expect(onDone, '复习章也不许卡住').toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
