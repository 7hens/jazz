import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import { UNITS } from './levels'
import { canPlace, slotsFor, starsFor } from './rules'
import { WRONG_PICK_THRESHOLD } from './mistakes'
import { PartRun, type PartItem, type QuestionEnd } from './PartRun'

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
function mount(items: readonly PartItem[], onQuestionEnd = vi.fn(async (_end: QuestionEnd) => {})) {
  const onDone = vi.fn()
  const view = render(
    <PartRun
      unit={unit}
      unitIndex={0}
      part="easy"
      items={items}
      speak={speak}
      onQuestionEnd={onQuestionEnd}
      onDone={onDone}
    />,
  )
  return { view, onDone, onQuestionEnd }
}

// 下面三个辅助沿用 `UnitEntry.test.tsx` 那套(托盘取块 / 读块身份 / 点选落位),
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

/**
 * 简单部分:把托盘中某一块**点错 `WRONG_PICK_THRESHOLD` 次** ⇒ 恰好记同样多次 miss,且那一块入错题池。
 * 手法:块身份在里层 `[data-value]`,点选走 `keyDown Enter` ——
 * 每次点错都会换 key 重挂**块本体**,但外层 `[data-block-id]` wrapper 身份稳定,故握着它连点是对的。
 */
function pickWrongToPool(match: (b: Block) => boolean): void {
  const host = trayBlocks().find((el) => match(blockOf(el)))
  expect(host, '托盘中找不到要故意点错的块').toBeDefined()
  for (let i = 0; i < WRONG_PICK_THRESHOLD; i++) {
    fireEvent.keyDown(host as HTMLElement, { key: 'Enter' })
  }
}

describe('PartRun', () => {
  it('部分内一道接一道:第一题结束后自动换到第二题', async () => {
    vi.useFakeTimers()
    const items: PartItem[] = [{ kind: 'level', levelIndex: 0 }, { kind: 'level', levelIndex: 1 }]
    const { view, onDone, onQuestionEnd } = mount(items)
    expect(view.container.textContent).toContain(unit.levels[0]!.emoji)

    solveCurrent(0)
    await advance(2000)

    expect(onQuestionEnd, '每题结束都该交一次账').toHaveBeenCalledTimes(1)
    const end = onQuestionEnd.mock.calls[0]![0] as QuestionEnd
    expect(end.levelId).toBe(unit.levels[0]!.id)
    expect(end.exact, '简单部分的错块按家族记账').toBe(false)
    // 一次不错 ⇒ 满星、错块为空。这两条是 Task 9 落库 / 喂错题池的输入,必须钉住零错这一端。
    expect(end.stars, '一次不错 = 满星').toBe(starsFor(0))
    expect(end.wrongBlocks, '一次不错 = 没有错块交出来').toEqual([])
    expect(onDone, '还有题没走完,不该交账').not.toHaveBeenCalled()
    expect(view.container.textContent).toContain(unit.levels[1]!.emoji)
    // 题位条跟着 `position` 走:换到第二题 ⇒ 两格里亮到第二格(宿主给的分母是真题数,不是写死三格)。
    const bar = document.querySelector<HTMLElement>('.pstage-bar')
    expect(bar, '简单题上该画题位条').not.toBeNull()
    expect(bar!.dataset.barTotal, '题位条按本串题数给格').toBe('2')
    expect(bar!.dataset.barDone, '换到第二题 ⇒ 亮到第二格').toBe('2')
    vi.useRealTimers()
  })

  it('错到阈值:错块交出来、星数按 starsFor 递减', async () => {
    vi.useFakeTimers()
    // 一道题就够 —— 只看这一题结束时交出的账目。
    const items: PartItem[] = [{ kind: 'level', levelIndex: 0 }]
    const { onQuestionEnd } = mount(items)

    // u1-0 是 é(e + 二声),四声块恒无处可落 —— 点错 WRONG_PICK_THRESHOLD 次:既记同样多次 miss,
    // 也把那一块送进错题池(poolRef)。
    pickWrongToPool((b) => b.type === 'tone' && b.value === '4')
    solveCurrent(0)
    await advance(2000)

    expect(onQuestionEnd).toHaveBeenCalledTimes(1)
    const end = onQuestionEnd.mock.calls[0]![0] as QuestionEnd
    // 星数不写死:按 starsFor 现算(点错 WRONG_PICK_THRESHOLD 次 ⇒ 就是这个档),星规改了这条跟着走。
    expect(end.stars, '星数按 starsFor(missCount) 算').toBe(starsFor(WRONG_PICK_THRESHOLD))
    // 错块必须**原样交出来** —— 只断长度会漏掉「交错了块」,故比到 type + value。
    expect(end.wrongBlocks, '错块要交出来').toHaveLength(1)
    expect(end.wrongBlocks[0], '交出来的正是那块点错的四声块').toMatchObject({ type: 'tone', value: '4' })
    vi.useRealTimers()
  })

  it('startIndex = 1:接着上次从第二题走,不回第一题', async () => {
    vi.useFakeTimers()
    const items: PartItem[] = [{ kind: 'level', levelIndex: 0 }, { kind: 'level', levelIndex: 1 }]
    const onQuestionEnd = vi.fn(async (_end: QuestionEnd) => {})
    const onDone = vi.fn()
    const view = render(
      <PartRun
        unit={unit}
        unitIndex={0}
        part="easy"
        items={items}
        // Task 9 的宿主靠它把「本部分第一道未通的题」传进来 —— 被吞掉则功能全废且无声。
        startIndex={1}
        speak={speak}
        onQuestionEnd={onQuestionEnd}
        onDone={onDone}
      />,
    )

    // 上屏的是第二题(不是第一题)—— 两道题图不同,两向都断死。
    expect(view.container.textContent, '上屏的是第二题').toContain(unit.levels[1]!.emoji)
    expect(view.container.textContent, '第一题不该出现').not.toContain(unit.levels[0]!.emoji)

    solveCurrent(1)
    await advance(2000)

    expect(onQuestionEnd).toHaveBeenCalledTimes(1)
    expect((onQuestionEnd.mock.calls[0]![0] as QuestionEnd).levelId, '交的是第二题的账').toBe(unit.levels[1]!.id)
    expect(onDone, 'startIndex=1 已经是最后一题').toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('最后一题走完交 onDone,不再往下走', async () => {
    vi.useFakeTimers()
    const items: PartItem[] = [{ kind: 'level', levelIndex: 0 }]
    const { onDone } = mount(items)
    solveCurrent(0)
    await advance(2000)
    expect(onDone).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('困难部分的错块按精确身份记账', async () => {
    vi.useFakeTimers()
    const items: PartItem[] = [{ kind: 'level', levelIndex: 0 }]
    const onQuestionEnd = vi.fn(async (_end: QuestionEnd) => {})
    const onDone = vi.fn()
    const view = render(
      <PartRun
        unit={unit}
        unitIndex={0}
        part="hard"
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

  it('不传 onQuestionEnd 时(复习部分)照走,只是不交账', async () => {
    vi.useFakeTimers()
    const items: PartItem[] = [{ kind: 'level', levelIndex: 0 }]
    const onDone = vi.fn()
    const view = render(
      <PartRun unit={unit} unitIndex={0} part="review" items={items} speak={speak} onDone={onDone} />,
    )
    expect(view.container.textContent).toContain(unit.levels[0]!.emoji)
    solveCurrent(0)
    await advance(2000)
    expect(onDone, '复习部分也不许卡住').toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
