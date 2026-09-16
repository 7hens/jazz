import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/shared/ui/utils'
import type { AudioCue } from '@/shared/services'
import { speakCard, type Speak } from './speech'
import type { BaseOption, SkillKey } from '@/shared/services'
import { TypeBadge } from './TypeBadge'
import { QuestionBubble } from './QuestionBubble'
import { Stone } from './Stone'
import type { StoneState } from './stone'

type MatchGameProps = {
  prompt: string
  left: BaseOption[]
  right: BaseOption[]
  answerMap: Record<string, string>
  skill: SkillKey
  playSound: (cue: AudioCue) => void
  speak: Speak
  /** 全部配对成功时触发,传任一正确 left id(语义上整题 +10)。 */
  onComplete: (leftId: string) => void
}

/** 炼金过渡时长(spec §7.1「右块缩小淡出 + 左块金色闪一下」)。
 *  配对反馈、不是庆祝动画:克制在 180–280ms,并**短于**既有爆点(450ms),不抢戏(spec §6 分档)。 */
const ALCHEMY_MS = 240

export function MatchGame({
  prompt,
  left,
  right,
  answerMap,
  skill,
  playSound,
  speak,
  onComplete,
}: MatchGameProps) {
  const [selL, setSelL] = useState<string | null>(null)
  const [selR, setSelR] = useState<string | null>(null)
  const [matched, setMatched] = useState<Record<string, string>>({})
  const [mismatch, setMismatch] = useState<[string, string] | null>(null)
  const [done, setDone] = useState(false)
  const timerRef = useRef<number | null>(null)
  const [burst, setBurst] = useState<[string, string] | null>(null)
  // 炼金过渡(spec §7.1)的瞬态:[左 id, 右 id]。与 burst 同套模式,但生命周期更短。
  const [alchemy, setAlchemy] = useState<[string, string] | null>(null)
  // 爆点用独立 ref:mismatch 与 burst 可以叠加发生(爆点不锁输入),共用 timerRef 会互相取消,
  // 导致 burst 永不清空。炼金同理 —— 三个计时器同段并发,各自独立。
  const burstTimerRef = useRef<number | null>(null)
  const alchemyTimerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current)
      if (alchemyTimerRef.current !== null) window.clearTimeout(alchemyTimerRef.current)
    },
    [],
  )

  function settlePair(l: string, r: string) {
    if (done) return
    if (answerMap[l] === r) {
      const next = { ...matched, [l]: r }
      setMatched(next)
      setSelL(null)
      setSelR(null)
      setBurst([l, r])
      if (burstTimerRef.current !== null) window.clearTimeout(burstTimerRef.current)
      burstTimerRef.current = window.setTimeout(() => setBurst(null), 450)
      // 炼金过渡:与爆点同时起、先结束。终态(金 / 凹槽)在下一次渲染即已落地,
      // 这里只叠加一层会自己走完的装饰 —— 不在时间轴上推迟状态切换(既有断言要求同步可见)。
      setAlchemy([l, r])
      if (alchemyTimerRef.current !== null) window.clearTimeout(alchemyTimerRef.current)
      alchemyTimerRef.current = window.setTimeout(() => setAlchemy(null), ALCHEMY_MS)
      if (Object.keys(next).length === left.length) {
        setDone(true)
        onComplete(left[0]?.id ?? '')
      } else {
        playSound('tap')
      }
    } else {
      playSound('wrong')
      setSelL(null)
      setSelR(null)
      setMismatch([l, r])
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(() => setMismatch(null), 420)
    }
  }

  /** 朗读只在「纯选择」时刻(点某侧卡、对侧无待配对选中);配对判合与取消选择都不读。 */
  function speakOnPureSelect(side: 'left' | 'right', id: string) {
    const opt = (side === 'left' ? left : right).find((x) => x.id === id)
    if (opt?.speak) speakCard(speak, skill, opt.speak)
  }

  function pickLeft(id: string) {
    if (matched[id] || mismatch || done) return
    if (selR) { settlePair(id, selR); return }
    if (selL === id) { setSelL(null); return } // 取消选择不朗读
    setSelL(id)
    speakOnPureSelect('left', id)
  }

  function pickRight(id: string) {
    const matchedRightIds = Object.values(matched)
    if (matchedRightIds.includes(id) || mismatch || done) return
    if (selL) { settlePair(selL, id); return }
    if (selR === id) { setSelR(null); return } // 取消选择不朗读
    setSelR(id)
    speakOnPureSelect('right', id)
  }

  function renderCard(o: BaseOption, isLeft: boolean) {
    const matchedRightIds = Object.values(matched)
    const isMatched = isLeft ? matched[o.id] !== undefined : matchedRightIds.includes(o.id)
    const isSel = isLeft ? selL === o.id : selR === o.id
    const isMis = mismatch ? (isLeft ? mismatch[0] === o.id : mismatch[1] === o.id) : false
    // 炼金(甲):左边炼成金石,右边留凹槽。凹槽不渲染文本 —— 信息已并入金石,
    // 免去低对比度灰字,也顺带让「读屏听到的」与「眼睛看到的」一致。
    const state: StoneState = isMatched ? (isLeft ? 'gold' : 'slot') : isMis ? 'wrong' : isSel ? 'selected' : 'idle'
    const goldSub = isLeft && isMatched ? right.find((r) => r.id === matched[o.id])?.emoji : undefined
    const popping = burst ? (isLeft ? burst[0] === o.id : burst[1] === o.id) : false
    // 炼金过渡(spec §7.1):右块缩小的残影 + 左块金色闪一下。走 Stone 既有的 children 插槽,
    // 不新增包裹层、不动 .grid 结构;两块都 aria-hidden,不动可访问名。
    const alchemizing = alchemy ? (isLeft ? alchemy[0] === o.id : alchemy[1] === o.id) : false
    return (
      <Stone
        key={o.id}
        state={state}
        horizontal
        // 图只属于右列(左列选项没有 emoji 字段);配对后右位转凹槽,图随 text 一起收起。
        emoji={isLeft || state === 'slot' ? undefined : o.emoji}
        text={state === 'slot' ? undefined : o.text}
        subText={goldSub}
        disabled={Boolean(isMatched || mismatch || done)}
        shake={isMis}
        className={cn(popping && (isLeft ? 'stone--pop-l' : 'stone--pop-r'))}
        onClick={() => (isLeft ? pickLeft(o.id) : pickRight(o.id))}
      >
        {alchemizing ? (
          <motion.span
            aria-hidden
            data-alchemy={isLeft ? 'flash' : 'shrink'}
            className={isLeft ? 'stone-flash' : 'stone-echo'}
            // 残影从满块开始缩淡(故凹槽 textContent 仍为 '' —— 残影是空节点,不含文字);
            // 金闪是一次性的 [0→亮→0]。减动效由 App 的 MotionConfig reducedMotion="user" 自动接管。
            initial={isLeft ? { opacity: 0 } : { opacity: 1, scale: 1 }}
            animate={isLeft ? { opacity: [0, 0.9, 0] } : { opacity: 0, scale: 0.45 }}
            transition={{ duration: ALCHEMY_MS / 1000, ease: 'easeOut' }}
          />
        ) : null}
      </Stone>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-start">
        <TypeBadge kind="match" />
      </div>
      {/* 无朗读重听语义 → 不传 onReplay,QuestionBubble 渲染 div 而非 button */}
      <QuestionBubble prompt={prompt} />
      <div className="relative">
        {burst ? (
          <span aria-hidden data-match-burst className="quiz-burst-layer">
            <motion.span
              className="quiz-ring"
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: [0, 1, 0], scale: [0.3, 1.15, 1.45] }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            />
            <motion.span
              className="quiz-pop"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 1, 0], scale: [0.5, 1.15, 1.05, 1] }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              啪!
            </motion.span>
          </span>
        ) : null}
        <div className="grid grid-cols-2 items-start gap-3">
          <div className="space-y-2.5">{left.map((o) => renderCard(o, true))}</div>
          <div className="space-y-2.5">{right.map((o) => renderCard(o, false))}</div>
        </div>
      </div>
    </div>
  )
}
