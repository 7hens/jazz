// 一串题的推进机:一道接一道自动走,走完把决定权交回宿主(回路径)。
// 复用 PinyinBlocksGame,只换入参 —— 不写第二套拼装台。
// **按题号换 key 重挂** —— 换题即清空,不在 effect 里 setState 补重置。
//
// 2026-10-14 起还多渲染一行「关名 · n/N」(可见文案 2026-10-15 由「第 n/N 遍」改来)
// —— 放在这一层是因为 `position` 只有这里算得出
// (见 return 处那段注)。它是游戏区的**兄弟**节点:孩子面重新有了字,但那两条汉字扫描照旧。

import { useCallback, useState } from 'react'
import type { AnswerKind } from '@/shared/services'
import type { Unit } from './levels'
import type { PracticeQuestion } from './practice'
import { scaffoldLevelIdOf, scaffoldQuestion, type ScaffoldQuestion } from './scaffold'
import { PinyinBlocksGame } from './PinyinBlocksGame'
import { starsFor, type Rng } from './rules'

/**
 * 由项号派生的可复现 rng:与 `PinyinBlocksGame.tsx` 里那份**逐行相同**(那里不发脚手架的牌)。
 *
 * 两份不许各写各的:同一颗种子在两处洗出不同顺序,「可复现」就只是各自可复现 ——
 * 同一道题的全拼遍与脚手架遍发出来的托盘顺序会不一致,那道题一换遍就像换了一道题。
 * `scaffold.ts` 里那份 `shuffle` 也是同一个理由抄的。
 */
