import { describe, expect, it, vi } from 'vitest'
import type { Achievement, Rng, UserSettings } from '@/shared/services'
import { settleLevel } from './settle'

const SETTINGS: UserSettings = {
  enableChinese: true,
  enableEnglish: false,
  earnedAchievements: [],
  consecutiveDays: 0,
  lastActiveDate: '',
  updatedAt: '',
}

const SERVICES = {
  progress: { recordClear: vi.fn().mockResolvedValue(undefined) },
  settings: { save: vi.fn().mockResolvedValue(undefined) },
  combo: { getBonus: () => 0 },
  lucky: { roll: (() => 0) as (rng?: Rng) => number },
  achievements: { scan: () => [] as readonly Achievement[] },
  overlays: { enqueue: vi.fn() },
}

const INPUT = {
  levelId: 'u1-0',
  stars: 3,
  currentStars: {} as Record<string, number>,
  totalStars: 0,
  settings: SETTINGS,
  sessionCleared: 0,
  maxCombo: 0,
  now: () => new Date('2026-09-21T10:00:00'),
}

describe('关卡结算', () => {
  it('星尘 = 连击加成 + 幸运,一并写进进度', async () => {
    const progress = { recordClear: vi.fn().mockResolvedValue(undefined) }
    const result = await settleLevel(
      { ...INPUT, currentStars: {} },
      { ...SERVICES, progress, combo: { getBonus: () => 25 }, lucky: { roll: () => 50 } },
    )
    expect(result.starDust).toBe(75)
    expect(progress.recordClear).toHaveBeenCalledWith({ levelId: 'u1-0', stars: 3, starDust: 75 })
  })

  // 重玩已经通过的关不该再抽一次幸运 —— 否则刷一关就能刷星尘。
  it('重玩已通关的关:星级仍取 max(交给服务端),但不再掷幸运、不再计首通', async () => {
    const recordClear = vi.fn().mockResolvedValue(undefined)
    const roll = vi.fn().mockReturnValue(50)
    const result = await settleLevel(
      { ...INPUT, stars: 1, currentStars: { 'u1-0': 3 } },
      { ...SERVICES, progress: { recordClear }, combo: { getBonus: () => 0 }, lucky: { roll } },
    )
    expect(roll).not.toHaveBeenCalled()
    expect(result.luckyReward).toBe(0)
    // 传上去的是**本次**的原始星数(1),取 max 是服务端的事。
    expect(recordClear).toHaveBeenCalledWith({ levelId: 'u1-0', stars: 1, starDust: 0 })
  })

  it('首次通关计入会话首通数,重玩不计', async () => {
    const scan = vi.fn().mockReturnValue([])
    const first = await settleLevel({ ...INPUT, currentStars: {} }, { ...SERVICES, achievements: { scan } })
    expect(first.sessionCleared).toBe(1)
    expect(scan.mock.calls[0]?.[0].firstCompleteToday).toBe(1)

    // 重玩:上一关已经通了,会话首通数原样带回
    const replay = await settleLevel(
      { ...INPUT, stars: 3, currentStars: { 'u1-0': 1 }, sessionCleared: 1 },
      { ...SERVICES, achievements: { scan } },
    )
    expect(replay.sessionCleared).toBe(1)
    expect(scan.mock.calls[1]?.[0].firstCompleteToday).toBe(1)
  })

  it('成就奖励计入星尘,并写进 earnedAchievements', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const gained: Achievement = { id: 'perfect_level', name: '完美主义', description: '', emoji: '💎', reward: 50 }
    const result = await settleLevel(
      { ...INPUT, currentStars: {} },
      { ...SERVICES, settings: { save }, achievements: { scan: () => [gained] } },
    )
    expect(result.starDust).toBe(50)
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ earnedAchievements: ['perfect_level'] }))
  })

  // 连击是浏览器会话的账,结算是这一关的账 —— 谁的生命周期谁负责带过来。
  it('maxCombo 带入参并落到成就判定', async () => {
    const scan = vi.fn().mockReturnValue([])
    await settleLevel({ ...INPUT, currentStars: {}, maxCombo: 9 }, { ...SERVICES, achievements: { scan } })
    expect(scan.mock.calls[0]?.[0].maxCombo).toBe(9)
  })

  it('连续天数按本地日历推进', async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    await settleLevel(
      { ...INPUT, settings: { ...SETTINGS, consecutiveDays: 3, lastActiveDate: '2026-09-20' } },
      { ...SERVICES, settings: { save } },
    )
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ consecutiveDays: 4, lastActiveDate: '2026-09-21' }))
  })

  // 没通过就是没通过:0 星落在 SettleInput.stars 的域(1..3)之外,
  // 不认它的守卫 -> 故意输也能刷星尘与「马拉松」(firstCompleteToday ≥ 5)。
  it('失败(0 星):不掷幸运、不发星尘、不计首通', async () => {
    const recordClear = vi.fn().mockResolvedValue(undefined)
    const roll = vi.fn().mockReturnValue(50)
    const scan = vi.fn().mockReturnValue([])
    const result = await settleLevel(
      { ...INPUT, stars: 0, currentStars: {}, sessionCleared: 1, maxCombo: 4 },
      {
        ...SERVICES,
        progress: { recordClear },
        combo: { getBonus: () => 25 },
        lucky: { roll },
        achievements: { scan },
      },
    )
    expect(roll).not.toHaveBeenCalled()
    expect(result.luckyReward).toBe(0)
    expect(result.starDust).toBe(0)
    expect(result.sessionCleared).toBe(1)
    expect(scan.mock.calls[0]?.[0].firstCompleteToday).toBe(1)
    expect(recordClear).toHaveBeenCalledWith({ levelId: 'u1-0', stars: 0, starDust: 0 })
  })

  // 完美单元数是唯一一个「跨关」的量:单元内全三星的单元数,不等于三星关数。
  it('完美单元数按「单元内全三星」算,与三星关数分开', async () => {
    const scan = vi.fn().mockReturnValue([])
    // u1 三关只通了第一关的三星 → 三星关数 1,全三星单元 0
    await settleLevel({ ...INPUT, currentStars: {} }, { ...SERVICES, achievements: { scan } })
    expect(scan.mock.calls[0]?.[0]).toMatchObject({ perfectLevels: 1, perfectUnits: 0 })

    // 补齐 u1 剩下两关的三星 → 三星关数 3,全三星单元 1
    await settleLevel(
      { ...INPUT, levelId: 'u1-2', currentStars: { 'u1-0': 3, 'u1-1': 3 } },
      { ...SERVICES, achievements: { scan } },
    )
    expect(scan.mock.calls[1]?.[0]).toMatchObject({ perfectLevels: 3, perfectUnits: 1 })
  })

  // 星级是信任边界:落库后走服务端 MAX 合并(只升不降),混进来的 4 写进去
  // 就永远回不来 —— 不可撤销的数据污染,所以在这里钳到 [0,3]。
  it('星级越界:5 钳到 3,不落到进度里', async () => {
    const recordClear = vi.fn().mockResolvedValue(undefined)
    const result = await settleLevel(
      { ...INPUT, stars: 5, currentStars: {} },
      { ...SERVICES, progress: { recordClear } },
    )
    expect(result.stars).toBe(3)
    expect(recordClear).toHaveBeenCalledWith({ levelId: 'u1-0', stars: 3, starDust: 0 })
  })

  // 下界是 0 不是 1:把 0 星抬成 1 星等于失败送星。
  it('星级越界:-1 钳到 0,仍不掷幸运、不计首通', async () => {
    const recordClear = vi.fn().mockResolvedValue(undefined)
    const roll = vi.fn().mockReturnValue(50)
    const result = await settleLevel(
      { ...INPUT, stars: -1, currentStars: {}, sessionCleared: 2 },
      { ...SERVICES, progress: { recordClear }, lucky: { roll } },
    )
    expect(result.stars).toBe(0)
    expect(recordClear).toHaveBeenCalledWith({ levelId: 'u1-0', stars: 0, starDust: 0 })
    expect(roll).not.toHaveBeenCalled()
    expect(result.luckyReward).toBe(0)
    expect(result.sessionCleared).toBe(2)
  })
})
