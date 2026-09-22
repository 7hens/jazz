import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AuthService, PinyinProgressService } from '@/shared/services'
import { registry } from '@/shared/services/core'
import { ParentPanel } from './ParentPanel'

function register(auth: unknown, progress: unknown) {
  registry.clear()
  registry.register(AuthService, auth as never)
  registry.register(PinyinProgressService, progress as never)
}

describe('家长面板', () => {
  afterEach(() => {
    cleanup()
    registry.clear()
  })

  it('登出调 AuthService.logout', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    register({ logout }, { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll: vi.fn() })
    render(<ParentPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '退出登录' }))
    expect(logout).toHaveBeenCalled()
  })

  // 清空进度不可逆,必须先确认 —— 一键抹掉孩子全部星星是这里最坏的可能。
  it('重置进度要先确认,取消则什么都不做', () => {
    const resetAll = vi.fn().mockResolvedValue(undefined)
    register({ logout: vi.fn() }, { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<ParentPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '重置全部进度' }))
    expect(window.confirm).toHaveBeenCalled()
    expect(resetAll).not.toHaveBeenCalled()
  })

  it('确认后才真的清', async () => {
    const resetAll = vi.fn().mockResolvedValue(undefined)
    register({ logout: vi.fn() }, { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ParentPanel onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '重置全部进度' }))
    expect(resetAll).toHaveBeenCalled()
  })
})
