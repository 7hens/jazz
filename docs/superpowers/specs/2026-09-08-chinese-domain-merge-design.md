# 汉语领域并轨(S1):启用模型 3 技能开关 → 2 领域开关

> 日期:2026-09-08 · 影响面:能力(设置语义),兼容新增列 → **minor**
> 来源方向:星语群岛 v10「拼音+汉字 并轨为 汉语(千字谷)」。S1 只做**启用模型结构并轨**,不做叙事皮肤(千字谷/字母林命名另行迭代)。
> 关联:想法池「星语群岛 v10 方向」观察块 · CLAUDE.md 架构铁律 · `docs/dev-reference.md` 数据模型事实(本 spec 落定后须同步)

## 1. 背景与目标

现状 `UserSettings` 以**技能粒度**三开关(`enablePinyin/enableHanzi/enableEnglish`)让家长分别启用 拼音/汉字/英语;每词词课按启用的技能步跑,进度按 `SkillKey` 三键记,DB `user_settings.enable_pinyin/enable_hanzi/enable_english` 三列。

产品判断(来自 v10 设计):拼音是汉字的「声音标注」,不是独立学科 → 拼音与汉字应同属**汉语域**,家长不能再只开拼音或只开汉字。

**本次目标(S1)**:把**启用模型**从「技能级 3 开关」收敛为「领域级 2 开关」——
- `DomainKey = 'chinese' | 'english'`,`chinese` 域**恒**捆绑 `[pinyin, hanzi]` 两技能步,`english` 域 = `[english]`;
- 设置面板只出 汉语/英语 两行;词课内部仍「先声音层(拼音)后形状层(汉字)→ 英语」逐技能步推进,步序、出题、发音、短教、进度三键**一律不动**;
- 进度/结算/成就语义随 `fullComplete` 自动对齐新口径(域内全技能过 = 词完成)。

**非目标(明确不做,防止蔓延)**:
- 千字谷/字母林 命名皮肤、角色叙事、地图分区(v10 后续)。
- 把 `SkillKey` 或 `WordProgress.completed` / DB `progress.*_completed` 三列合并成领域级(破坏,另议)。
- 汉字/拼音在域内进一步细分开关(域即最小粒度)。
- 「settings 中途开/关模块语义缺口」(已有 P1 想法行,本次沿用现状)。
- 冷启动向导新增汉字轨(汉字无基础单元,`unitsFor(hanzi)=[]`,维持现状只按拼音/英语轨抽探针)。

## 2. 现状事实(改动前快照)

- `SkillKey = 'pinyin' | 'hanzi' | 'english'`(shared/services/progress.ts);`SKILL_ORDER=['pinyin','hanzi','english']`(features/lesson/progress-rules.ts)。
- 启用派生唯一真源:`progress-rules.enabledSkills(settings) = SKILL_ORDER.filter(s => settings['enable'+Cap(s)])`;`stepsFor(settings)`(lesson.ts)取 `enabledSkills` 空则回退 `['english']`;`fullComplete`/`firstTargetId` 全部经 `enabledSkills`。
- 结算 `settlement.ts` / `progress.ts settleWord`:`fullComplete` 判定词完成 → 首通 +20;stepReward 每技能 +30(纯函数,域改动自动继承)。
- 设置持久化:worker `handleGetSettings/handlePutSettings`(worker/settings.ts)直读写 3 列;PUT 拒绝三全关(400「至少保留一个学习模块」);无行 GET 返默认三开。
- 前端设置 UI:`SettingsEntry.tsx` 取 `rules.skillOrder()` 传给 `SettingsPanel`(纯 UI,逐技能行 + 防全关)。
- 默认值:`settings-state.defaultSettings()` 三开。
- API 层:api.ts `isSettings` 校验三布尔 + `putSettings` 三键。
- 冷启动 `ColdStartWizard.tsx`:按 `settings.enablePinyin`/`enableEnglish` 抽 `pinyin/english` 轨探针(汉字无轨)。
- DB:0001 基线 `enable_pinyin/enable_hanzi/enable_english INTEGER NOT NULL DEFAULT 1`;0002_fun 加趣味列;0003_basics 建 `basics_progress` 表 → **下一个迁移号 = `0004`**。

