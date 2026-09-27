import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ACHIEVEMENTS } from '@/features/achievements'
import { AuthService, PinyinProgressService, SettingsService } from '@/shared/services'
import { registry } from '@/shared/services/core'
import { ParentPanel } from './ParentPanel'

function register(auth: unknown, progress: unknown, settings: unknown = readySettings()) {
  registry.clear()
  registry.register(AuthService, auth as never)
  registry.register(PinyinProgressService, progress as never)
  registry.register(SettingsService, settings as never)
}

/**
 * 家长面板只读 settings 的「已得成就」;本文件里既有的那几条用例不关心它,给个已就绪的空账。
 *
 * 快照**先建好再返回**:`useSyncExternalStore` 要求 `getSnapshot` 返回稳定引用,
 * 每次现造一个新对象会让它在「变了 → 重渲染 → 又变了」之间打转。
 */
function readySettings(earned: string[] = []) {
  const snapshot = {
    status: 'ready' as const,
    data: { earnedAchievements: earned, consecutiveDays: 0, lastActiveDate: '', updatedAt: '' },
  }
  return { getSnapshot: () => snapshot, subscribe: () => () => {} }
}

/** 同上,但停在 loading —— 用来复现「面板打开时 settings 还在路上」。 */
function pendingSettings() {
  const snapshot = {
    status: 'loading' as const,
    data: { earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '', updatedAt: '' },
  }
  return { getSnapshot: () => snapshot, subscribe: () => () => {} }
}

/** 同上,但停在 error —— 拉取失败是第三种「没到位」,不许拿「读取中」把它糊过去。 */
function failedSettings() {
  const snapshot = {
    status: 'error' as const,
    data: { earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '', updatedAt: '' },
    error: '拉取失败',
  }
  return { getSnapshot: () => snapshot, subscribe: () => () => {} }
}

// 「取消后进度仍被清空」的两种真实长相:同步调用,或把调用推迟到微任务/定时器里。
// 同步断言对后者完全失明 —— 所以下面的取消用例必须先排干微任务与定时器再断言。
const DEFERRED_CLEAR = '取消后进度仍被清空:调用被推迟到微任务/定时器里,原同步断言看不见'

describe('家长面板', () => {
  afterEach(() => {
    cleanup()
    registry.clear()
    vi.useRealTimers()
    // confirm 的 spy 会跨用例泄漏(spyOn 挂在 window 上),显式收回。
    vi.restoreAllMocks()
  })

  it('登出调 AuthService.logout', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    register({ logout }, { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll: vi.fn() })
    render(<ParentPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    expect(logout).toHaveBeenCalled()
  })

  // 清空进度不可逆,必须先确认 —— 一键抹掉孩子全部星星是这里最坏的可能。
  it('重置进度要先确认,取消则什么都不做', async () => {
    const calls: string[] = []
    const resetAll = vi.fn().mockImplementation(() => {
      calls.push('resetAll')
      return Promise.resolve()
    })
    register(
      { logout: vi.fn() },
      { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll },
    )
    vi.useFakeTimers()
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      calls.push('confirm')
      return false
    })
    render(<ParentPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '重置全部进度' }))
    // 排干微任务与定时器:任何「取消后仍把清空推迟执行」的写法都必须在这一步现形
    await vi.runAllTimersAsync()
    expect(window.confirm).toHaveBeenCalled()
    expect(resetAll, DEFERRED_CLEAR).not.toHaveBeenCalled()
    // 顺序是被断言的对象,不是副作用:取消时除了一次 confirm,不该再多出任何一步。
    expect(calls, DEFERRED_CLEAR).toEqual(['confirm'])
  })

  it('确认后才真的清', async () => {
    const calls: string[] = []
    const resetAll = vi.fn().mockImplementation(() => {
      calls.push('resetAll')
      return Promise.resolve()
    })
    register(
      { logout: vi.fn() },
      { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll },
    )
    vi.useFakeTimers()
    vi.spyOn(window, 'confirm').mockImplementation(() => {
      calls.push('confirm')
      return true
    })
    render(<ParentPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '重置全部进度' }))
    await vi.runAllTimersAsync()
    expect(resetAll).toHaveBeenCalled()
    // 排干之后仍然必须是「先问、后清」这个次序 —— 倒置或只走个过场都会在这里露馅。
    expect(calls, '确认后顺序必须是先 confirm 再 resetAll,顺序反了说明 confirm 只是走过场').toEqual([
      'confirm',
      'resetAll',
    ])
  })

  it('成就目录全量出现(含未得),中文说明读得通', () => {
    register({ logout: vi.fn() }, { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll: vi.fn() }, readySettings(['perfect_level']))
    render(<ParentPanel onClose={vi.fn()} />)

    const items = [...document.querySelectorAll<HTMLElement>('[data-achievement-id]')]
    expect(items.map((item) => item.dataset.achievementId)).toEqual(ACHIEVEMENTS.map((a) => a.id))
    for (const achievement of ACHIEVEMENTS) {
      expect(screen.getByText(new RegExp(achievement.name))).toBeInTheDocument()
      expect(screen.getByText(new RegExp(achievement.description))).toBeInTheDocument()
    }
  })

  it('已得 / 未得两态分开', () => {
    register({ logout: vi.fn() }, { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll: vi.fn() }, readySettings(['perfect_level']))
    render(<ParentPanel onClose={vi.fn()} />)

    const earned = [...document.querySelectorAll<HTMLElement>('[data-earned="true"]')]
    expect(earned.map((item) => item.dataset.achievementId)).toEqual(['perfect_level'])
  })

  // 面板可能在地图刚画好、settings 还在路上时被打开(App.tsx 的 parent 分支不检查 settings)。
  // 这时候**不能**把目录全量画成「未得」—— 那是屏幕上的一句假话。
  it('settings 没就绪时不画目录,只说读取中', () => {
    register(
      { logout: vi.fn() },
      { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll: vi.fn() },
      pendingSettings(),
    )
    render(<ParentPanel onClose={vi.fn()} />)

    expect(document.querySelectorAll('[data-achievement-id]')).toHaveLength(0)
    expect(screen.getByText('成就数据读取中…')).toBeInTheDocument()
  })

  // 拉取失败(auto/api 抛错后停在 error)是**另一种**非就绪:说成「读取中」就是一句永久的假话,
  // 大人会一直等一个不会来的目录,走查也只会记「未验」—— 真故障被这句话盖掉。
  it('settings 读取失败时说读取失败,不说读取中', () => {
    register(
      { logout: vi.fn() },
      { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll: vi.fn() },
      failedSettings(),
    )
    render(<ParentPanel onClose={vi.fn()} />)

    expect(document.querySelectorAll('[data-achievement-id]')).toHaveLength(0)
    expect(screen.queryByText('成就数据读取中…')).not.toBeInTheDocument()
    expect(screen.getByText('成就数据读取失败')).toBeInTheDocument()
  })
})
