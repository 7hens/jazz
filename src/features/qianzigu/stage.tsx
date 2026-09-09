import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import type { SpeechRole } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import type { AtmosphereKey } from './chapter'
import { ROLE_META } from './scene-ui'
import { restoreCount } from './stage-meta'
import { atmosphereToClass, roleScale } from './stage-visuals'

/** 全窗不滚舞台帧(dvh 防移动端地址栏)。 */
export function StageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('relative h-dvh w-full overflow-hidden bg-canvas', className)}>{children}</div>
}

type LitWord = { id: number; emoji: string }
type RestoredEntry = { wordId: number }

/** 天空氛围层 + 词 emoji 点灯(点亮档同原 SkyStrip:0 灰 / 1 半 / 2 全)。 */
export function StageSky({
  atmosphere,
  words,
  restored,
}: {
  atmosphere: AtmosphereKey
  words: readonly LitWord[]
  restored?: readonly RestoredEntry[]
}) {
  return (
    <div aria-hidden className={cn('absolute inset-0', atmosphereToClass(atmosphere))}>
      <div className="absolute inset-x-0 top-[4vh] flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6">
        {words.map((w) => {
          const count = restoreCount(restored ?? [], w.id)
          return (
            <span
              key={w.id}
              className={cn(
                'stage-word text-3xl transition-all duration-1000 sm:text-4xl',
                count >= 2 ? 'opacity-100' : count === 1 ? 'opacity-70 grayscale-[.55]' : 'opacity-40 grayscale',
              )}
            >
              {w.emoji}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** 角色站队:说话者弹跳 + 高亮名字牌;bubble 渲染在其上方(角色旁泡位置)。 */
export function StageCast({
  cast,
  speaker,
  bubble,
}: {
  cast: readonly SpeechRole[]
  speaker?: SpeechRole | null
  bubble?: ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-around gap-2 px-[6vw] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      {cast.map((role) => {
        const meta = ROLE_META[role]
        const talking = role === speaker
        return (
          <div key={role} className="relative flex min-w-0 flex-1 flex-col items-center">
            <div className="mb-1 flex h-[3.5rem] w-full max-w-[46vw] items-end justify-center sm:max-w-xs">
              {talking && bubble ? <div data-stage-bubble>{bubble}</div> : null}
            </div>
            <motion.div
              className="flex flex-col items-center"
              style={{ scale: roleScale(role) }}
              animate={talking && !reduce ? { y: [0, -9, 0] } : { y: 0 }}
              transition={
                talking && !reduce
                  ? { repeat: Infinity, duration: 0.5, ease: 'easeInOut' }
                  : { duration: 0.2 }
              }
            >
              <span aria-hidden className={cn('text-6xl leading-none sm:text-7xl', talking ? 'drop-shadow-lg' : 'opacity-75 saturate-50')}>
                {meta.emoji}
              </span>
              <span
                className={cn(
                  'mt-1 rounded-full px-2 py-0.5 text-xs font-bold text-white',
                  talking ? 'bg-accent' : 'bg-ink/60',
                )}
              >
                {meta.name}
              </span>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}

/** 舞台浮层面板:内容叠在天空上,可纵向滚动(舞台帧本身不滚)。 */
export function ScenePanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('pointer-events-auto absolute inset-x-0 bottom-0 top-auto z-20 flex justify-center', className)}>
      <div className="mx-auto max-h-[76dvh] w-full max-w-xl overflow-y-auto px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        {children}
      </div>
    </div>
  )
}
