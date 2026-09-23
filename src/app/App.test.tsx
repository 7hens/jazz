import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { registry } from '@/shared/services/core'
import {
  AchievementService,
  AudioService,
  AuthService,
  CelebrateService,
  ComboService,
  LuckyBonusService,
  PinyinProgressService,
  SettingsService,
  SpeechService,
} from '@/shared/services'
import type {
  AuthSnapshot,
  ComboSnapshot,
  PinyinProgressSnapshot,
  SettingsSnapshot,
  User,
  UserSettings,
} from '@/shared/services'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { ACHIEVEMENTS } from '@/features/achievements'
import App from './App'

const user: User = { id: 'u', email: '', name: '' }

const settings: UserSettings = {
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '2026-09-05T00:00:00.000Z',
}

// 快照需稳定引用(useSyncExternalStore 要求);publish 替换为新对象并通知订阅。
function createStore<T>(initial: T) {
  let snapshot = initial
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    publish(next: T) {
      snapshot = next
      listeners.forEach((listener) => listener())
    },
  }
}

/** 只登记 App 相位机真正取用的服务 —— 未注册的服务会当场抛错,那本身也是断言。 */
function registerAll(opts: { settingsPublishes?: boolean } = {}) {
  registry.clear()

  const authStore = createStore<AuthSnapshot>({ status: 'checking' })
  const check = vi.fn(async () => undefined)
  const auth: AuthService = {
    getSnapshot: authStore.getSnapshot,
    subscribe: authStore.subscribe,
    check,
    login: vi.fn(async () => undefined),
    logout: vi.fn(async () => undefined),
    markAnonymous: () => authStore.publish({ status: 'anonymous' }),
  }

  const progressStore = createStore<PinyinProgressSnapshot>({ status: 'idle', data: { stars: {}, totalStars: 0 } })
  const progressLoad = vi.fn(async () => {
    progressStore.publish({ status: 'ready', data: progressStore.getSnapshot().data })
  })
  const progress: PinyinProgressService = {
    getSnapshot: progressStore.getSnapshot,
    subscribe: progressStore.subscribe,
    load: progressLoad,
    recordClear: vi.fn(async () => undefined),
    resetAll: vi.fn(async () => undefined),
  }

  const settingsStore = createStore<SettingsSnapshot>({ status: 'idle', data: settings })
  const settingsLoad = vi.fn(async () => {
    // settingsPublishes: false 用来复现「设置没拉回来就进了关卡」那一格。
    if (opts.settingsPublishes === false) return
    settingsStore.publish({ status: 'ready', data: settingsStore.getSnapshot().data })
  })
  const settingsService: SettingsService = {
    getSnapshot: settingsStore.getSnapshot,
    subscribe: settingsStore.subscribe,
    load: settingsLoad,
    save: vi.fn(async () => undefined),
  }

  const comboStore = createStore<ComboSnapshot>({ combo: 0, maxCombo: 0 })
  const combo: ComboService = {
    getSnapshot: comboStore.getSnapshot,
    subscribe: comboStore.subscribe,
    answer: vi.fn(() => 0),
    reset: vi.fn(),
    getBonus: vi.fn(() => 0),
  }

  const audioStore = createStore(true)
  const audio: AudioService = {
    getSnapshot: audioStore.getSnapshot,
    subscribe: audioStore.subscribe,
    isOn: audioStore.getSnapshot,
    setOn: (on) => audioStore.publish(on),
    play: vi.fn(),
    unlock: () => undefined,
  }

  const speech: SpeechService = { speak: () => true, speakRole: () => true, stop: () => undefined }
  const celebrate: CelebrateService = { play: vi.fn() }
  const achievements: AchievementService = { scan: () => [] }
  const lucky: LuckyBonusService = { roll: () => 0 }

  registry.register(AuthService, auth)
  registry.register(PinyinProgressService, progress)
  registry.register(SettingsService, settingsService)
  registry.register(ComboService, combo)
  registry.register(AudioService, audio)
  registry.register(SpeechService, speech)
  registry.register(CelebrateService, celebrate)
  registry.register(AchievementService, achievements)
  registry.register(LuckyBonusService, lucky)

  return { authStore, check, progressLoad, progressStore, settingsLoad, settingsStore }
}

/** 登录态挂载 App(认证在 check 内同步 publish,与生产同序)。 */
function mountApp(opts: { settingsPublishes?: boolean } = {}) {
  const svc = registerAll(opts)
  svc.check.mockImplementation((): Promise<undefined> => {
    svc.authStore.publish({ status: 'authenticated', user })
    return Promise.resolve(undefined)
  })
  const utils = render(<App />)
  return { svc, ...utils }
}