function makeRng(seed: number): Rng {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * 一串题里的一项。
 *
 * **'level' 与 'scaffold' 是同一道题的两遍**(spec §2.1):脚手架遍挖空一类块、其余预填锁定,
 * 全拼遍一字不差。宿主把一道题展成这两项(`LessonEntry` 的 `flatMap`),本组件只管按序走。
 * 练习是**另一条路**:一道整题(全槽挖空)、不落库。
 */
export type QuestionItem =
  | Readonly<{ kind: 'level'; levelIndex: number }>
  | Readonly<{ kind: 'scaffold'; levelIndex: number }>
  | Readonly<{ kind: 'practice'; levelIndex: number; question: PracticeQuestion }>

/** 一道题结束的账目。宿主据此落库。 */
export type QuestionEnd = Readonly<{
  levelId: string
  /** 本题星级(0~3,`starsFor` 给的)。 */
  stars: number
}>

export type QuestionRunProps = {
  unit: Unit
  unitIndex: number
  /** 本题面身份:'easy' 走今天的玩法,'hard' 只比类型。练习由 `QuestionItem` 自己带。 */
  mode: 'easy' | 'hard'
  items: readonly QuestionItem[]
  /** 从这一项开始走(「接着上次」)。省略 = 从第 0 项。 */
  startIndex?: number
  speak: (text: string) => void
  playSound?: (cue: 'correct' | 'wrong' | 'victory' | 'tap') => void
  onBlock?: (kind: AnswerKind) => void
  /** 一道题结束。**不传 = 这一串不落库**(练习)。 */
  onQuestionEnd?: (end: QuestionEnd) => Promise<void>
  /** 本串走完 —— 宿主据此回路径。 */
  onDone: () => void
}

export function QuestionRun({
  unit,
  unitIndex,
  mode,
  items,
  startIndex = 0,
  speak,
  playSound,
  onBlock,
  onQuestionEnd,
  onDone,
}: QuestionRunProps) {
  // 起始题号在这里**冻结**:宿主每次渲染都会重算「本节第一道未通的题」,
  // 而走题过程中星级一直在变 —— 现算会把进度往回拽。本组件每次挂载只取一次初值。
  const [index, setIndex] = useState(startIndex)
  const item = items[index]

  /**
   * 每一项的脚手架题面,在**挂载时一次算完**并冻结 —— 与上面 `startIndex` 同一手法,
   * 这里的原因是承重的(spec §5):`scaffoldQuestion` 是「纯函数 + 注入 rng」,块 id 与托盘
   * 都由种子决定。盘面只初始化**一次**(`placement` 初值取 `prefill`),而 React 的
   * `useMemo` 不保证不重跑 —— 重算一次而种子变了,块 id 就漂了,盘面与托盘失配,
   * 屏幕上就是「块放不进去」。所以这里干脆连 rng 一起冻:种子 = 项号,同一项每次挂载同一副牌。
   *
   * 不用 `useMemo` 是有意的:它表达的是「可以重算」,而这条要的是「不许重算」。
   * 非脚手架项存 `null`,省掉一次无谓的题面计算。
   *
   * 「困难题不排脚手架遍」那条(spec §7)由**宿主**决定,不在这里兜 —— 那一层同时还决定
   * 落库键(`s` 后缀)。在这里悄悄把脚手架项退成全拼遍,会让项号与账目对不上,比不做更糟。
   */
  const [scaffolds] = useState<readonly (ScaffoldQuestion | null)[]>(() =>
    items.map((it, i) => {
      if (it.kind !== 'scaffold') return null
      const level = unit.levels[it.levelIndex]
      // 返 null = 这道题不产生脚手架遍(题里没有可挖的那类槽,spec §2.3 的兜底):
      // 照样往下走,组件那一侧自然退回全拼遍的盘面。
      return level ? scaffoldQuestion(level, unitIndex, makeRng(i + 1)) : null
    }),
  )

  const advance = useCallback(() => {
    if (index + 1 >= items.length) onDone()
    else setIndex(index + 1)
  }, [index, items.length, onDone])

  const onQuestionFinished = useCallback(
    async (missCount: number) => {
      const level = item ? unit.levels[item.levelIndex] : undefined
      if (item && item.kind !== 'practice' && onQuestionEnd && level) {
        // 脚手架遍与全拼遍是**两个键**(spec §2.6):脚手架遍落 `${id}s`,全拼遍落 `${id}`。
        // 「脚手架遍落库、全拼遍覆盖」因此是**换键**实现的,零 merge 改动 ——
        // 三层 merge 全是 `Math.max`,改它会撞「只升不降」那条事故后的铁律。
        const levelId = item.kind === 'scaffold' ? scaffoldLevelIdOf(level.id) : level.id
        // **先 await 再推进**:孩子在这一题的庆祝动画里按「回路径」,那时这一题必须已经落库。
        await onQuestionEnd({ levelId, stars: starsFor(missCount) })
      }
      advance()
    },
    [item, unit, onQuestionEnd, advance],
  )

  if (!item) return null

  // **进度只有一个数源** —— 与传给 `PinyinBlocksGame` 的 `position` 是同一个对象,
  // 不是另算的一份。这不是省事:那份 `position` 的分母是**遍数**(简单部分每道题跑两遍,
  // 脚手架遍 + 全拼遍,spec §2.1),五处测试断的就是它;屏幕上若另起一份算法,两处迟早漂,
  // 而漂掉的方向恰恰是那个**骗人的方向** —— 走完全部 10 遍而读数只到一半。
  const position = { done: index + 1, total: items.length }

  return (
    <>
      {/*
       * 关名 + 进度这一行(2026-10-14 产品裁定:「整屏没有一个字,都不知道是干什么的」)。
       *
       * **为什么落在 `QuestionRun` 而不是 `LessonEntry`**:`position` 在这一层算出来
       * (项号只有这里有),抬到 `LessonEntry` 得把 index 状态往上搬 —— 一次重构换一个一行字。
       *
       * **为什么落在 `[data-game-area]` 之外**:`PinyinBlocksGame.test.tsx` 有两条汉字扫描
       * (作答期间零汉字 / 拼对后直接文本含汉字的元素恰好一个),游戏区里不许出现任何可见汉字。
       * 这一行是 `PinyinBlocksGame` 的**兄弟节点**而不是子节点,那两条扫描照旧成立。
       *
       * **为什么练习页也出现它**:本组件同时服务 `LessonEntry` 与 `PracticeEntry`,两处语义一致
       * (都在说「这是哪一节 + 走到哪儿」),故**有意**不按宿主分叉 —— 分叉就得再搬一次状态。
       *
       * 措辞:**分母数的是遍,不是道题数** —— 这一点在数据与 `aria-label` 里都还在(见下面
       * `position` 那条);**可见文案按 2026-10-15 产品裁定写成 `n/N`,不带单位**。
       * ⚠️ 那是一条**产品取舍**:单位不见了,看屏幕的孩子就少了「这数的是遍」这个提示 ——
       *   将来若有人觉得读不出单位,**改回可见文案即可,但分母不许改成道题数**(那才是撒谎)。
       *
       * ⚠️ `aria-label` **故意比可见文案长**(「本节第 3 遍,共 3 遍」):读屏用户拿不到
       *   `3/3` 这个视觉读法,那句话是给他们补的。**它与可见文案不一致是故意的**,
       *   不是忘了改 —— 真要统一,先确认读屏用户不会因此少听到单位。
       */}
      <p
        data-run-label
        aria-label={`${unit.name} · 本节第 ${position.done} 遍,共 ${position.total} 遍`}
        className="flex items-baseline justify-center gap-2 px-4 pt-1 pb-2 text-center"
      >
        <span className="text-base font-bold tracking-[0.18em] text-ink-2">{unit.name}</span>
        {/* 分隔点只是排版,不给读屏念 —— 上面那行 aria-label 已经把两半连成一句了。 */}
        <span aria-hidden className="text-sm text-ink-3">
          ·
        </span>
        {/* 2026-10-15 产品裁定:可见文案由「第 n/N 遍」改为「n/N」。分母的**语义没变**
            (仍是遍数,不是道题数 —— 见下面 `position` 那条注释与 W-F1 组),**变的只是屏幕上
            写不写这个单位**。`tabular-nums` 保留:分子分母每题都变,等宽数字才不跳。 */}
        <span className="text-sm font-semibold tabular-nums tracking-[0.1em] text-ink-3">
          {position.done}/{position.total}
        </span>
      </p>
      <PinyinBlocksGame
        // 换题即换 key ⇒ 盘面、提示全部重来。
        key={`${item.kind}-${index}`}
        unitIndex={unitIndex}
        levelIndex={item.levelIndex}
        stage={mode}
        practice={item.kind === 'practice' ? item.question : null}
        scaffold={item.kind === 'scaffold' ? (scaffolds[index] ?? null) : null}
        // **分母是「遍」不是「道题」** —— 与 `LESSON_MAX` 那条口径(spec §3.4)是两回事:
        // 那个常量切的是**课表怎么分节**(一道题算一道),而这一行是**这一趟走到哪儿了**的进度指示,
        // 它的单位就是孩子手上这一串里要答的遍数。一节 5 道题改后是 10 遍,就该写 10 ——
        // 写 5 会让孩子在走完全部 10 遍之后看到读数只到一半,那是在骗人。
        position={position}
        speak={speak}
        playSound={playSound}
        onBlock={onBlock}
        onQuestionEnd={(result) => { void onQuestionFinished(result.missCount) }}
      />
    </>
  )
}
