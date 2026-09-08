import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { registry } from '@/shared/services/core'
import { SettingsService } from '@/shared/services'
import type { SettingsSnapshot, UserSettings } from '@/shared/services'
import { SettingsEntry } from './SettingsEntry'
import panelSource from './SettingsPanel.tsx?raw'

const settings: UserSettings = {
  enableChinese: true,
  enableEnglish: true,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}

beforeEach(() => registry.clear())

function registerSettings() {
  // 快照需稳定引用(useSyncExternalStore 要求);save 乐观更新快照,供防全关连点用例反映最新开关态。
  let snapshot: SettingsSnapshot = { status: 'ready', data: settings }
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())
  const save = vi.fn(async (next: UserSettings) => {
    snapshot = { status: 'ready', data: next }
    notify()
  })
  const settingsService: SettingsService = {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    load: vi.fn(async () => undefined),
    save,
  }
  registry.register(SettingsService, settingsService)
  return { settingsService, save }
}

it('开关领域 → SettingsService.save 收到至少一个领域开启的状态', () => {
  const { save } = registerSettings()
  render(<SettingsEntry onClose={vi.fn()} />)

  // 关掉英语,汉语仍开 → 合法切换
  fireEvent.click(screen.getByRole('switch', { name: /英语/ }))

  expect(save).toHaveBeenCalledTimes(1)
  const next = save.mock.calls[0][0]
  expect(next.enableEnglish).toBe(false)
  expect(next.enableChinese || next.enableEnglish).toBe(true)
})

it('防全关:唯一开启领域不可关,第二次 click 不触发 save', () => {
  const { save } = registerSettings()
  render(<SettingsEntry onClose={vi.fn()} />)

  // 先关英语 → 只剩汉语(合法)
  fireEvent.click(screen.getByRole('switch', { name: /英语/ }))
  expect(save).toHaveBeenCalledTimes(1)

  // 再关汉语 → 面板拦下(只剩汉语是唯一开启域),不 save
  fireEvent.click(screen.getByRole('switch', { name: /汉语/ }))
  expect(save).toHaveBeenCalledTimes(1)
})

it('SettingsPanel 保持纯视图:无 service 直取、无跨 feature 依赖', () => {
  expect(panelSource).not.toMatch(/\buseService\s*\(/)
  expect(panelSource).not.toMatch(/@\/features\//)
})
