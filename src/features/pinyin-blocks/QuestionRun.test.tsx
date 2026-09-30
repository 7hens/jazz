import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import { UNITS } from './levels'
import { canPlace, slotsFor, starsFor } from './rules'
import { wholeReviewQuestion } from './practice'
import { QuestionRun, type QuestionEnd, type QuestionItem } from './QuestionRun'

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
function mount(items: readonly QuestionItem[], onQuestionEnd = vi.fn(async (_end: QuestionEnd) => {})) {
  const onDone = vi.fn()
  const view = render(
    <QuestionRun
      unit={unit}
      unitIndex={0}
      mode="easy"
      items={items}
      speak={speak}
      onQuestionEnd={onQuestionEnd}
      onDone={onDone}
    />,
  )
  return { view, onDone, onQuestionEnd }
}

// 下面三个辅助沿用本目录 Entry 测试那套(托盘取块 / 读块身份 / 点选落位),
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

/** 点一块**恒无处可落**的块 ⇒ 记一次 miss(u1-0 é 只要二声,「声调块 4」永远放不下)。 */
function missOnce(): void {
  fireEvent.keyDown(document.querySelector<HTMLElement>('[aria-label="声调块 4"]') as HTMLElement, { key: 'Enter' })
}

/** 练习的一道整题(全部槽挖空)。种子固定 ⇒ 题面稳,断言不看发牌运气。 */
const practiceItem = (levelIndex: number): QuestionItem => ({
  kind: 'practice',
  levelIndex,
  question: wholeReviewQuestion(unit.levels[levelIndex]!, 0, () => 0.5),
})

describe('QuestionRun', () => {
  it('一串内一道接一道:第一题结束后自动换到第二题', async () => {
    vi.useFakeTimers()
    const items: QuestionItem[] = [{ kind: 'level', levelIndex: 0 }, { kind: 'level', levelIndex: 1 }]
    const { view, onDone, onQuestionEnd } = mount(items)
    expect(view.container.textContent).toContain(unit.levels[0]!.emoji)

    solveCurrent(0)
    await advance(2000)

    expect(onQuestionEnd, '每题结束都该交一次账').toHaveBeenCalledTimes(1)
    const end = onQuestionEnd.mock.calls[0]![0] as QuestionEnd
    expect(end.levelId).toBe(unit.levels[0]!.id)
    // 一次不错 ⇒ 满星。这是宿主落库的输入,必须钉住零错这一端。
    expect(end.stars, '一次不错 = 满星').toBe(starsFor(0))
    expect(onDone, '还有题没走完,不该交账').not.toHaveBeenCalled()
    expect(view.container.textContent).toContain(unit.levels[1]!.emoji)
    // 题位条跟着 `position` 走:换到第二题 ⇒ 两格里亮到第二格(宿主给的分母是真题数,不是写死三格)。
    const bar = document.querySelector<HTMLElement>('.pstage-bar')
    expect(bar, '简单题上该画题位条').not.toBeNull()
    expect(bar!.dataset.barTotal, '题位条按本串题数给格').toBe('2')
    expect(bar!.dataset.barDone, '换到第二题 ⇒ 亮到第二格').toBe('2')
    vi.useRealTimers()
  })

  it('错了几次,星数就按 starsFor 递减', async () => {
    vi.useFakeTimers()
    // 一道题就够 —— 只看这一题结束时交出的账目。
    const items: QuestionItem[] = [{ kind: 'level', levelIndex: 0 }]
    const { onQuestionEnd } = mount(items)

    missOnce()
    missOnce()
    solveCurrent(0)
    await advance(2000)

    expect(onQuestionEnd).toHaveBeenCalledTimes(1)
    const end = onQuestionEnd.mock.calls[0]![0] as QuestionEnd
    // 星数不写死:按 starsFor 现算(错两次 ⇒ 就是这个档),星规改了这条跟着走。
    expect(end.stars, '星数按 starsFor(missCount) 算').toBe(starsFor(2))
    expect(end.stars, '错两次不该还是满星').not.toBe(starsFor(0))
    vi.useRealTimers()
  })

  it('startIndex = 1:接着上次从第二题走,不回第一题', async () => {
    vi.useFakeTimers()
    const items: QuestionItem[] = [{ kind: 'level', levelIndex: 0 }, { kind: 'level', levelIndex: 1 }]
    const onQuestionEnd = vi.fn(async (_end: QuestionEnd) => {})
    const onDone = vi.fn()
    const view = render(
      <QuestionRun
        unit={unit}
        unitIndex={0}
        mode="easy"
        items={items}
        // 宿主靠它把「本串第一道未通的题」传进来 —— 被吞掉则功能全废且无声。
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
    const items: QuestionItem[] = [{ kind: 'level', levelIndex: 0 }]
    const { onDone } = mount(items)
    solveCurrent(0)
    await advance(2000)
    expect(onDone).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  // `mode` 是**题面身份**,不是本组件自己用的:它必须原样落到 PinyinBlocksGame 的 `stage` 上,
  // 否则困难串会按简单题发牌(门禁跟着松掉)。断盘面上的困难材质类,不反射内部变量。
  it('mode=hard 落到盘面上', () => {
    const { container } = render(
      <QuestionRun
        unit={unit}
        unitIndex={0}
        mode="hard"
        items={[{ kind: 'level', levelIndex: 0 }]}
        speak={speak}
        onDone={vi.fn()}
      />,
    )
    expect(container.querySelector('.ptray--hard'), '困难串该走困难盘面').not.toBeNull()
  })

  // 练习是**整题重考**:走完就往下走,但**不落库** —— 宿主压根拿不到账目(见 spec §8)。
  it('练习项照走,只是不交账', async () => {
    vi.useFakeTimers()
    const items: QuestionItem[] = [practiceItem(0)]
    const onQuestionEnd = vi.fn(async (_end: QuestionEnd) => {})
    const onDone = vi.fn()
    const view = render(
      <QuestionRun
        unit={unit}
        unitIndex={0}
        mode="easy"
        items={items}
        speak={speak}
        onQuestionEnd={onQuestionEnd}
        onDone={onDone}
      />,
    )
    expect(view.container.textContent).toContain(unit.levels[0]!.emoji)
    // 练习是整题挖空 ⇒ 全部槽都空着(与简单题同形,区别在「不记账」)。
    expect(
      document.querySelectorAll('[data-slot-id] [data-value]').length,
      '练习恒全槽挖空',
    ).toBe(0)

    solveCurrent(0)
    await advance(2000)

    expect(onQuestionEnd, '练习不落库').not.toHaveBeenCalled()
    expect(onDone, '练习走完照样回宿主').toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
