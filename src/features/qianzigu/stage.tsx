import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import type { SpeechRole } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import type { AtmosphereKey } from './chapter'
import { ROLE_META } from './scene-ui'
import { showMoonStars, skySplit, sunStage, type SunStage } from './stage-meta'
import { atmosphereToClass, roleScale, STAGE_BODIES, SUN_STAGE_EMOJI, worldDesatClass } from './stage-visuals'

/** 全窗不滚舞台帧(dvh 防移动端地址栏)。 */
export function StageFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('relative h-dvh w-full overflow-hidden bg-canvas', className)}>{children}</div>
}

/** 真夜幕(break/social/boss 用的 night/dark)太阳不现身,天幕只留月星(§15.4)。 */
const HIDES_SUN = (atmosphere: AtmosphereKey): boolean => atmosphere === 'night' || atmosphere === 'dark'

/**
 * 千字谷实景布景层(全窗竖分,§15.1):氛围渐变底 + 世界回春灰档,
 * 上层叠 天顶云 → 月/星(失光或真夜显)→ 太阳位(4 档进度尺)→ 山壁 → 村庄 → 河流横贯。
 * 太阳档由 fraction 经 sunStage 推出(可显式注入覆盖);月星由 showMoonStars 裁决。
 */
export function StageSky({
  atmosphere,
  fraction,
  sun = sunStage(fraction),
  moonStars = showMoonStars(fraction, atmosphere),
}: {
  atmosphere: AtmosphereKey
  fraction: number
  sun?: SunStage
  moonStars?: boolean
}) {
  const { emoji, className } = SUN_STAGE_EMOJI[sun]
  return (
    <div aria-hidden className={cn('absolute inset-0', atmosphereToClass(atmosphere))}>
      {/* 世界回春:灰档叠在布景层(山/村/河)上,随太阳复原撤灰上彩;太阳/月星不受世界灰档压制 */}
      <div className={cn('absolute inset-0', worldDesatClass(fraction))}>
        <div className="stage-mountains">{STAGE_BODIES.mountains}</div>
        <div className="stage-village">{STAGE_BODIES.village}</div>
        <div className="stage-river">
          <span className="stage-river-emblem">{STAGE_BODIES.river}</span>
          <span className="stage-river-waves">{STAGE_BODIES.waves}</span>
        </div>
      </div>
      {/* 天顶云(常飘,reduced-motion 尊重) */}
      <div className="stage-clouds">{STAGE_BODIES.clouds}</div>
      {/* 月/星:失光(烧焦蛋未愈)或真夜幕显;day 复原后隐 */}
      {moonStars ? (
        <div data-sky-bodies className="stage-sky-bodies">
          <span className="stage-moon">{STAGE_BODIES.moon}</span>
          <span className="stage-stars">{STAGE_BODIES.stars}</span>
        </div>
      ) : null}
      {/* 天幕主位:太阳星体(进度尺;真夜幕隐) */}
      {!HIDES_SUN(atmosphere) ? (
        <div data-sun className={cn('stage-sun', className)}>
          {emoji}
        </div>
      ) : null}
    </div>
  )
}

/** 单个站队角色:说话者弹跳 + 高亮名字牌;bubble 渲染在其上方。compact = 天空体(顶栏简排,Task 3 前兜底)。 */
function CastFigure({
  role,
  talking,
  bubble,
  reduce,
  compact = false,
}: {
  role: SpeechRole
  talking: boolean
  bubble?: ReactNode
  reduce: boolean | null
  compact?: boolean
}) {
  const meta = ROLE_META[role]
  return (
    <div className={cn('relative flex flex-col items-center', compact ? '' : 'min-w-0 flex-1')}>
      <div
        className={cn(
          'flex w-full items-end justify-center',
          compact ? 'h-4' : 'mb-1 h-[3.5rem] max-w-[46vw] sm:max-w-xs',
        )}
      >
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
            'leading-none drop-shadow-sm',
            compact ? 'text-3xl sm:text-4xl' : 'text-6xl sm:text-7xl',
            talking ? 'drop-shadow-lg' : 'opacity-75 saturate-50',
          )}
        >
          {meta.emoji}
        </span>
        <span
          className={cn(
            'mt-1 rounded-full px-2 py-0.5 text-xs font-bold text-white',
            talking ? 'bg-accent' : compact ? 'bg-ink/55' : 'bg-ink/60',
          )}
        >
          {meta.name}
        </span>
      </motion.div>
    </div>
  )
}

/**
 * 角色站队(地面行,底部):说话者弹跳 + 高亮名字牌;bubble 在其上方。
 * sky 分流:传入 sky 后,天空体(skySplit)不进地面 flex,改落天幕顶栏简排(data-stage-sky);
 * 深接「天空体就地出泡锚太阳位」由 Task 3 做,本层保证天空体不占地面行。
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
  return (
    <>
      {skyRoles.length > 0 ? (
        <div
          data-stage-sky
          className="pointer-events-none absolute inset-x-0 top-1 z-[5] flex items-start justify-center gap-5 px-4"
        >
          {skyRoles.map((role) => (
            <CastFigure key={role} role={role} talking={role === speaker} bubble={bubble} reduce={reduce} compact />
          ))}
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
