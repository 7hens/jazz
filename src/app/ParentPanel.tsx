import { X } from 'lucide-react'
import { ACHIEVEMENTS } from '@/features/achievements'
import { AuthService, PinyinProgressService, SettingsService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/ui/utils'

/**
 * 家长面板。**这一页可以写字** —— 它是给大人用的,不是给孩子用的。
 * 装的全是孩子不该碰的东西:登出、清空进度;以及孩子看不见的成就目录
 * (成就名与说明在**可见文字**层面已从孩子面撤下 —— 只剩地图徽章的 aria-label
 * 带名字给读屏用 —— 看得见的那份出口就这一页)。
 *
 * 「隐藏成就」只对孩子有意义:大人该看到目录全量,以及**还差什么**。
 */
export function ParentPanel({ onClose }: { onClose(): void }) {
  const auth = useService(AuthService)
  const progress = useService(PinyinProgressService)
  const settings = useService(SettingsService)
  const settingsSnap = useServiceSnapshot(settings)

  async function reset() {
    if (!window.confirm('确定要重置全部学习进度吗?所有星星都会清零,此操作无法撤销。')) return
    try {
      await progress.resetAll()
    } catch {
      // 服务自身已 toast 报错,这里不重复打扰
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div className="relative max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-[1.75rem] border border-hairline bg-surface p-5 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">家长设置</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={() => { void auth.logout() }}>
            退出登录
          </Button>
          <Button variant="destructive" className="w-full" onClick={() => { void reset() }}>
            重置全部进度
          </Button>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-bold text-ink-2">成就</h3>
          {/* settings 没到位就不画目录:把目录全量画成「未得」是在屏幕上说假话(同 MapEntry 的 null 口径)。
              两种「没到位」还得分着说 —— 拉取失败说成「读取中」是一句永久的假话,而且会把真故障
              盖成「还没读到」,走查遇到它只会记「未验」。 */}
          {settingsSnap.status === 'ready' ? (
            <ul className="mt-2 space-y-2">
              {ACHIEVEMENTS.map((achievement) => {
                const got = settingsSnap.data.earnedAchievements.includes(achievement.id)
                return (
                  <li
                    key={achievement.id}
                    data-achievement-id={achievement.id}
                    data-earned={got ? 'true' : 'false'}
                    className={cn(
                      'flex items-start gap-2 rounded-2xl border border-hairline p-2',
                      got ? '' : 'border-dashed',
                    )}
                  >
                    {/* 两态**承重**的只有两处:图标浓淡(未得更淡)与名字后的「· 已得」(只出现在已得那行)。
                        描边与底色都不承重 —— border-hairline 压 surface 合成出来只有 1.19:1,
                        虚线实线的深浅看不出来,只当个陪衬,别拿它当判据(W-P5 也按这个口径判);
                        已得行**不加底色**:bg-surface-2 压白只有 1.07:1(同样看不出来),却会把
                        已得那行的说明从 4.40:1 拉到 4.11:1 —— 等于让已得态变成两态里更难读的那个,
                        与本页「还差什么读得清」的取向正相反。
                        不给正文降透明度:说明那行是「还差什么」的出口,整块压暗后 ink-3 对 surface
                        只剩 1.52:1(按 55% 合成),读不出东西。
                        副文本用 ink-2 而非 ink-3 —— ink-3 只有 2.26:1(light)/ 3.82:1(dark);
                        ink-2 是 4.40:1(light)/ 7.75:1(dark),已是既有 token 里最接近小字 AA(4.5:1)的
                        一个(ink 到 11.48:1,但主副同一浓度就没主次了)。两态同色,不随未得变淡。
                        数由 token 值合成推得、**非像素裁定**;像素侧归 W-P5。 */}
                    <span aria-hidden className={cn('text-xl', got ? '' : 'opacity-45')}>
                      {achievement.emoji}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-bold">
                        {achievement.name}
                        {got ? ' · 已得' : ''}
                      </span>
                      <span className="block text-xs text-ink-2">
                        {achievement.description}(+{achievement.reward} ⭐)
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : settingsSnap.status === 'error' ? (
            <p className="mt-2 text-sm text-ink-2">成就数据读取失败</p>
          ) : (
            <p className="mt-2 text-sm text-ink-2">成就数据读取中…</p>
          )}
        </div>

        <Button size="lg" className="mt-4 w-full" onClick={onClose}>
          完成
        </Button>
      </div>
    </div>
  )
}
