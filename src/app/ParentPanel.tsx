import { X } from 'lucide-react'
import { AuthService, PinyinProgressService } from '@/shared/services'
import { useService } from '@/shared/services/core'
import { Button } from '@/shared/ui/button'

/**
 * 家长面板。**这一页可以写字** —— 它是给大人用的,不是给孩子用的。
 * 装的全是孩子不该碰的东西:登出、清空进度。
 */
export function ParentPanel({ onClose }: { onClose(): void }) {
  const auth = useService(AuthService)
  const progress = useService(PinyinProgressService)

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
      <div className="relative w-full max-w-sm rounded-[1.75rem] border border-hairline bg-surface p-5 shadow-pop">
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
        <Button size="lg" className="mt-4 w-full" onClick={onClose}>
          完成
        </Button>
      </div>
    </div>
  )
}