beforeEach(() => registry.clear())

describe('App 路由', () => {
  it('boot → login:认证返回匿名时显示登录门', async () => {
    const svc = registerAll()
    svc.authStore.publish({ status: 'anonymous' })
    render(<App />)

    expect(await screen.findByRole('button', { name: /进入魔法岛/ })).toBeInTheDocument()
  })

  it('登录后直达单元地图:progress 与 settings 都拉了', async () => {
    const { svc, container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-unit-map]')).not.toBeNull())
    await waitFor(() => expect(svc.progressLoad).toHaveBeenCalled())
    // settings 不拉 = 关卡结算会拿 defaultSettings() 覆盖服务端(连续天数/成就清零)
    await waitFor(() => expect(svc.settingsLoad).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: /进入魔法岛/ })).toBeNull()
  })

  it('地图零汉字:格子靠名片积木自表意(文字部分是 aria-label,不进 textContent)', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-unit-map]')).not.toBeNull())
    const text = container.querySelector('[data-unit-map]')!.textContent ?? ''
    expect(text).not.toMatch(HAN_TEXT)
  })

  it('401 → login:会话转为匿名后(哪怕相位还停在地图)回到登录门', async () => {
    const { svc, container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-unit-map]')).not.toBeNull())
    act(() => svc.authStore.publish({ status: 'anonymous' }))

    expect(await screen.findByRole('button', { name: /进入魔法岛/ })).toBeInTheDocument()
    // 认证分支排在最前,相位不参与决策 —— 匿名态下不该还留着地图
    expect(container.querySelector('[data-unit-map]')).toBeNull()
  })

  it('map → level:点单元进关卡页,带本单元进度与回地图按钮', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-unit-map]')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: '第 1 单元' }))

    expect(await screen.findByRole('button', { name: '回地图' })).toBeInTheDocument()
    expect(container.querySelector('[data-unit-map]')).toBeNull()
    expect(screen.getByText('1/3')).toBeInTheDocument() // u1 三关,从第一关进
  })

  it('map → parent → map:家长面板开合', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-unit-map]')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: '家长' }))

    expect(await screen.findByRole('heading', { name: '家长设置' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '完成' }))
    expect(await screen.findByRole('button', { name: '家长' })).toBeInTheDocument()
  })

  it('设置没就绪时停在 boot:既不渲染关卡页,也**不偷偷进地图**', async () => {
    // 场景:登录已成功、进度的确 ready(所以地图能画),但设置的 load 没回来 ——
    // 此时点单元进关卡,必须停在 BootScreen 等设置,而不是拿默认设置去结算。
    const { container } = mountApp({ settingsPublishes: false })

    await waitFor(() => expect(container.querySelector('[data-unit-map]')).not.toBeNull())
    fireEvent.click(screen.getByRole('button', { name: '第 1 单元' }))

    // 关键区分断在正向断言之前,失败信息才指得准「悄悄进了哪儿」:
    // `data-unit-map` 只有地图有(条件并进上层 if 会落到地图分支 → 红在这),
    // `回地图` 只有关卡有(把就绪门整个删掉 → 红在这)。
    // 两条都为 null 时,**并不能**说明停在 BootScreen(logout 那一格也能过)——
    // 所以下面必须再有正向断言。
    expect(document.querySelector('[data-unit-map]')).toBeNull()
    expect(screen.queryByRole('button', { name: '回地图' })).toBeNull()
    // 正向:确实停在 BootScreen(唯一渲染 `.animate-spin` 的分支),不是空白页
    await waitFor(() => expect(container.querySelector('.animate-spin')).not.toBeNull())
  })

  // settings 在路上时地图照样画得出来(App 的地图分支只等 progress),但徽章栏必须**整个不出现** ——
  // 画成「全暗」等于对孩子说「你一个成就都没拿到」,而真相是「还不知道」。
  it('settings 未就绪时地图上不出现徽章栏(而不是画成全暗)', async () => {
    const { container } = mountApp({ settingsPublishes: false })

    await waitFor(() => expect(container.querySelector('[data-unit-map]')).not.toBeNull())
    expect(document.querySelectorAll('[data-badge-id]')).toHaveLength(0)
  })

  it('settings 就绪后徽章栏出现,目录全量的格全暗(知道且为空 ≠ 不知道)', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-unit-map]')).not.toBeNull())
    expect(document.querySelectorAll('[data-badge-id]')).toHaveLength(ACHIEVEMENTS.length)
    expect(document.querySelectorAll('[data-badge-earned="true"]')).toHaveLength(0)
  })
})
