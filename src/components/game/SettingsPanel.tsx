import { X } from 'lucide-react'
import { SKILL_ORDER } from '../../game/lesson'
import { cn } from '../../lib/utils'
import type { SkillKey, UserSettings } from '../../types'
import { Button } from '../ui/button'

export type SettingsPanelProps = {
  settings: UserSettings
  onChange: (next: UserSettings) => void
  onClose: () => void
}

const LABELS: Record<SkillKey, string> = { pinyin: '拼音', hanzi: '汉字', english: '英语' }

function keyFor(skill: SkillKey): 'enablePinyin' | 'enableHanzi' | 'enableEnglish' {
  return ('enable' + skill[0].toUpperCase() + skill.slice(1)) as 'enablePinyin' | 'enableHanzi' | 'enableEnglish'
}

export function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
  function toggle(skill: SkillKey) {
    const key = keyFor(skill)
    // 防全关:若正在关闭的项是当前唯一开启项,拒绝(保持选中)。
    if (settings[key] && SKILL_ORDER.every((s) => s === skill || !settings[keyFor(s)])) return
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
          {SKILL_ORDER.map((skill) => {
            const on = settings[keyFor(skill)]
            return (
              <button
                key={skill}
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(skill)}
                className="flex w-full items-center justify-between rounded-2xl border border-hairline bg-surface-2 px-4 py-3 text-left"
              >
                <span className="text-[15px] font-semibold">{LABELS[skill]} 学习</span>
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
        <p className="mt-3 text-xs text-ink-3">至少保留一个学习模块。设置会同步到本设备。</p>
        <Button size="lg" className="mt-4 w-full" onClick={onClose}>
          完成
        </Button>
      </div>
    </div>
  )
}