## 3. 领域模型设计

### 3.1 领域 → 技能映射(语义属主 lesson/progress-rules)

```ts
export type DomainKey = 'chinese' | 'english'          // 归 shared/services/settings.ts
export const DOMAIN_SKILLS: Record<DomainKey, readonly SkillKey[]> = {
  chinese: ['pinyin', 'hanzi'],
  english: ['english'],
}
```

- `SKILL_ORDER` **保持** `['pinyin','hanzi','english']`(词课步序不变:汉语两声音/形状层在前、英语在后)。
- `enabledSkills(settings)` 改为按域展开且**保持 SKILL_ORDER 顺序**:

```ts
export function enabledSkills(settings: UserSettings): SkillKey[] {
  const out: SkillKey[] = []
  for (const d of ['chinese', 'english'] as const)
    if (settings[d === 'chinese' ? 'enableChinese' : 'enableEnglish']) out.push(...DOMAIN_SKILLS[d])
  return out
}
```

等价现状「汉语开 ⇒ 拼音+汉字都开」;实现细节在 plan 落地时可改写法(如先 collect 后按 SKILL_ORDER 过滤),**契约不变**:返回有序、按当前启用的技能集合。

### 3.2 UserSettings 类型(shared/services/settings.ts)

`enablePinyin/enableHanzi/enableEnglish` → `enableChinese/enableEnglish`,趣味字段(`earnedAchievements/consecutiveDays/lastActiveDate/updatedAt`)不动。

### 3.3 消费点改造清单

| 文件 | 改法 |
|---|---|
| `shared/services/settings.ts` | +`DomainKey`;UserSettings 字段替换;提供 `domainEnableKey(d): 'enableChinese'\|'enableEnglish'`(供 UI/校验复用,避免散写 `'enable'+Cap`) |
| `features/settings-state/settings.ts` | `defaultSettings()` 改双开 |
| `features/settings/SettingsPanel.tsx` | 逐技能行 → 逐域行(2 行,文案 汉语/英语 学习);props `skillOrder: SkillKey[]` → `domainOrder: readonly DomainKey[]`;防全关判定按域;提示「至少保留一个学习领域」 |
| `features/settings/SettingsEntry.tsx` | 传领域序(本地常量 `['chinese','english']` 或 `rules` 提供),不再 `skillOrder()` |
| `features/lesson/progress-rules.ts` | `DOMAIN_SKILLS` + `enabledSkills` 域推导(见 3.1);`SKILL_ORDER`/`fullComplete`/`firstTargetId`/`titleForStars` 不变 |
| `features/foundation/ColdStartWizard.tsx` | `settings.enablePinyin → settings.enableChinese`(仍只抽 pinyin 轨;汉字无轨) |
| `features/api/api.ts` | `isSettings` 校验 `enableChinese/enableEnglish` 双布尔;`putSettings` 请求体双键 |
| `worker/settings.ts` | 读写 `enable_chinese/enable_english` 列;PUT 拒绝**双关**;无行默认双开;错误文案「至少保留一个学习领域」 |

**不动的文件**:`WordLesson`(步序/步名/步点)、`lesson.ts`、`settlement.ts`、`progress.ts`(词课)、`question-engine`、`foundation` 教学/短教、`vocabulary`、`archipelago`、`lingling`、进度持久化(completed 三键、payload、isValidWordProgress 全部照旧)。

### 3.4 迁移 `migrations/0004_chinese_domain.sql`(增量,不改 0001)

```sql
-- 汉语域并轨:settings 启用粒度 3 技能 → 2 领域(汉语=拼音+汉字 / 英语)。
ALTER TABLE user_settings ADD COLUMN enable_chinese INTEGER NOT NULL DEFAULT 1;
-- 旧行连续性:任一侧旧开过汉语技能 → 域开;纯英语/零汉语旧配置不静默塞回汉语。
UPDATE user_settings SET enable_chinese = (enable_pinyin | enable_hanzi);
```

