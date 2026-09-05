import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { registry } from '@/shared/registry'
import type { SettingsService } from '@/shared/services'
import type { UserSettings } from '@/shared/types'
import { SettingsEntry } from './SettingsEntry'
import panelSource from './SettingsPanel.tsx?raw'

const settings: UserSettings = {
  enablePinyin: true,
  enableHanzi: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}

beforeEach(() => registry.clear())

function registerSettings() {
  // 快照需稳定引用(useSyncExternalStore 要求,否则无限重渲染)
  const settingsSnapshot = { status: 'ready', data: settings } as const
  const save = vi.fn(async (_next: UserSettings) => undefined)
  const settingsService: SettingsService = {
    getSnapshot: () => settingsSnapshot,
    subscribe: () => () => undefined,
    load: vi.fn(async () => undefined),
    save,
  }
  registry.register('settings-state', settingsService)
  return { settingsService, save }
}

it('开关技能 → SettingsService.save 收到至少一个模块开启的状态', () => {
  const { save } = registerSettings()
  render(<SettingsEntry onClose={vi.fn()} />)

  // 关掉英语,拼音/汉字仍开 → 合法切换
  fireEvent.click(screen.getByRole('switch', { name: /英语/ }))

  expect(save).toHaveBeenCalledTimes(1)
  const next = save.mock.calls[0][0]
  expect(next.enableEnglish).toBe(false)
  expect(next.enablePinyin || next.enableHanzi || next.enableEnglish).toBe(true)
})

it('SettingsPanel 保持纯视图:无 service 直取、无跨 feature 依赖', () => {
  expect(panelSource).not.toMatch(/\buseService\s*\(/)
  expect(panelSource).not.toMatch(/@\/features\//)
})
