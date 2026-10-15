import { act, fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import { UNITS } from './levels'
import { canPlace, slotsFor, starsFor } from './rules'
import { wholeReviewQuestion } from './practice'
import { scaffoldLevelIdOf } from './scaffold'
import { HAN_TEXT } from '@/shared/testing/han-text'
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

/**
 * 只填**屏幕上还空着**的槽。脚手架遍用它:`solveCurrent` 会去动预填槽,而预填块压根不在托盘里,
 * 那条路走到预填槽就会炸(且炸的是断言不是功能)。
 */
function solveEmptyOnScreen(levelIndex: number): void {
  for (const slot of slotsFor(unit.levels[levelIndex]!)) {
    if (document.querySelector(`[data-slot-id="${slot.id}"] .pblock`)) continue
    const pick = trayBlocks().find((el) => canPlace(blockOf(el), slot))
    expect(pick, `${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
}

/** 托盘的「牌面」:块 id + 身份。盘面靠 blockId 反查块,这张签名变了就等于换了盘。 */
function traySignature(): string[] {
  return trayBlocks()
    .map((el) => {
      const chip = el.querySelector<HTMLElement>('[data-value]')
      return `${el.dataset.blockId}:${chip?.dataset.type}:${chip?.dataset.value}`
    })
    .sort()
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

/** 脚手架遍的那一项(题面由 `QuestionRun` 自己算并冻结,这里只给题号)。 */
const scaffoldItem = (levelIndex: number): QuestionItem => ({ kind: 'scaffold', levelIndex })

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
    // ⚠️ 这里曾经断的是那排画出来的题位条;2026-10-14 产品裁定**把它整条删掉**(不许压在 emoji 上方),
    // 于是改断 `data-question-total` / `data-question-done` —— **分母仍然是遍数**,这一点不能因为
    // 「不再显示」就顺手改成道题数。观测点搬了家,语义没变。
    const game = view.container.querySelector<HTMLElement>('[data-game-area]')!
    expect(game.dataset.questionTotal, '分母按本串题数(=遍数)给').toBe('2')
    expect(game.dataset.questionDone, '换到第二题 ⇒ 走到第二题').toBe('2')
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

  // 一道题的两遍(spec §2.1):脚手架遍在屏上**预填非目标槽**,全拼遍回到今天的样子。
  // 落库是**两个键**(spec §2.6):脚手架遍 `${id}s`、全拼遍 `${id}`。
  // 顺序也断:题位条与落库都按项序走,两遍的键写反了会让「先脚手架后全拼」变成空话。
  it('一道题跑两遍:先脚手架(预填 + 落 `${id}s`),后全拼(全空 + 落 `${id}`)', async () => {
    vi.useFakeTimers()
    const items: QuestionItem[] = [scaffoldItem(0), { kind: 'level', levelIndex: 0 }]
    const { view, onQuestionEnd, onDone } = mount(items)
    const level = unit.levels[0]!

    // 第一遍:u1 挖韵母 ⇒ 声调槽预填锁定,韵母槽空着。
    expect(document.querySelector('[data-slot-id="s0-t"] .pblock'), '声调槽该是预填的').not.toBeNull()
    expect(document.querySelector('[data-slot-id="s0-f"]')?.getAttribute('aria-label')).toBe('空槽')

    solveEmptyOnScreen(0)
    await advance(2000)
    expect(onQuestionEnd.mock.calls[0]![0] as QuestionEnd).toMatchObject({
      levelId: scaffoldLevelIdOf(level.id),
      stars: starsFor(0),
    })

    // 第二遍:同一道题、同一张图,盘面回到全空(spec §2.1「全拼遍 = 今天的玩法,一字不差」)。
    expect(document.querySelectorAll('[data-slot-id] .pblock'), '全拼遍不该有预填').toHaveLength(0)
    solveCurrent(0)
    await advance(2000)
    expect(onQuestionEnd.mock.calls[1]![0] as QuestionEnd).toMatchObject({ levelId: level.id })

    expect(onQuestionEnd.mock.calls.map((c) => (c[0] as QuestionEnd).levelId)).toEqual([
      scaffoldLevelIdOf(level.id),
      level.id,
    ])
    expect(onDone, '两遍走完才交回宿主').toHaveBeenCalledTimes(1)
    // 分母按**遍**走(见 QuestionRun 里 position 那条注释):一节 3 道题改后是 6 格。
    // 同上,断的是观测锚点,不是那排画出来的格子 —— 那排格子 2026-10-14 已随题位条一并删除。
    const game = view.container.querySelector<HTMLElement>('[data-game-area]')!
    expect(game.dataset.questionTotal, '脚手架遍 + 全拼遍 ⇒ 两遍').toBe('2')
    expect(game.dataset.questionDone, '两遍走完').toBe('2')
    expect(view.container.textContent).toContain(level.emoji)
    vi.useRealTimers()
  })

  // 承重的一条(spec §5):块 id 与托盘必须稳定。盘面只初始化**一次**(`placement` 初值取 `prefill`),
  // 一旦题面被重算而种子变了,盘面与托盘就失配 —— 屏幕上就是「块放不进去」。
  // 断成两半:① 重挂一次仍是同一副牌(题源可复现);② 重渲染不换牌(题面在挂载时就冻住)。
  it('脚手架遍的牌面稳定:重挂一次、重渲染若干次都是同一副', () => {
    const first = mount([scaffoldItem(0)])
    const dealt = traySignature()
    expect(dealt.length, '脚手架遍的托盘该有几块').toBeGreaterThan(0)
    first.view.unmount()

    const second = mount([scaffoldItem(0)])
    expect(traySignature(), '同一项重挂一次必须发同一副牌').toEqual(dealt)
    // `items` 换个数组身份再渲一次(宿主每次渲染重算 items 是常态):盘面不许跟着换牌。
    second.view.rerender(
      <QuestionRun
        unit={unit}
        unitIndex={0}
        mode="easy"
        items={[scaffoldItem(0)]}
        speak={speak}
        onQuestionEnd={vi.fn(async (_end: QuestionEnd) => {})}
        onDone={vi.fn()}
      />,
    )
    expect(traySignature(), '重渲染换了牌 = 盘面与托盘失配').toEqual(dealt)
  })

  // 2026-10-14 产品裁定:「整屏没有一个字,都不知道是干什么的」⇒ 关名 + 进度这一行回到孩子面。
  // 断的是**值来自哪**(关名取 `unit.name`、进度取 `position`),不是措辞 —— 措辞产品随时可以再改,
  // 而「关名与进度这两个数不许各算各的」是结构,改了就跑偏。
  it('关名 + 进度那一行:关名取 unit.name,分母是遍数', async () => {
    vi.useFakeTimers()
    // 一道题跑两遍(脚手架遍 + 全拼遍):分母必须是 **2**,不是道题数 1。
    const items: QuestionItem[] = [scaffoldItem(0), { kind: 'level', levelIndex: 0 }]
    const { view } = mount(items)
    const label = () => view.container.querySelector<HTMLElement>('[data-run-label]')!
    const game = () => view.container.querySelector<HTMLElement>('[data-game-area]')!

    expect(label().textContent).toContain(unit.name)
    expect(label().textContent).toContain('1/2')

    // **同一个数**:这一行的读数与观测锚点上那对 data-* 恒等 —— 两处不许各算一份。
    expect(label().textContent).toContain(`/${game().dataset.questionTotal}`)
    expect(label().textContent).toContain(`${game().dataset.questionDone}/`)

    // 换题 ⇒ 分子跟着走、分母不动。
    solveEmptyOnScreen(0)
    await advance(2000)
    solveCurrent(0)
    await advance(2000)
    expect(label().textContent, '走完第二遍 = 2/2').toContain('2/2')
    // ⚠️ **可见文案不带单位,但 `aria-label` 必须带** —— 分母数的是遍,不是道题数。
    // 读屏用户拿不到 `2/2` 这个视觉读法,那句话是他们唯一知道「这数的是遍」的地方。
    // 去掉它,这两个数字对读屏用户就变成了没有单位的裸数。
    expect(label().getAttribute('aria-label'), '读屏文案丢了「遍」—— 分母的语义只剩在代码注释里').toBe(
      `${unit.name} · 本节第 2 遍,共 2 遍`,
    )
    vi.useRealTimers()
  })

  // ⚠️ 这条把「文字不进游戏区」钉死 —— `PinyinBlocksGame.test.tsx` 有两条汉字扫描
  // (作答期间游戏区零汉字 / 拼对后直接文本含汉字的元素**恰好一个** = 答案行的同音汉字)。
  // 那一行是**兄弟**节点而不是子节点,那两条才成立;哪天有人图省事把它挪进 `[data-game-area]`,
  // 两条当场红 —— 这里让它有个更早、更直白的现场。
  it('关名 + 进度那一行在游戏区之外(挪进去,作答期间零汉字那条就破了)', () => {
    const items: QuestionItem[] = [scaffoldItem(0), { kind: 'level', levelIndex: 0 }]
    const { view } = mount(items)
    const label = view.container.querySelector<HTMLElement>('[data-run-label]')
    expect(label, '这一行该渲染出来').not.toBeNull()
    expect(label!.closest('[data-game-area]'), '文字被挪进游戏区了').toBeNull()
    // 它确实带汉字 —— 否则上面那句可能只是「压根没渲染」的空绿。
    expect(label!.textContent).toMatch(HAN_TEXT)
  })
})
