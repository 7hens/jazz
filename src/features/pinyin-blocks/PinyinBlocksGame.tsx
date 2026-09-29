import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hintFor, speakOf, type Block } from './blocks'
import { UNITS, losesDots, type Level } from './levels'
import {
  autoTargetId,
  autoTypeTargetId,
  buildBlocks,
  canPlace,
  HARD_RETRIES,
  isComplete,
  sameTypeOnly,
  slotsFor,
  starsFor,
  wrongSlotIds,
  type Rng,
  type Slot,
  type TrayBlock,
} from './rules'
import { addToPool, exactPoolKey, notePick, type MistakePool, type PickCounts, type ReviewQuestion } from './mistakes'
import { BlockChip } from './BlockChip'
import { StageBar, StageDots, type StageId } from './StageBar'
import { cn } from '@/shared/ui/utils'
import type { AnswerKind } from '@/shared/services'

/** 所有点击目标 ≥ 44px —— 4-8 岁的手指够得着。 */
const MAIN_BOX = 'h-[4.5rem] w-[4.5rem] sm:h-[5.25rem] sm:w-[5.25rem]'
const TONE_BOX = 'h-12 w-12'
const TRAY_BOX = 'h-[4.5rem] w-[4.5rem]'
const TRAY_BOX_TONE = 'h-14 w-14 p-3.5'
/** 入槽的声调块:与槽同尺寸,靠 padding 把走势线收到与托盘块一样大。
 *  块比槽大就会向下溢出、压住下面那块 —— 托盘的 56px 是给手指的,不该跟进来。 */
const PLACED_TONE = 'p-2.5'

type Status = 'playing' | 'wrong' | 'solved'

/** 部分结束交回的账目。入口页据此决定下一部分。 */
export type PartResult = Readonly<{
  /** 本部分累计的错误次数。复习部分恒为 0 —— 星在进复习部分之前就落库了(spec §3.9)。 */
  missCount: number
  /** 本部分新进错题池的块。 */
  wrongBlocks: readonly Block[]
  /** 困难部分重试用尽 —— 本部分失败,但**不阻塞**,继续往下走。其余情形恒 false。 */
  failed: boolean
}>

export type PinyinBlocksGameProps = {
  /** 朗读(拼音串)。由 Entry 从 SpeechService 注入 —— feature 内不碰 useService。 */
  speak: (text: string) => void
  playSound?: (cue: 'correct' | 'wrong' | 'victory' | 'tap') => void
  /** 每放一块上报一次 —— 连击靠它驱动。放对 'first',放错 'wrong'。 */
  onBlock?: (kind: AnswerKind) => void
  unitIndex?: number
  levelIndex?: number
  /** 本部分身份。默认 'easy' = 今天的玩法(门禁 canPlace、托盘同 buildBlocks 现状)。 */
  stage?: 'easy' | 'hard'
  /** 复习部分的小题。给了它就走复习口径:canPlace 门禁 + 预填槽 + 限定托盘 + 不记 miss。 */
  review?: ReviewQuestion | null
  /** 复习部分的小题进度(当前第几道 / 共几道)。只影响画点。 */
  reviewProgress?: { done: number; total: number }
  /** 部分结束交回账目。给了它就不再走 onSolved / 自走那条路 —— 由入口页决定下一部分。 */
  onPartEnd?: (result: PartResult) => void
  /** 通关:交出本关星级(1..3),由入口页负责落库与推进。 */
  onSolved?: (stars: number) => void
  onAdvance?: (unit: number, level: number) => void
}

/** 槽位的显示尺寸:声调槽是圆片,其余同宽。 */
function boxFor(slot: Slot): string {
  return slot.type === 'tone' ? TONE_BOX : MAIN_BOX
}

/**
 * 指针下方的槽。幽灵块带 pointer-events:none,故不会挡在这里。
 *
 * **已填的槽也算命中** —— 排除掉的话,拖块到已占槽就是「没落在任何地方」,
 * 静默什么都不发生。命中一律交给 placeBlock 判:放不下当场报错,放得下就替换。
 */
function slotIdUnder(x: number, y: number): string | null {
  const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-slot-id]')
  return hit?.dataset.slotId ?? null
}

