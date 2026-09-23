import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACHIEVEMENTS } from '@/features/achievements'
import { UNITS } from '@/features/pinyin-blocks'
import { registry } from '@/shared/services/core'
import { bootstrap } from './bootstrap'

/**
 * 内容常量守卫:把**今天真实的**内容常量钉住 —— 任何一处真源被改,这里就红,提醒「文档该跟着复核」。
 *
 * **诚实边界(必读,别把它读成更强的承诺)**:
 * - 本文件**不读文档、也不解析文档**。它只保证「真源变了会红」;**不保证**文档一定被改 ——
 *   红的意思是「有人动了真源,去看一眼文档口径还对不对」,不是「文档已经漂移了」。
 * - 期望值一律写成**显式字面量**(故意不与真源同源):真源一变即红。**别**把它改成
 *   「真源的某种自投影」(如 `expect(UNITS.length).toBe(UNITS.length)`)或「上次跑出来的快照」——
 *   那种绿不携带任何信息。
 * - 放在 `src/app/` 的理由:三条真源跨两层的三个文件(`features/pinyin-blocks/levels.ts`、
 *   `features/achievements/achievements.ts`、`app/bootstrap.ts`),而 **app 是唯一允许同时看见
 *   features 与 app 的一层**(`src/architecture.test.ts` 守的边界里,features 之间禁编译期互引);
 *   与真源同层反而要跨 feature 引。测试文件本身不受该边界测试管辖(它跳过 `.test.` 文件)。
 * - 三个真源各取自**公共面**(两侧 `index.ts` 与 `bootstrap.ts` 的导出),不深入 feature 内部。
 */

beforeEach(() => {
  // 服务真源按**生产注册路径的实际调用**取数:bootstrap 有幂等守卫,
  // 不清空 registry 的话第二次调用会直接返回、一个 register 都不发。
  registry.clear()
  vi.restoreAllMocks()
})

describe('内容常量:真源口径', () => {
  it('课程 = 7 单元 / 37 关', () => {
    expect(UNITS, '单元数').toHaveLength(7)
    expect(
      UNITS.reduce((sum, unit) => sum + unit.levels.length, 0),
      '关数 = 各单元相加',
    ).toBe(37)
    // 每个单元至少一关:否则上面的「相加」可以靠一个空单元凑出来,而空单元在玩法里没有意义。
    for (const unit of UNITS) expect(unit.levels, `${unit.id} 的关卡`).not.toHaveLength(0)
  })

  it('成就目录 = 8 条,id 与文档口径一致', () => {
    // 名字承诺了两件事(条数、id 集合)。两条都留着,且下面那条**不被上面挡死**:
    // 改条数时上面先红,而**换 id(条数不变)** 时只有下面那条红 —— 两种注入各实测过(见 task-14c 报告)。
    expect(ACHIEVEMENTS, '成就条数').toHaveLength(8)
    expect(ACHIEVEMENTS.map((achievement) => achievement.id).sort()).toEqual([
      'collector',
      'combo_15',
      'dedicated',
      'early_bird',
      'grand_master',
      'marathon',
      'night_owl',
      'perfect_level',
    ])
  })

  it('bootstrap 注册的服务 = 11 个', () => {
    const register = vi.spyOn(registry, 'register')
    bootstrap()

    const names = register.mock.calls
      .map(([token]) => String(token).replace(/^Symbol\(|\)$/g, ''))
      .sort()
    expect(names, '注册数').toHaveLength(11)
    expect(names).toEqual(
      [
        'AchievementService',
        'ApiService',
        'AudioService',
        'AuthService',
        'CelebrateService',
        'ComboService',
        'LuckyBonusService',
        'PinyinProgressService',
        'SettingsService',
        'SpeechService',
        'ToastService',
      ].sort(),
    )
  })
})
