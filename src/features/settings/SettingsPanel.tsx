import { X } from 'lucide-react'
import { cn } from '@/shared/ui/utils'
import type { DomainKey, UserSettings } from '@/shared/services'
import { enableKeyOf } from '@/shared/services'
import { Button } from '@/shared/ui/button'

export type SettingsPanelProps = {
  settings: UserSettings
  domainOrder: readonly DomainKey[]
  onChange: (next: UserSettings) => void
  onClose: () => void
}

const DOMAIN_LABEL: Record<DomainKey, string> = { chinese: '汉语', english: '英语' }

export function SettingsPanel({ settings, domainOrder, onChange, onClose }: SettingsPanelProps) {
  function toggle(domain: DomainKey) {
    const key = enableKeyOf(domain)
    // 防全关:若正在关闭的域是唯一开启域,拒绝(保持选中)。
    if (settings[key] && domainOrder.every((d) => d === domain || !settings[enableKeyOf(d)])) return
    onChange({ ...settings, [key]: !settings[key], updatedAt: new Date().toISOString() })
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-[1.75rem] border border-hairline bg-surface p-5 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">学习设置</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-3">
          {domainOrder.map((domain) => {
            const on = settings[enableKeyOf(domain)]
            return (
              <button
                key={domain}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(domain)}
                className="flex w-full items-center justify-between rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-left"
              >
                <span className="text-[15px] font-semibold">{DOMAIN_LABEL[domain]} 学习</span>
                <span
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    on ? 'bg-emerald' : 'bg-ink/20',
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                      on ? 'translate-x-[22px]' : 'translate-x-0.5',
                    )}
                  />
                </span>
              </button>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-ink-3">至少保留一个学习领域。设置会同步到本设备。</p>
        <Button size="lg" className="mt-4 w-full" onClick={onClose}>
          完成
        </Button>
      </div>
    </div>
  )
}
