import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import type { SpeechRole } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import type { AtmosphereKey } from './chapter'
import { ROLE_META } from './scene-ui'
import { skySplit } from './stage-meta'
import { atmosphereToClass, roleScale, STAGE_BODIES, worldDesatClass } from './stage-visuals'

/** 全窗不滚舞台帧(dvh 防移动端地址栏)。 */
export function StageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('relative h-dvh w-full overflow-hidden bg-canvas', className)}>{children}</div>
}

/** 真夜幕(break/social/boss 用的 night/dark)太阳不现身。 */
const HIDES_SUN = (atmosphere: AtmosphereKey): boolean => atmosphere === 'night' || atmosphere === 'dark'

/**
 * 千字谷实景布景层:氛围渐变底 + 世界回春灰档,上层叠 天顶云 → 太阳位 → 山壁 → 村庄 → 河流。
 */
export function StageSky({
  atmosphere,
  fraction,
}: {
  atmosphere: AtmosphereKey
  fraction: number
}) {
  return (
    <div aria-hidden className={cn('absolute inset-0', atmosphereToClass(atmosphere))}>
      {/* 世界回春:灰档叠在布景层(山/村/河)上,随进度撤灰上彩 */}
      <div className={cn('absolute inset-0', worldDesatClass(fraction))}>
        <div className="stage-mountains">{STAGE_BODIES.mountains}</div>
        <div className="stage-village">{STAGE_BODIES.village}</div>
        <div className="stage-river">
          <span className="stage-river-emblem">{STAGE_BODIES.river}</span>
          <span className="stage-river-waves">{STAGE_BODIES.waves}</span>
        </div>
      </div>
      <div className="stage-clouds">{STAGE_BODIES.clouds}</div>
      {!HIDES_SUN(atmosphere) ? (
        <div data-sun className="stage-sun">{STAGE_BODIES.sun}</div>
      ) : null}
    </div>
  )
}

/** 单个站队角色(地面行):说话者弹跳 + 高亮名字牌;bubble 渲染在其上方。 */
function CastFigure({
  role,
  talking,
  bubble,
  reduce,
}: {
  role: SpeechRole
  talking: boolean
  bubble?: ReactNode
  reduce: boolean | null
}) {
  const meta = ROLE_META[role]
  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center">
      <div className="mb-1 flex h-[3.5rem] w-full max-w-[46vw] items-end justify-center sm:max-w-xs">
        {talking && bubble ? <div data-stage-bubble>{bubble}</div> : null}
      </div>
      <motion.div
        className="flex flex-col items-center"
        style={{ scale: roleScale(role) }}
        animate={talking && !reduce ? { y: [0, -9, 0] } : { y: 0 }}
        transition={talking && !reduce ? { repeat: Infinity, duration: 0.5, ease: 'easeInOut' } : { duration: 0.2 }}
      >
        <span
          aria-hidden
          className={cn(
            'leading-none drop-shadow-sm text-6xl sm:text-7xl',
            talking ? 'drop-shadow-lg' : 'opacity-75 saturate-50',
          )}
        >
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
}

/**
 * 角色站队:天空体(sky 分流)绝不落地面行、也不渲染任何重复头像/顶栏槽——天幕本体
 * 由 StageSky 布景呈现(§15.4 就地说,无双太阳)。当**当前说者**恰是天空体时,把该句
 * 泡泡 + 名牌锚到天幕位(.stage-sky-speaker,紧邻天幕本体);非说者的天空体零多余 DOM。
 */
export function StageCast({
  cast,
  sky,
  speaker,
  bubble,
}: {
  cast: readonly SpeechRole[]
  sky?: readonly SpeechRole[]
  speaker?: SpeechRole | null
  bubble?: ReactNode
}) {
  const reduce = useReducedMotion()
  const { ground, sky: skyRoles } = skySplit(cast, sky)
  const skySpeaker = speaker && skyRoles.includes(speaker) ? speaker : null
  return (
    <>
      {skySpeaker ? (
        <div data-stage-sky-speaker className="stage-sky-speaker">
          {bubble ? <div data-stage-bubble>{bubble}</div> : null}
          <span className="mt-1.5 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
            {ROLE_META[skySpeaker].name}
          </span>
        </div>
      ) : null}
      <div
        data-stage-ground
        className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-around gap-2 px-[6vw] pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        {ground.map((role) => (
          <CastFigure key={role} role={role} talking={role === speaker} bubble={bubble} reduce={reduce} />
        ))}
      </div>
    </>
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
