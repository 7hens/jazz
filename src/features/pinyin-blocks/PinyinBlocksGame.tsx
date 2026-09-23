import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { hintFor, speakOf } from './blocks'
import { UNITS, type Level } from './levels'
import {
  autoTargetId,
  buildBlocks,
  canPlace,
  isComplete,
  slotsFor,
  starsFor,
  wrongSlotIds,
  type Rng,
  type Slot,
  type TrayBlock,
} from './rules'
import { BlockChip } from './BlockChip'
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

export type PinyinBlocksGameProps = {
  /** 朗读(拼音串)。由 Entry 从 SpeechService 注入 —— feature 内不碰 useService。 */
  speak: (text: string) => void
  playSound?: (cue: 'correct' | 'wrong' | 'victory' | 'tap') => void
  /** 每放一块上报一次 —— 连击靠它驱动。放对 'first',放错 'wrong'。 */
  onBlock?: (kind: AnswerKind) => void
  unitIndex?: number
  levelIndex?: number
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
  onSolved: (stars: number) => void
}

/**
 * 一轮 = 一道题的全部可变状态。
 * 状态重置靠外层换 key 重挂,而不是「effect 里 setState」——
 * 后者每一关都要多渲染一次,而且是 React 里最容易出竞态的写法。
 */
function PinyinRound({ unitIdx, lvlIdx, round, speak, playSound, onBlock, onSolved }: RoundProps) {
  const unit = UNITS[unitIdx] ?? UNITS[0]!
  const level: Level = unit.levels[lvlIdx] ?? unit.levels[0]!

  const slots = useMemo(() => slotsFor(level), [level])
  const tray: TrayBlock[] = useMemo(
    () =>
      buildBlocks(level, unitIdx, makeRng(round)).map((b, i) => ({
        ...b,
        id: `b${i}`,
      })),
    [level, unitIdx, round],
  )

  const [placement, setPlacement] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Status>('playing')
  const [wrongIds, setWrongIds] = useState<readonly string[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hoverSlot, setHoverSlot] = useState<string | null>(null)
  const [burst, setBurst] = useState(false)

  /** 本关累计错误次数。星级靠它,提示回强也靠它 —— 「卡住了」是同一种信号。 */
  const [missCount, setMissCount] = useState(0)
  const missRef = useRef(0)
  /** 同步计数:placeBlock 的闭包里读到的是旧 state,而判定发生在同一次调用里。 */
  function noteMiss() {
    missRef.current += 1
    setMissCount(missRef.current)
  }

  /** 本关此刻的提示档:基线由单元给,连错 2 次临时回强(只升不降)。 */
  const hint = hintFor(unit.id, missCount)

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

  const placedBlockIds = useMemo(() => new Set(Object.values(placement)), [placement])
  const liveBlocks = tray.filter((b) => !placedBlockIds.has(b.id))
  const welded = level.syl.some((s) => s.weld)

  const succeed = useCallback(() => {
    setStatus('solved')
    playSound?.('victory')
    speak(level.read)
    setBurst(true)
    const stars = starsFor(missRef.current)
    timer.current = window.setTimeout(
      () => {
        setBurst(false)
        onSolved(stars)
      },
      welded ? 2100 : 1600,
    )
  }, [level, onSolved, playSound, speak, welded])

  const placeBlock = useCallback(
    (blockId: string, slotId: string) => {
      if (status !== 'playing') return
      const block = tray.find((b) => b.id === blockId)
      const slot = slots.find((s) => s.id === slotId)
      if (!block || !slot) return
      if (!canPlace(block, slot)) {
        noteMiss()
        onBlock?.('wrong')
        playSound?.('wrong')
        flashReject(slotId)
        return
      }
      playSound?.('tap')
      onBlock?.('first')
      const next: Record<string, string> = { ...placement }
      for (const [sid, bid] of Object.entries(next)) if (bid === blockId) delete next[sid]
      next[slotId] = blockId
      setPlacement(next)

      if (!isComplete(slots, next)) return
      const wrong = wrongSlotIds(slots, next, tray)
      if (wrong.length === 0) {
        clearTimer()
        timer.current = window.setTimeout(succeed, 260)
        return
      }
      noteMiss()
      onBlock?.('wrong')
      setStatus('wrong')
      setWrongIds(wrong)
      playSound?.('wrong')
      timer.current = window.setTimeout(() => {
        setPlacement((cur) => {
          const copy = { ...cur }
          for (const id of wrong) delete copy[id]
          return copy
        })
        setWrongIds([])
        setStatus('playing')
      }, 720)
    },
    [status, tray, slots, placement, succeed, playSound, onBlock, clearTimer, flashReject],
  )

  const takeBack = useCallback(
    (slotId: string) => {
      if (status !== 'playing') return
      setPlacement((cur) => {
        const copy = { ...cur }
        delete copy[slotId]
        return copy
      })
    },
    [status],
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
      const block = tray.find((b) => b.id === blockId)
      if (!block) return
      const target = autoTargetId(block, slots, placement)
      if (target) placeBlock(blockId, target)
      else {
        noteMiss()
        onBlock?.('wrong')
        playSound?.('wrong')
      }
    },
    [tray, slots, placement, placeBlock, playSound, onBlock],
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
            onClick={() => takeBack(slot.id)}
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
        type={b.type}
        value={b.value}
        dim={draggingId === b.id}
        className={cn(b.type === 'tone' ? TRAY_BOX_TONE : TRAY_BOX)}
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

      {/* 题面 / 拼装台 / 答案行 / 积木盘是一整列,在剩余空间里居中。
          让哪一段单独 flex-1 都会把它拉满整屏,隔出大段空白。 */}
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
          hint === 'mid' && 'pslots--mid',
          hint === 'weak' && 'pslots--weak',
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
      <div className="glass-strong flex w-full max-w-3xl flex-col items-center gap-3 rounded-4xl px-4 py-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-center gap-3">
          {liveBlocks.filter((b) => b.type !== 'tone').map(trayBlock)}
        </div>
        <div className="flex items-center justify-center gap-4 border-t-2 border-dotted border-hairline-strong pt-3">
          {liveBlocks.filter((b) => b.type === 'tone').map(trayBlock)}
        </div>
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
  onSolved,
  onAdvance,
}: PinyinBlocksGameProps) {
  const [self, setSelf] = useState({ unit: 0, level: 0 })
  const [round, setRound] = useState(0)
  const unit = unitIndex ?? self.unit
  const level = levelIndex ?? self.level

  /** 关内自己往下走(试玩路径)。由外层控关时不动 —— 那是 LevelEntry 的事。 */
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
      // 有 onSolved 就归外层管(结算 + 推进),没有才走自走逻辑
      onSolved={(stars) => {
        if (onSolved) onSolved(stars)
        else advance()
      }}
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