- `enable_english` 复用为英语域;**不**加 `enable_english` 列。
- 旧 `enable_pinyin/enable_hanzi` 列**保留不删**(0001 基线不动),新代码停写停读;旧代码回滚(见 §6)读旧列不受新列影响 → 兼容。
- 回填用 `py|hz`(位或):任一旧汉语技能开 = 域开(老「只汉字 / 只拼音」用户并入域、补另一层,符合并轨意图且**不会**把纯英语用户静默扩回汉语;两旧列全 0 的纯英语用户域关)。
- 新增行:worker PUT 显式写 `enable_chinese`;DEFAULT 1 仅作回滚兜底。

## 4. 领域语义细节

- **域完成口径**:`fullComplete` 经 `enabledSkills` → 汉语域下「拼音+汉字 都 completed」才认词全;英语域 `english`。与 0.2.0 全开时的旧判定**逐词等价**(那时 pinyin&&hanzi&&english 都要求)。
- **只开一域合法**:英语-only / 汉语-only 均可;双关拒绝(前端面板防 + worker 400 双保险)。
- **首次 +30 / 整词 +20**:结算纯函数不感知域,经 `fullComplete` 自动新口径;无重复造逻辑。
- **步数显示**:词课 `第{stepIndex+1}/{steps.length}技能` 照旧(内部步即技能)。

## 5. 边界与已知缺口(不在本次)

1. 已 P1 记:「settings 中途开启模块的语义缺口」——家长中途开汉语域 ⇒ 旧英文已全的词回需补两中文层、目标词回跳。本次不修,沿用现状(`fullComplete` 即时态语义)。
2. 千字谷/字母林 命名皮肤、角色、5 世界(v10 观察块,后续)。
3. 若某库同时存在「启用 3 技能→2 域」历史回滚需求,迁移文件不回滚(铁律),回滚方向见 §6。

## 6. 兼容、回滚与发布顺序

- **向前**:纯增量列;`0002`/`0003` 未远程 apply 的库照常顺序 apply(0001→0002→0003→0004)。
- **向后(代码回滚)**:旧代码读写旧 `enable_pinyin/hanzi` 三列、忽略 `enable_chinese`;旧 PUT 会把三旧列覆写为三开语义 → 行为退回技能级,`enable_chinese` 成孤儿列无害。DB 不回滚。
- **顺序**:本地 `npm run db:local`(含 0004)→ 发布时 preview → prod apply(经 `/release`)。
- **发布**:能力且兼容 → minor;随 feature 轨发版。0.2.0 未发期间本项并入开发,0004 随**本项所在版本**远程 apply。

## 7. 测试与验收

- `enabledSkills`/`fullComplete` 域语义单测:汉语开→[pinyin,hanzi];英语开→[english];双开→三键;汉语开 English 关 → 词需 拼音&&汉字;全关回退 `['english']`(stepsFor 既有)。
- 全仓 `UserSettings` 夹具(15+ 测试文件)迁移到双域字段;`npm test` 全绿为闸。
- `api.test`/worker 契约:`isSettings` 双布尔、PUT 双关 400、GET 无行默认双开。
- `SettingsPanel`/`SettingsEntry`/`ColdStartWizard` 测试更新至域文案与门控。
- 手工验收:家长面板 汉语/英语 两行;只关英语 → 词课只跑 拼音+汉字 两步;只关汉语 → 只英语一步;双关被面板拦;旧「纯英语」库迁移后仍英语-only。
- architecture 测试照跑(无跨 feature 新互引;DomainKey/domainEnableKey 在 shared,映射在 lesson 属主)。

## 8. 落地方式(遵循仓库纪律)

- 大项 → topic 分支 / worktree;先 spec(本文)后 plan(writing-plans)→ TDD → 并入 main。
- dev-reference.md 数据模型/worker/前端明细事实随代码同步小改。