/** 由轮次号派生的可复现 rng:同一轮的发牌稳定,重开一轮必然换一副。 */
function makeRng(seed: number): Rng {
  let s = (seed * 2654435761) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

type RoundProps = {
  unitIdx: number
  lvlIdx: number
  round: number
  speak: (text: string) => void
  playSound?: PinyinBlocksGameProps['playSound']
  onBlock?: (kind: AnswerKind) => void
  onSolved?: (stars: number) => void
  stage: 'easy' | 'hard'
  review: ReviewQuestion | null
  reviewProgress?: { done: number; total: number }
  onPartEnd?: (result: PartResult) => void
}

/**
 * 一轮 = 一道题的全部可变状态。
 * 状态重置靠外层换 key 重挂,而不是「effect 里 setState」——
 * 后者每一关都要多渲染一次,而且是 React 里最容易出竞态的写法。
 */
function PinyinRound({
  unitIdx,
  lvlIdx,
  round,
  speak,
  playSound,
  onBlock,
  onSolved,
  stage,
  review,
  reviewProgress,
  onPartEnd,
}: RoundProps) {
  const unit = UNITS[unitIdx] ?? UNITS[0]!
  const level: Level = unit.levels[lvlIdx] ?? unit.levels[0]!

  /** 三种口径。复习部分压过 stage —— 它自己就是一部分。类型直接借 StageId,免得两处各写一遍联合类型。 */
  const mode: StageId = review ? 'review' : stage
  const hard = mode === 'hard'
  /** 复习部分不记 miss、不上报连击 —— 星在进这一部分之前就落库了(spec §3.9)。 */
  const penalized = mode !== 'review'

  const slots = useMemo(() => slotsFor(level), [level])
  // readonly:复习部分的托盘直接来自 `ReviewQuestion.tray`(契约就是只读的),这里不复制它。
  const tray: readonly TrayBlock[] = useMemo(
    () =>
      review
        ? review.tray
        : buildBlocks(level, unitIdx, makeRng(round), { hard }).map((b, i) => ({ ...b, id: `b${i}` })),
    [level, unitIdx, round, review, hard],
  )

  /** 预填的槽不能拿回 —— 复习部分的考点就是挖空的那几个槽(spec §3.7)。 */
  const locked = useMemo(() => new Set(Object.keys(review?.prefill ?? {})), [review])

  // 复习部分带预填:其余槽用正确块填好,孩子只动挖空的那几个。
  const [placement, setPlacement] = useState<Record<string, string>>(() => ({ ...(review?.prefill ?? {}) }))
  const [status, setStatus] = useState<Status>('playing')
  const [wrongIds, setWrongIds] = useState<readonly string[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverSlot, setHoverSlot] = useState<string | null>(null)
  const [burst, setBurst] = useState(false)

  /** 本关累计错误次数。星级靠它,提示回强也靠它 —— 「卡住了」是同一种信号。 */
  const [missCount, setMissCount] = useState(0)
  const missRef = useRef(0)
  /** 同步计数:placeBlock 的闭包里读到的是旧 state,而判定发生在同一次调用里。
      复习部分恒不计数 —— 星在进这一部分之前就落库了(spec §3.9)。 */
  function noteMiss() {
    if (!penalized) return
    missRef.current += 1
    setMissCount(missRef.current)
  }

  /**
   * 错题池 —— **关内状态**,不持久化、不跨关(产品裁定「复习部分只考本关」)。
   * 只在部分末交回入口页,不需要触发重渲染,故用 ref。
   */
  const poolRef = useRef<MistakePool>([])
  /** 简单部分的点错计数:按块 id(见 notePick)。 */
  const picksRef = useRef<PickCounts>({})

  /**
   * 记一次「选中了错块」。简单部分攒够 WRONG_PICK_THRESHOLD 才进池;困难部分当场进池
   * (那一部分每一次判错都是真错,没有「手滑」与「不会」的分别)。复习部分不记。
   */
  const noteWrongBlock = useCallback(
    (block: Block, blockId: string) => {
      if (!penalized) return
      if (hard) {
        poolRef.current = addToPool(poolRef.current, [block], exactPoolKey)
        return
      }
      const { counts, reached } = notePick(picksRef.current, blockId)
      picksRef.current = counts
      if (reached) poolRef.current = addToPool(poolRef.current, [block])
    },
    [hard, penalized],
  )

  /** 本关此刻的提示档:基线由单元给,连错 2 次临时回强(只升不降)。 */
  const hint = hintFor(unit.id, missCount, mode)

  const timer = useRef<number | null>(null)
  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }, [])
  useEffect(() => clearTimer, [clearTimer])

  /** 拖错槽时的即时反馈。带自增序号是为了让同一个槽连续被拒时也能重放动画
   *  —— 只切 class 的话第二次挂上去的类和第一次一样,CSS 动画不会重播。 */
  const [reject, setReject] = useState<{ id: string; n: number } | null>(null)
  const rejectTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (rejectTimer.current !== null) window.clearTimeout(rejectTimer.current)
    },
    [],
  )
  const flashReject = useCallback((slotId: string) => {
    setReject((cur) => ({ id: slotId, n: (cur?.n ?? 0) + 1 }))
    if (rejectTimer.current !== null) window.clearTimeout(rejectTimer.current)
    rejectTimer.current = window.setTimeout(() => setReject(null), 520)
  }, [])

  /** 点错块的即时反馈(与 flashReject 同构:同一个自增序号驱动,连续点同一块也能重放动画)。
      今天点错块**只有声音** —— 静音环境(平板很常见)里孩子的体验是「点了它一下,什么都没发生」。 */
  const [rejectBlock, setRejectBlock] = useState<{ id: string; n: number } | null>(null)
  const rejectBlockTimer = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (rejectBlockTimer.current !== null) window.clearTimeout(rejectBlockTimer.current)
    },
    [],
  )
  const flashRejectBlock = useCallback((blockId: string) => {
    setRejectBlock((cur) => ({ id: blockId, n: (cur?.n ?? 0) + 1 }))
    if (rejectBlockTimer.current !== null) window.clearTimeout(rejectBlockTimer.current)
    rejectBlockTimer.current = window.setTimeout(() => setRejectBlock(null), 520)
  }, [])

  /** 本部分的重试计数 —— 每关 2 次,用尽即失败但不阻塞(spec §3.6)。 */
  const retriesRef = useRef(0)

  /** 部分账目在**判定那一刻**冻结(与星级同一口径):交的数字早已定下,不取决于定时器何时跑。 */
  const freezeResult = useCallback(
    (failed: boolean): PartResult => ({ missCount: missRef.current, wrongBlocks: poolRef.current, failed }),
    [],
  )

  /** 部分结束:交回账目。给了 `onPartEnd` 就归入口页管;没给就退回今天那条老路(拼对 → onSolved)。 */
  const endPart = useCallback(
    (result: PartResult) => {
      if (onPartEnd) {
        onPartEnd(result)
        return
      }
      if (result.failed) return // 老路没有「失败」这一档;这条不该发生
      onSolved?.(starsFor(result.missCount))
    },
    [onPartEnd, onSolved],
  )

  /** 重试用尽:把正解一块块落进各自的槽,**演示一遍**再收尾。
      一关只有一道题,「继续下一道题」在一关内无从落实;直接跳过会让孩子不知道正确答案是什么。 */
  const demoSolution = useCallback(() => {
    const used = new Set<string>()
    const next: Record<string, string> = {}
    for (const slot of slots) {
      const block = tray.find((b) => !used.has(b.id) && canPlace(b, slot))
      if (!block) continue
      used.add(block.id)
      next[slot.id] = block.id
    }
    setPlacement(next)
    setWrongIds([])
    setStatus('solved')
    playSound?.('victory')
    speak(level.read)
    setBurst(true)
    const result = freezeResult(true)
    timer.current = window.setTimeout(() => {
      setBurst(false)
      endPart(result)
    }, 1200)
  }, [slots, tray, level, playSound, speak, endPart, freezeResult])

  const placedBlockIds = useMemo(() => new Set(Object.values(placement)), [placement])
  const liveBlocks = tray.filter((b) => !placedBlockIds.has(b.id))
  const welded = level.syl.some((s) => s.weld)

  const succeed = useCallback(() => {
    setStatus('solved')
    playSound?.('victory')
    speak(level.read)
    setBurst(true)
    // 星级与部分账目都在**调用这一刻**冻结,不在超时回调里现算:成功动画还有 1.6s 才放完,
    // 那部分时间里任何一次误触都不该把**已经到手**的星改小(HEAD 就是这么冻的)。spec §3.9。
    const stars = starsFor(missRef.current)
    const result = freezeResult(false)
    timer.current = window.setTimeout(
      () => {
        setBurst(false)
        // 有三部分相位就走交账那条路;没有才是今天那套「拼对即通关」。
        if (onPartEnd) endPart(result)
        else onSolved?.(stars)
      },
      welded ? 2100 : 1600,
    )
  }, [level, onPartEnd, endPart, onSolved, playSound, speak, welded, freezeResult])

  /** 本部分的落位判据。困难部分只比类型(值可以错),其余两部分与今天一致。 */
  const fits = useCallback((block: Block, slot: Slot) => (hard ? sameTypeOnly(block, slot) : canPlace(block, slot)), [hard])

  /**
   * 盘面已满。从「最后一块落位」到判定/收尾真正触发之间(成功 260ms、判错撤块 720ms、
   * 正解演示 1200ms)盘面一直是满的,而 `status` 可能还是 `playing` —— 只按 status 设闸会
   * 漏掉成功前那 260ms:**快速连点能把到手的 3 星打成 1 星,部分账目也被污染**。
   * 盘满即视为这一部分已经定了:任何落位路径(点选 / 拖拽 / 自动落位)都不得再记 miss、再进池。
   *
   * **已接受的盲区**:这道闸也把 `takeBack` 一并冻住(两者共用 `boardFull`)—— 最后一块落位后的
   * 那 260ms 里,孩子若发现自己放错了,自己拿不回来,只能等判错撤块(720ms)或成功动画走完。
   * 拿掉它换来的是「自己拿回」,代价是把上面那条闸拆了(见 `takeBack` 的注释):盘面不再满,
   * `boardFull` 自己失效,白记 miss 的后门重新打开。两害相权,这里选**不可自救**。
   */
  const boardFull = isComplete(slots, placement)

  const placeBlock = useCallback(
    (blockId: string, slotId: string) => {
      if (status !== 'playing' || boardFull) return
      const block = tray.find((b) => b.id === blockId)
      const slot = slots.find((s) => s.id === slotId)
      if (!block || !slot) return
      if (locked.has(slotId)) return // 复习部分的预填槽:不进不出
      if (!fits(block, slot)) {
        noteMiss()
        if (penalized) onBlock?.('wrong')
        playSound?.('wrong')
        flashReject(slotId)
        flashRejectBlock(blockId)
        noteWrongBlock(block, blockId)
        return
      }
      playSound?.('tap')
      if (penalized) onBlock?.('first')
      const next: Record<string, string> = { ...placement }
      for (const [sid, bid] of Object.entries(next)) if (bid === blockId) delete next[sid]
      next[slotId] = blockId
      setPlacement(next)

      if (!isComplete(slots, next)) return
      // 全填后的判错**一律按值和类型**(canPlace),困难部分也不例外 —— 那一部分的门禁(`fits`)只比类型,
      // 值错也放得进去,只有到了这一步才判得出来。拿 `fits` 当这里的判据,困难部分就永远判不出错。
      const wrong = wrongSlotIds(slots, next, tray)
      if (wrong.length === 0) {
        clearTimer()
        timer.current = window.setTimeout(succeed, 260)
        return
      }
      // 全填后判错 —— **困难部分是这部分代码的入口**。简单部分与复习部分的门禁在落位前就挡住了错的,
      // 所以那两部分里这条分支不可达(它的存在是给困难部分用的,不是死代码)。
      noteMiss()
      if (penalized) onBlock?.('wrong')
      for (const id of wrong) {
        const bad = tray.find((b) => b.id === next[id])
        if (bad) noteWrongBlock(bad, bad.id)
      }
      playSound?.('wrong')
      setStatus('wrong')
      setWrongIds(wrong)
      const exhausted = hard && retriesRef.current >= HARD_RETRIES
      if (hard && !exhausted) retriesRef.current += 1
      timer.current = window.setTimeout(() => {
        if (exhausted) {
          demoSolution()
          return
        }
        setPlacement((cur) => {
          const copy = { ...cur }
          for (const id of wrong) delete copy[id]
          return copy
        })
        setWrongIds([])
        setStatus('playing')
      }, 720)
    },
    [
      status,
      boardFull,
      tray,
      slots,
      placement,
      locked,
      fits,
      hard,
      penalized,
      succeed,
      demoSolution,
      playSound,
      onBlock,
      clearTimer,
      flashReject,
      flashRejectBlock,
      noteWrongBlock,
    ],
  )

  const takeBack = useCallback(
    (slotId: string) => {
      // 与 placeBlock / autoPlace 同一道闸。漏掉 `boardFull` 会留一条后门:盘满后的 260ms 里
      // 点一下已填槽就把块拿回托盘,**盘面不再满 ⇒ 上面那道闸自己失效**,再点一块放不下的
      // 就走 autoPlace 的 else 白记 miss(3 星变 2 星);`succeed()` 还会亮在一个空槽的盘面上。
      if (status !== 'playing' || boardFull) return
      // **纵深防御**(今天到不了):预填槽在渲染层就不绑 onClick(`renderSlot` 里
      // `locked.has(slot.id) ? undefined : …`),所以 UI 上没有任何一条路能把预填槽 id 送进来。
      // 留着是防「将来给预填槽接上手势 / 键盘」——那时这条是唯一挡得住把预填块掏走的闸。
      if (locked.has(slotId)) return
      setPlacement((cur) => {
        const copy = { ...cur }
        delete copy[slotId]
        return copy
      })
    },
    [status, boardFull, locked],
  )

  /** 点块就出声:孩子得先听见这块读什么,才谈得上把它拼出来。声调块没有可念的音,静默。 */
  const speakBlock = useCallback(
    (block: TrayBlock) => {
      const word = speakOf(block.type, block.value)
      if (word) speak(word)
    },
    [speak],
  )

  const autoPlace = useCallback(
    (blockId: string) => {
      // 非播放态(成功动画 / 判错撤块 / 正解演示)一律不受理,与 placeBlock 同一道闸。
      // 少了它:那些相位里槽已经全满,点什么都落进下面的 else —— 白记一次 miss(演示期能记到 8),
      // 白把块塞进错题池,成功动画那 1.6s 里还会把星级改小。
      // 盘面已满同理(且必须单独判:`status` 还是 playing 的成功前 260ms 全靠它守住)。
      if (status !== 'playing' || boardFull) return
      const block = tray.find((b) => b.id === blockId)
      if (!block) return
      // 困难部分的落点取「同类型的第一个空槽」(值可以错);其余两部分走今天的 autoTargetId。
      const target = hard ? autoTypeTargetId(block, slots, placement) : autoTargetId(block, slots, placement)
      if (target) placeBlock(blockId, target)
      else {
        noteMiss()
        if (penalized) onBlock?.('wrong')
        playSound?.('wrong')
        flashRejectBlock(blockId)
        noteWrongBlock(block, blockId)
      }
    },
    [
      status,
      boardFull,
      tray,
      slots,
      placement,
      hard,
      penalized,
      placeBlock,
      playSound,
      onBlock,
      flashRejectBlock,
      noteWrongBlock,
    ],
  )

  /* ------------------------------------------------------------------ 拖拽
   * 用指针事件而非 HTML5 DnD —— 后者在触摸屏上根本不触发,而孩子多半在平板上玩。
   * 幽灵块直接操作 DOM(不进 React state),避免拖拽期每帧重渲染整棵树。 */
  const drag = useRef<{
    blockId: string
    ghost: HTMLElement | null
    moved: boolean
    startX: number
    startY: number
    ox: number
    oy: number
    w: number
    h: number
  } | null>(null)

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > 6) {
      d.moved = true
      // 克隆**块本体**,不是它外面那层矩形 wrapper。data-block-id 挂在 wrapper 上,
      // 直接克隆它会把 .pblock--dragging 的白高光与投影画在一个没圆角的透明矩形上 —— 块四周多出一圈白框。
      const host = document.querySelector<HTMLElement>(`[data-block-id="${d.blockId}"]`)
      const src = host?.classList.contains('pblock') ? host : host?.querySelector<HTMLElement>('.pblock')
      if (src) {
        const ghost = src.cloneNode(true) as HTMLElement
        ghost.classList.add('pblock--dragging')
        ghost.style.width = `${d.w}px`
        ghost.style.height = `${d.h}px`
        document.body.appendChild(ghost)
        d.ghost = ghost
      }
      setDraggingId(d.blockId)
    }
    if (d.ghost) {
      d.ghost.style.left = `${e.clientX - d.ox}px`
      d.ghost.style.top = `${e.clientY - d.oy}px`
    }
    setHoverSlot(slotIdUnder(e.clientX, e.clientY))
  }, [])

  // pointerup 与 pointercancel 走同一个收尾:前者落块,后者只拆干净。
  // 名字用 e.type 区分,是为了让「注册」与「摘除」用的是同一个函数身份 —— 两个互相引用的
  // useCallback 会成环(deps 里互相要求对方),这里用一个 handler 绕开。
  // 具名函数表达式(不是箭头函数):内层的 `onPointerEnd` 绑定**恒等于刚被创建的那个函数对象**,
  // 所以「注册」与「摘除」拿到的必然是同一个身份(useCallback 命中缓存时返回的也正是它);
  // 写成箭头函数引用外层的 const,读到的就是「本轮渲染的那个」,identity 中途变过就会摘错人。
  const onPointerEnd = useCallback(
    function onPointerEnd(e: PointerEvent) {
      const d = drag.current
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onPointerEnd)
      window.removeEventListener('pointercancel', onPointerEnd)
      if (!d) return // 已经收尾过(或卸载时清过):只摘监听,不动状态
      drag.current = null
      d.ghost?.remove()
      setDraggingId(null)
      setHoverSlot(null)
      if (e.type === 'pointercancel') return // 手势被系统收走:不该替孩子落子
      if (!d.moved) {
        autoPlace(d.blockId) // 没挪动 = 点击:自动找槽位
        return
      }
      const slotId = slotIdUnder(e.clientX, e.clientY)
      if (slotId) placeBlock(d.blockId, slotId)
    },
    [onMove, autoPlace, placeBlock],
  )

  // deps **只能**是 onMove(它恒定不变)。onPointerEnd 的 deps 含 placeBlock,而 placeBlock
  // 的 deps 含 placement / status / tray —— 挂进来 cleanup 就会在每次落块后重跑,把监听摘掉。
  // 卸载时若还有拖拽在飞,幽灵块挂在 body 上 → 一并拆掉;并把 ref 清空,
  // 让此后任何残留的 onPointerEnd 变成 no-op(它第一行就读 drag.current)。
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onMove)
      drag.current?.ghost?.remove()
      drag.current = null
    },
    [onMove],
  )

  const onDown = (e: React.PointerEvent<HTMLDivElement>, blockId: string) => {
    if (status !== 'playing') return
    // 上一次拖拽没收尾(二指同按 / 系统吞了 pointerup)就先拆掉它 ——
    // 否则它的幽灵块会永久留在 body 上(不在 React 树里,重挂组件也清不掉)。
    if (drag.current) {
      drag.current.ghost?.remove()
      drag.current = null
    }
    // 按下的那一刻就念 —— 不管这一下最后是点选还是拖拽,意图都是「我要用这块」。
    const block = tray.find((b) => b.id === blockId)
    if (block) speakBlock(block)
    const rect = e.currentTarget.getBoundingClientRect()
    drag.current = {
      blockId,
      ghost: null,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      w: rect.width,
      h: rect.height,
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onPointerEnd, { once: true })
    window.addEventListener('pointercancel', onPointerEnd, { once: true })
  }

  /* ------------------------------------------------------------------ 渲染 */

  function renderSlot(slot: Slot, isTone: boolean) {
    const blockId = placement[slot.id]
    const block = blockId ? tray.find((b) => b.id === blockId) : undefined
    return (
      <div
        // 被拒时换 key 重挂本槽,让抖动动画从头播(见 flashReject)
        key={reject?.id === slot.id ? `${slot.id}-${reject.n}` : slot.id}
        data-slot-id={slot.id}
        aria-label={block ? `已放 ${block.value}` : '空槽'}
        className={cn(
          'pslot flex items-center justify-center',
          isTone ? TONE_BOX : boxFor(slot),
          block && 'pslot--filled',
          hoverSlot === slot.id && 'pslot--over',
          (wrongIds.includes(slot.id) || reject?.id === slot.id) && 'pslot--wrong',
          // 类型类恒挂:强/中/弱是染色深浅的差别,由容器上的两个变量决定,不是挂不挂类。
          !block && (isTone ? 'pslot--tone' : `pslot--${slot.type}`),
        )}
      >
        {block ? (
          <BlockChip
            // 颜色跟着**槽**走:站在介母位才穿那身过渡色。所以块从托盘搬进槽时
            // 不会变色(托盘块的类型本来就由它要落的槽决定),落错槽才会 —— 那正是要给的信号。
            type={slot.type}
            value={block.value}
            placed
            welded={welded && status === 'solved' && Boolean(level.syl[slot.sylIdx]?.weld)}
            // 触发判据与答案行的拼写同源:同一个 losesDots,渲染层不重算结构。
            dotsAway={losesDots(level.syl[slot.sylIdx]?.initial, block.value)}
            // 复习部分的预填槽不绑 onClick —— 孩子能操作的是挖空的那几个槽(spec §3.7)。
            onClick={locked.has(slot.id) ? undefined : () => takeBack(slot.id)}
            className={cn(boxFor(slot), isTone && PLACED_TONE)}
            data-block-id={block.id}
          />
        ) : null}
      </div>
    )
  }

  const trayBlock = (b: TrayBlock) => (
    <div
      key={b.id}
      data-block-id={b.id}
      onPointerDown={(e) => onDown(e, b.id)}
      className="cursor-grab active:cursor-grabbing"
      role="button"
      tabIndex={0}
      aria-label={b.type === 'tone' ? `声调块 ${b.value}` : `积木 ${b.value}`}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        speakBlock(b)
        autoPlace(b.id)
      }}
    >
      <BlockChip
        // 被拒时换 key 重挂**块本体**(不是外面那层 wrapper),让抖动动画从头播(与槽位的 flashReject 同一手法)。
        // 换在 wrapper 上的话,孩子手里/测试手里那个节点会被摘掉 —— 连着点同一块时,第二下打在一个**已脱离文档**
        // 的节点上,事件冒不到 root,那一下既不计数也不发声。块本体是无状态组件,重挂只重播动画。
        key={rejectBlock?.id === b.id ? `${b.id}-${rejectBlock.n}` : b.id}
        type={b.type}
        value={b.value}
        dim={draggingId === b.id}
        className={cn(b.type === 'tone' ? TRAY_BOX_TONE : TRAY_BOX, rejectBlock?.id === b.id && 'pblock--reject')}
      />
    </div>
  )

  return (
    <div
      // 游戏区锚点。**必须有这个 data-* ** —— 测试原本用 `container.querySelector('.relative')`,
      // 而槽位内层(焊缝定位那一层)也带 `relative`;一旦本行掉了 `relative` 类,
      // 选择器会**静默命中第一个槽位的内层**,零文本扫描面缩到单个槽、测试照旧全绿。
      // 同 `data-answer-read` 的先例:锚点用 data-*,别用会随样式漂移的类名。
      data-game-area
      className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4 pb-5"
    >
      {/* 重听塞在角落、压暗 —— 玩法是**看图猜音再拼**,声音是兜底不是入口;
          摆在题面正下方,孩子会一路点着听过去,拼读就不发生了。 */}
      <button
        type="button"
        onClick={() => speak(level.read)}
        aria-label="再听一遍"
        className="absolute top-1 right-3 flex h-11 w-11 items-center justify-center rounded-full text-base opacity-45 transition-opacity hover:opacity-100 focus-visible:opacity-100 active:translate-y-0.5"
      >
        🔊
      </button>

      {/* 台阶条:三格,亮到第几格就是第几部分;复习部分下面再挂一排小题进度点。
          位置钉在题面图上方、与拼装台同列 —— 不占新地方(spec §3.8)。 */}
      <div className="flex flex-col items-center gap-1.5">
        <StageBar stage={mode} />
        {mode === 'review' && reviewProgress ? (
          <StageDots total={reviewProgress.total} done={reviewProgress.done} />
        ) : null}
      </div>

      {/* 题面 / 拼装台 / 答案行 / 积木盘是一整列,在剩余空间里居中。
          让哪一部分单独 flex-1 都会把它拉满整屏,隔出大部分空白。 */}
      {/* 题面图自己不可点:能点就会变成「戳图听音」,凭图猜音这一环就绕过去了 */}
      <div
        aria-hidden
        className="text-[6.5rem] leading-none select-none"
        style={{ filter: 'drop-shadow(0 10px 14px rgb(31 58 95 / 0.18))' }}
      >
        {level.emoji}
      </div>

      {/* 拼装台 —— 提示档挂在这一层:槽位一律照读 --slot-line / --slot-fill */}
      <div
        role="group"
        aria-label="拼装台"
        className={cn(
          'pslots flex min-h-[7.5rem] items-end justify-center gap-1',
          // 困难部分:类型色恒亮 + 实线边,不吃提示档 —— 那一部分的规则就是「同颜色才能放」,
          // 在弱档单元(u9–u12,--slot-line: 0%)不恒亮的话这条规则在屏幕上不可见。
          hard && 'pslots--hard',
          !hard && (mode === 'review' ? true : hint === 'mid') && 'pslots--mid',
          !hard && mode === 'easy' && hint === 'weak' && 'pslots--weak',
        )}
      >
        {level.syl.map((syl, si) => {
          const group = slots.filter((s) => s.sylIdx === si)
          const mains = group.filter((s) => s.type !== 'tone')
          return (
            <div
              key={`g${si}`}
              className={cn(
                'flex items-end gap-1',
                si > 0 && 'ml-6 border-l-2 border-dashed border-hairline-strong pl-6',
              )}
            >
              {mains.map((slot, colIdx) => {
                const toneSlot = group.find((s) => s.type === 'tone' && s.anchor === slot.id)
                return (
                  <div key={slot.id} className="flex flex-col items-center gap-1">
                    {toneSlot ? renderSlot(toneSlot, true) : null}
                    <div className="relative">
                      {renderSlot(slot, false)}
                      {/* 焊缝钉在第二块的左缘 = 两块之间的接缝,零测量 */}
                      {syl.weld && colIdx === 1 ? (
                        <span aria-hidden className={cn('pweld', welded && status === 'solved' && 'pweld--on')} />
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {/* 答案行:拼对了才亮,把「刚搭出来的音」和「它是什么字」一次扣上 —— 拼音认读不强绑汉字就只是字母游戏。
          高度定死,亮起时不顶动拼装台。 */}
      <div
        aria-live="polite"
        className={cn(
          'flex h-9 items-center gap-3 transition-opacity',
          status === 'solved' ? 'opacity-100' : 'opacity-0',
        )}
      >
        {status === 'solved' ? (
          <>
            <span className="text-lg font-bold tracking-[0.3em] text-ink-3">{level.pinyin}</span>
            <span data-answer-read className="text-3xl font-extrabold text-ink">{level.read}</span>
          </>
        ) : null}
      </div>

      {/* 积木盘:组合块一行,声调块单独一行 —— 声调是另一个维度,混着放只是噪音 */}
      <div
        className={cn(
          'glass-strong flex w-full max-w-3xl flex-col items-center gap-3 rounded-4xl px-4 py-4 shadow-[var(--shadow-card)]',
          hard && 'ptray--hard',
          mode === 'review' && 'ptray--review',
        )}
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          {liveBlocks.filter((b) => b.type !== 'tone').map(trayBlock)}
        </div>
        {/* 声调行按需出现:复习部分的托盘常常一块声调都没有,那时不该留一条空的虚线分隔。 */}
        {liveBlocks.some((b) => b.type === 'tone') ? (
          <div className="flex items-center justify-center gap-4 border-t-2 border-dotted border-hairline-strong pt-3">
            {liveBlocks.filter((b) => b.type === 'tone').map(trayBlock)}
          </div>
        ) : null}
      </div>

      {burst ? <Sparks /> : null}
    </div>
  )
}

/**
 * 游戏壳:只管「现在是第几单元第几关」。
 * 每关换 key 重挂 PinyinRound —— 换关即清空,不靠 effect 里 setState 补重置。
 */
export function PinyinBlocksGame({
  speak,
  playSound,
  onBlock,
  unitIndex,
  levelIndex,
  stage = 'easy',
  review = null,
  reviewProgress,
  onPartEnd,
  onSolved,
  onAdvance,
}: PinyinBlocksGameProps) {
  const [self, setSelf] = useState({ unit: 0, level: 0 })
  const [round, setRound] = useState(0)
  const unit = unitIndex ?? self.unit
  const level = levelIndex ?? self.level

  /** 关内自己往下走(试玩路径)。由外层控关时不动 —— 那是 UnitEntry 的事。 */
  const advance = () => {
    const u = UNITS[unit] ?? UNITS[0]!
    const next =
      level + 1 < u.levels.length ? { unit, level: level + 1 } : { unit: (unit + 1) % UNITS.length, level: 0 }
    setRound((r) => r + 1)
    if (unitIndex === undefined) setSelf(next)
    onAdvance?.(next.unit, next.level)
  }

  return (
    <PinyinRound
      key={`${unit}-${level}-${round}`}
      unitIdx={unit}
      lvlIdx={level}
      round={round}
      speak={speak}
      playSound={playSound}
      onBlock={onBlock}
      stage={stage}
      review={review}
      reviewProgress={reviewProgress}
      onPartEnd={onPartEnd}
      // 有 onPartEnd 就不给这条老路:部分结束由入口页决定下一部分。
      onSolved={
        onPartEnd
          ? undefined
          : (stars) => {
              if (onSolved) onSolved(stars)
              else advance()
            }
      }
    />
  )
}

/** 答对迸星。纯装饰,不进无障碍树。 */
function Sparks() {
  const glyphs = ['✨', '⭐', '💫', '🌟']
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {Array.from({ length: 20 }, (_, i) => {
        const angle = (Math.PI * 2 * i) / 20
        const dist = 90 + ((i * 37) % 120)
        return (
          <span
            key={i}
            className="absolute top-1/2 left-1/2 text-xl"
            style={{
              animation: 'pspark 0.9s cubic-bezier(.15,.8,.3,1) forwards',
              ['--dx' as string]: `${Math.cos(angle) * dist}px`,
              ['--dy' as string]: `${Math.sin(angle) * dist + 40}px`,
            }}
          >
            {glyphs[i % glyphs.length]}
          </span>
        )
      })}
    </div>
  )
}
