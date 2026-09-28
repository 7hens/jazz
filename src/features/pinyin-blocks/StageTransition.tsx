import { useEffect, useRef } from 'react'
import { StageBar, type StageId } from './StageBar'

/**
 * 过场停留时长。**减动效下也是这个数** —— 动画被压成 0.01ms 之后,
 * 「停 1.2s」这一下由这个 JS 计时器保证,两态可读不靠位移(spec §3.8)。
 */
export const STAGE_TRANSITION_MS = 1200

/**
 * 换段过场:压一层暗遮罩,台阶条放大到屏幕中央。
 * 两处共用一个组件,画法由 `stage` 决定 —— 进困难是「两格逐格点亮」,
 * 进复习是「前两格保持 + 第三格点亮成灰蓝」,颜色语言告诉孩子这不是升级。
 */
export function StageTransition({ stage, onDone }: { stage: StageId; onDone: () => void }) {
  // onDone 恒放 ref:调用方写的是内联箭头函数,每次渲染都是新身份;
  // 挂进下方 effect 的 deps 会让 1.2s 的计时器被反复重置,过场永远走不完。
  const done = useRef(onDone)
  useEffect(() => {
    done.current = onDone
  })
  useEffect(() => {
    const timer = window.setTimeout(() => done.current(), STAGE_TRANSITION_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="pstage-veil" role="presentation" data-stage-transition={stage}>
      <StageBar stage={stage} big pop />
    </div>
  )
}
