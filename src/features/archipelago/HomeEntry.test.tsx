import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registry } from '@/shared/registry'
import type { AudioService, ComboService, ProgressService, SettingsService } from '@/shared/services'
import type { UserSettings } from '@/shared/types'
import { HomeEntry } from './HomeEntry'
import viewSource from './ArchipelagoView.tsx?raw'

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

function registerServices() {
  // 快照需稳定引用(useSyncExternalStore 要求,否则无限重渲染)
  const progressSnapshot = { status: 'ready', data: {} } as const
  const settingsSnapshot = { status: 'ready', data: settings } as const
  const resetAll = vi.fn(async () => undefined)
  const saveSettings = vi.fn(async (_next: UserSettings) => undefined)
  const resetCombo = vi.fn()
  const play = vi.fn()
  const progress: ProgressService = {
    getSnapshot: () => progressSnapshot,
    subscribe: () => () => undefined,
    load: vi.fn(async () => undefined),
    seed: vi.fn(),
    saveStep: vi.fn(async () => undefined),
    saveAll: vi.fn(async () => undefined),
    resetAll,
  }
  const settingsService: SettingsService = {
    getSnapshot: () => settingsSnapshot,
    subscribe: () => () => undefined,
    load: vi.fn(async () => undefined),
    save: saveSettings,
  }
  const combo: ComboService = {
    getSnapshot: () => ({ combo: 0, maxCombo: 0 }),
    subscribe: () => () => undefined,
    answer: vi.fn(() => 0),
    reset: resetCombo,
    getBonus: vi.fn(() => 0),
  }
  const audio: AudioService = {
    getSnapshot: () => true,
    subscribe: () => () => undefined,
    isOn: vi.fn(() => true),
    setOn: vi.fn(),
    play,
    unlock: vi.fn(),
  }
  registry.register('progress', progress)
  registry.register('settings-state', settingsService)
  registry.register('combo', combo)
  registry.register('audio', audio)
  return { progress, settingsService, combo, audio, resetAll, saveSettings, resetCombo, play }
}

describe('主页入口', () => {
  it('点击首个可用词,onEnterLesson 收到该词 id', () => {
    const { play } = registerServices()
    const onEnterLesson = vi.fn()
    render(<HomeEntry onEnterLesson={onEnterLesson} onOpenSettings={vi.fn()} onLogout={vi.fn()} />)

    // 空进度下首词(词 1)为当前目标,未锁可直接点
    const first = screen.getByRole('button', { name: /^词 1 / })
    fireEvent.click(first)

    expect(play).toHaveBeenCalledWith('tap')
    expect(onEnterLesson).toHaveBeenCalledWith(1)
  })

  it('菜单重置进度:确认后经 ProgressService.resetAll', async () => {
    const { resetAll, saveSettings, resetCombo } = registerServices()
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<HomeEntry onEnterLesson={vi.fn()} onOpenSettings={vi.fn()} onLogout={vi.fn()} />)

    const openMenu = () => fireEvent.click(screen.getByRole('button', { name: '家长菜单' }))
    const clickReset = () => fireEvent.click(screen.getByText('重置进度'))

    // 拒绝确认 → 不动进度
    openMenu()
    clickReset()
    expect(resetAll).not.toHaveBeenCalled()

    // 确认 → 重置服务 + 清趣味字段
    confirmSpy.mockReturnValue(true)
    openMenu()
    clickReset()
    await waitFor(() => expect(resetAll).toHaveBeenCalledTimes(1))
    expect(resetCombo).toHaveBeenCalledTimes(1)
    expect(saveSettings).toHaveBeenCalledTimes(1)
    const saved = saveSettings.mock.calls[0][0]
    expect(saved).toMatchObject({ earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '' })
    // 技能开关保持原样(未全关)
    expect(saved.enablePinyin || saved.enableHanzi || saved.enableEnglish).toBe(true)
  })

  it('ArchipelagoView 保持纯视图:无 service 直取、无跨 feature 依赖', () => {
    expect(viewSource).not.toMatch(/\buseService\s*\(/)
    expect(viewSource).not.toMatch(/@\/features\//)
  })
})
