# 特效零文本化 + 地图徽章栏 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把孩子面上的中文文字(成就弹层 / 幸运弹层)换成 emoji + 数字,把连击做成关内可见的圆点,把成就名与说明搬到家长面板,并在地图上加一条 8 格成就徽章栏。

**Architecture:** 三层骨架不动。`shared/` 只新增两个纯常量文件(一个测试用汉字正则、一个奖励弹层共享外壳类);`features/` 内改 `achievements` / `lucky-bonus` / `celebrate` / `pinyin-blocks` 四个 feature,彼此仍禁编译期互引 —— 成就目录由 `app/` 注入(跨 feature 组装只允许在 app);`app/` 改 `App.tsx`(注入目录)、`ParentPanel.tsx`(成就目录)。零迁移、零新列、零服务契约变更(除 `CelebrateLevel` 一个 union 改名)。

**Tech Stack:** React 19 + TS + Vite + Tailwind 4 + motion;canvas-confetti;vitest(jsdom)+ @testing-library/react;oxlint。

**Spec:** `docs/superpowers/specs/2026-09-23-effects-textless-design.md`

## Global Constraints

- **不变量(§2)**:孩子面上不许出现「要读懂才能玩、或要读懂才明白刚才发生了什么」的文字。两类除外:① 教学内容 —— 关卡答案行的 `level.read`(同音汉字);② `aria-label` 等无障碍属性(不进 `textContent`、不进视觉)。
- **红线**:`wrangler` 命令一律显式 `--config wrangler.toml`;禁止 `[env.production]`;禁截图 / 读图检查 UI。本计划**不含**任何部署、push、tag、迁移动作。
- **还原注入**:任何变异验证必须用 `/tmp` 快照 → `cp` 回 → `md5sum -c`。**禁止 `git checkout -- <file>` / `git restore`** 任何有未提交改动的文件(本仓已有实现者据此回滚掉自己未提交改动的先例)。
- **不写依赖 HEAD / 提交数 / 文件数 / 用例数的数字**;删掉任何 `TODO` / `TBD` / 「类似 Task N」式占位。
- **每条新断言都要能被一次具名注入弄红**,注入配方**先跑、后印** —— 打印出来的数字必须与实现者自己跑出来的一致。
- **改用户可见行为 ⇒ 同一个提交里更新 `docs/walkthrough.md`**:Task 2 / 3 / 4 / 5 / 6 / 7 **各自**在自己的提交里带上它那一条(它们各自都改了文案 / 布局 / 动画)。**不要**把分区条目攒到 Task 8 —— Task 8 只收跨面的 `W-C9`、条目计数、两条诚实缺口、`W-C5` 加注与 PLAN 收口。
- **本计划里的行号是写计划那一刻的快照** —— 一律**以引用的原文/符号名为准**定位;原文找不到就报告,不要按行号硬改。这正是「派发本身是易腐位」。
- **边界纪律**:`features/<f>/` 之间禁编译期互引;`useService()` 只在 `features/<f>/<Name>Entry.tsx` 与 `app/`;注册只在 `app/bootstrap.ts`。测试文件不受此边界管辖(`architecture.test.ts` 跳过 `.test.` 文件)。
- **收尾必跑**:`npm test` 全绿;`npm run lint` 与基线**逐条一致** —— 基线恰好 2 条 warning(`src/shared/ui/import-alias.test.ts:5:51`、`src/shared/ui/button.tsx:46:18`),不多不少。
- **提交信息**:结尾带 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。

---

### Task 1: 共享汉字正则 + 答案行钩子 + 关卡页唯一汉字守卫

**Files:**
- Create: `src/shared/testing/han-text.ts`
- Create: `src/features/pinyin-blocks/PinyinBlocksGame.test.tsx`(追加用例,文件已存在)
- Modify: `src/features/pinyin-blocks/UnitMap.test.tsx:9-18`(删本地正则,改 import)
- Modify: `src/app/App.test.tsx:165`(改用同一份正则)
- Modify: `src/features/pinyin-blocks/PinyinBlocksGame.tsx:491`(加 `data-answer-read`)

**Interfaces:**
- Produces: `HAN_TEXT: RegExp`(`@/shared/testing/han-text`)—— Task 2、Task 3 的新测试都用它。**没有 `g` 标志**。
- Produces: `level.read` 那个 `span` 上的 `data-answer-read` 属性。

**背景(实现者必读):** 全仓今天有**两份**互不相同的中文扫描正则:
- `src/features/pinyin-blocks/UnitMap.test.tsx:18` 的 `HAN_TEXT`(覆盖 Han script + CJK 标点 + 全角 + 部首/笔画,带长注释);
- `src/app/App.test.tsx:165` 的 `/[一-鿿]/`(**只有基本区** —— 中文标点、扩展 A、全角一律漏过)。

本任务把前者抽成唯一一份,后者改用它。**不要**沿用 spec §5.1① 里写的 `/[一-鿿]/`:那是一份更弱的口径,而更强的口径已经在仓库里了。

- [ ] **Step 1: 建共享正则文件**

创建 `src/shared/testing/han-text.ts`:

```ts
/**
 * 「孩子读不出的文字」扫描用的正则 —— 全仓唯一一份。
 *
 * 要拦的是**读不出的汉字文本**,不只是 CJK 基本区:只写 [一-鿿](= U+4E00–9FFF)时,
 * 中文标点「，。」、扩展 A「㐀」、全角「Ａ」、兼容表意整类漏过。逐段对应:
 *   \p{Script=Han}  → 基本区 + 扩展 A–H + 兼容表意(繁体「單」同区,一并拦,且无需枚举扩展区码位)
 *   U+3000–303F     → CJK 标点(。「」)
 *   U+FF00–FFEF     → 全角/半角形式(Ａ，ａ)
 *   U+2E80–2EFF / U+31C0–31EF → CJK 部首 / 笔画
 * ★(U+2605)、🔒(U+1F512)、⭐(U+2B50)、🍀(U+1F340) 刻意落在所有区间之外 ——
 * 它们是形状语义,不是文字。
 *
 * **故意不带 `g` 标志**:带 `g` 的 RegExp 有 lastIndex 状态,同一个实例上连续 `.test()`
 * 会交替返回真假 —— 那种红是噪声,会把「红在哪」搅乱。
 *
 * 为什么落在 shared/:features 之间禁编译期互引,而 features/* 与 app/* 的测试都要用它 ——
 * shared 是唯一两侧都够得着、且自身没有上层依赖的一层。
 */
export const HAN_TEXT = /[\p{Script=Han}\u3000-\u303f\uff00-\uffef\u{2e80}-\u{2eff}\u{31c0}-\u{31ef}]/u
```

> **逐字节要求**:这一行必须与 `src/features/pinyin-blocks/UnitMap.test.tsx` 第 18 行**完全相同** —— 区间一律用 `\uXXXX` / `\u{XXXXX}` 转义,**不要**写成裸字符。`U+FF00` / `U+FFEF` 那类码位不可打印,裸写进源码会被编辑器或 Unicode 规范化悄悄改掉,而正则照样「看起来对」。

- [ ] **Step 2: 跑一遍确认没打破任何东西**

Run: `npm test`
Expected: 全绿(新文件还没被引用)。

- [ ] **Step 3: UnitMap.test.tsx 改用共享正则**

把 `src/features/pinyin-blocks/UnitMap.test.tsx` 的第 9–18 行(那段 `/** ... */` 注释 + `const HAN_TEXT = ...`)整段删掉,替换成:

```ts
// 零文本扫描用的正则与它拦什么,统一在 @/shared/testing/han-text(全仓唯一一份)。
```

并在 import 区(`import { cn } from '@/shared/ui/utils'` 之后)加一行:

```ts
import { HAN_TEXT } from '@/shared/testing/han-text'
```

- [ ] **Step 4: App.test.tsx 改用共享正则**

在 `src/app/App.test.tsx` 的 import 区加:

```ts
import { HAN_TEXT } from '@/shared/testing/han-text'
```

把第 165 行的

```ts
    expect(text).not.toMatch(/[一-鿿]/)
```

改成:

```ts
    expect(text).not.toMatch(HAN_TEXT)
```

- [ ] **Step 5: 跑一遍确认两条地图扫描仍绿**

Run: `npm test -- src/app/App.test.tsx src/features/pinyin-blocks/UnitMap.test.tsx`
Expected: 全绿。

**若红**:说明地图上真出现了 CJK 标点 / 全角字符 / 扩展区汉字 —— **先报告是什么字符、在哪个元素里**,不要为了绿而退回 `/[一-鿿]/`。

- [ ] **Step 6: 给答案行的汉字加钩子**

`src/features/pinyin-blocks/PinyinBlocksGame.tsx:491`,把

```tsx
            <span className="text-3xl font-extrabold text-ink">{level.read}</span>
```

改成

```tsx
            <span data-answer-read className="text-3xl font-extrabold text-ink">{level.read}</span>
```

- [ ] **Step 7: 写守卫断言(先写、先看它绿)**

在 `src/features/pinyin-blocks/PinyinBlocksGame.test.tsx` 里,`describe('拼音积木 · 游戏', ...)` 内部追加(放在已有的「拼对后同时亮出拼音与对应汉字(认读要扣到字上)」用例**之后**):

```tsx
  // 零汉字在**关卡页**是假的 —— 答案行那个同音汉字是教学内容,故意留的(设计 §2)。
  // 所以这里断的不是「零」,而是「唯一 + 等值」:多出来一个汉字就红。
  it('拼对后,直接文本含汉字的元素恰好一个 —— 就是答案行的同音汉字', async () => {
    const { container } = mount(1, 1) // 🐴 mǎ
    solveCorrectly(1, 1)
    expect(await screen.findByText('mǎ')).toBeInTheDocument()

    // 「直接文本」= 该元素**自身的文本子节点**,不含后代 —— 否则整棵树的根节点永远"含汉字",
    // 断言就退化成「页面里有汉字」,等于没写。答案行今天是两个并列 span(拼音 / 汉字),只有后者命中。
    const carriers = [...container.querySelectorAll<HTMLElement>('*')].filter((el) =>
      [...el.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && HAN_TEXT.test(node.textContent ?? '')),
    )
    expect(carriers.map((el) => el.textContent)).toEqual([UNITS[1]!.levels[1]!.read])
    expect(carriers[0]?.hasAttribute('data-answer-read'), '命中汉字的那个元素不是答案行').toBe(true)
  })
```

在该文件的 import 区加:

```ts
import { HAN_TEXT } from '@/shared/testing/han-text'
```

- [ ] **Step 8: 跑这条用例**

Run: `npm test -- src/features/pinyin-blocks/PinyinBlocksGame.test.tsx`
Expected: PASS。

**若红在数量上**(`carriers` 不止一个):**先报告多出来的是哪些元素、各自文本是什么**,不要放宽断言 —— 多出来的汉字要么是该删的,要么是设计漏掉的第二处教学内容。

- [ ] **Step 9: 反例验证(先跑、后印)**

用 `/tmp` 快照法做一次具名注入并还原:

```bash
cp src/features/pinyin-blocks/PinyinBlocksGame.tsx /tmp/pbg.bak
md5sum src/features/pinyin-blocks/PinyinBlocksGame.tsx /tmp/pbg.bak
```

注入:把 `:491` 那行改成渲染两个汉字元素(在答案行里再插一个 `<span>测试</span>`),跑 Step 8 的命令,记下**红在哪一句**(应是 `carriers.map(...)` 那条)。然后:

```bash
cp /tmp/pbg.bak src/features/pinyin-blocks/PinyinBlocksGame.tsx
md5sum -c <(md5sum /tmp/pbg.bak | sed 's#/tmp/pbg.bak#src/features/pinyin-blocks/PinyinBlocksGame.tsx#')
```

还原后再跑一次 Step 8,必须回到 PASS。**注入配方与报出的数字只在本步跑完之后才写进报告。**

- [ ] **Step 10: 提交**

```bash
git add src/shared/testing/han-text.ts \
  src/features/pinyin-blocks/UnitMap.test.tsx \
  src/features/pinyin-blocks/PinyinBlocksGame.tsx \
  src/features/pinyin-blocks/PinyinBlocksGame.test.tsx \
  src/app/App.test.tsx
git commit -m "test(guards): 汉字扫描正则收成全仓唯一一份 + 关卡页「唯一汉字」断言

- shared/testing/han-text.ts:HAN_TEXT 抽出,UnitMap.test 与 App.test 改用它
  (App.test 原来那份 /[一-鿿]/ 只有基本区,中文标点/扩展 A/全角一律漏过)
- PinyinBlocksGame 答案行加 data-answer-read;新增「直接文本含汉字的元素恰好一个」用例

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 2: 奖励弹层共享外壳 + 成就弹层去字

**Files:**
- Create: `src/shared/ui/reward-card.ts`
- Create: `src/features/achievements/AchievementPopup.test.tsx`
- Modify: `src/features/achievements/AchievementPopup.tsx:30-34`

**Interfaces:**
- Consumes: `HAN_TEXT`(@/shared/testing/han-text,Task 1)
- Produces: `REWARD_CARD: string`(`@/shared/ui/reward-card`)—— Task 3 的 `LuckyBonus` 用同一份。
- Produces: 成就/幸运两个弹层的卡片上都带 `data-reward-card` 属性(测试锚点)。

- [ ] **Step 1: 建共享外壳类**

创建 `src/shared/ui/reward-card.ts`:

```ts
/**
 * 奖励弹层(成就 / 幸运)卡片的**共享几何** —— 两个弹层必须同一份。
 *
 * 为什么共享而不是各写一遍:去掉几行文字后卡片会缩,两处缩得不一样就会出现
 * 「撒花落点一致、卡片却跳变」,比改造前更晃眼(设计 §3.1 末条)。
 *
 * `min-h-[13.5rem]`(216px)≈ 改造前四行文字时的高度
 * (emoji 48 + 12+28 + 28 + 4+20 + 8+20 + p-6 的 48 + 描边 2 ≈ 218)。
 * 取的意图是「文字消失,卡片不变形」,不是精确复刻 —— 两个弹层高度一致由**共用这一份**保证,
 * 不由这个数值保证;数值本身好不好看由走查 `W-S3` 兜人眼。
 *
 * 描边颜色与底色由调用方补(`cn(REWARD_CARD, 'border-hairline bg-surface')`):
 * `border`(宽度)与 `border-hairline`(颜色)在 tailwind-merge 里是两组,不会互相删掉。
 */
export const REWARD_CARD =
  'flex w-full max-w-xs min-h-[13.5rem] flex-col items-center justify-center rounded-[2rem] border p-6 text-center shadow-pop'
```

- [ ] **Step 2: 写成就弹层的失败测试**

创建 `src/features/achievements/AchievementPopup.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { ACHIEVEMENTS } from './achievements'
import { AchievementPopup } from './AchievementPopup'

const perfect = ACHIEVEMENTS.find((a) => a.id === 'perfect_level')!

describe('成就弹层', () => {
  afterEach(cleanup)

  // 4-8 岁读不出「解锁成就」,也不需要读它 —— 图标已经说明这是什么(设计 §3.1)。
  it('孩子面零汉字:只有图标与 +N ⭐', () => {
    const { container } = render(<AchievementPopup list={[perfect]} onDone={vi.fn()} />)
    // 先断言锚点:取不到时下面的断言会对着空白容器恒绿。
    expect(container.querySelector('[data-reward-card]'), '缺少 data-reward-card 锚点').not.toBeNull()
    expect(container.textContent ?? '').not.toMatch(HAN_TEXT)
    expect(screen.getByText(`+${perfect.reward} ⭐`)).toBeInTheDocument()
  })

  it('拿到成就时请求 achievement 档撒花', () => {
    const celebrate = vi.fn()
    render(<AchievementPopup list={[perfect]} onDone={vi.fn()} celebrate={celebrate} />)
    expect(celebrate).toHaveBeenCalledWith('achievement')
  })
})
```

- [ ] **Step 3: 跑,确认零汉字那条红**

Run: `npm test -- src/features/achievements/AchievementPopup.test.tsx`
Expected: 「孩子面零汉字」FAIL(`container.querySelector('[data-reward-card]')` 为 null);「撒花」PASS。

- [ ] **Step 4: 改成就弹层**

`src/features/achievements/AchievementPopup.tsx`,把 import 区改成:

```tsx
import { useEffect } from 'react'
import { motion } from 'motion/react'
import type { Achievement, CelebrateLevel } from '@/shared/services'
import { REWARD_CARD } from '@/shared/ui/reward-card'
import { cn } from '@/shared/ui/utils'
```

把 `:27` 的 className 与 `:30-34` 的内容行改成:

```tsx
        data-reward-card
        className={cn(REWARD_CARD, 'border-hairline bg-surface')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl" aria-hidden>{a.emoji}</div>
        <p className="mt-3 text-lg font-extrabold text-emerald">+{a.reward} ⭐</p>
      </motion.div>
```

`name` / `description` 两个字段**不动契约、不再上孩子面** —— 它们搬去家长面板(Task 7)。

- [ ] **Step 5: 跑,确认两条都绿**

Run: `npm test -- src/features/achievements/AchievementPopup.test.tsx src/app/App.test.tsx`
Expected: PASS。

- [ ] **Step 6: 反例验证**

```bash
cp src/features/achievements/AchievementPopup.tsx /tmp/ap.bak
```

注入:把那行 `+{a.reward} ⭐` 改回 `<p className="mt-3 text-lg font-extrabold text-accent">解锁成就</p>`,跑 Step 5 的命令,记下红在哪一句(应是 `not.toMatch(HAN_TEXT)`)。还原:

```bash
cp /tmp/ap.bak src/features/achievements/AchievementPopup.tsx
md5sum -c <(md5sum /tmp/ap.bak | sed 's#/tmp/ap.bak#src/features/achievements/AchievementPopup.tsx#')
```

再跑一次 Step 5,回到 PASS。

- [ ] **Step 7: 同提交更新走查**

在 `docs/walkthrough.md` 的「结算与奖励」表末尾(**按表头文字找,不按行号**)加一行:

```markdown
| **W-S3** 奖励弹层(成就) | 任意设备 | 拿到一次成就 | 弹层里**没有文字**,只有图标 + `+N ⭐` |
```

**这一步不能省**:`CLAUDE.md` 的硬规则 —— 改用户可见行为(这里是文案),`git diff` 里必须同时出现走查文件。Task 3 会把这一行补全(触发条件表里的「改条目」动作)。

- [ ] **Step 8: 提交**

```bash
git add src/shared/ui/reward-card.ts \
  src/features/achievements/AchievementPopup.tsx \
  src/features/achievements/AchievementPopup.test.tsx \
  docs/walkthrough.md
git commit -m "feat(achievements): 成就弹层去字 —— 只剩图标 + 奖励数字,卡片外壳与幸运弹层共用

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 3: 幸运弹层去字(删掉那句没有指称对象的「灵灵」)

**Files:**
- Create: `src/features/lucky-bonus/LuckyBonus.test.tsx`
- Modify: `src/features/lucky-bonus/LuckyBonus.tsx:15,18-21`

**Interfaces:**
- Consumes: `REWARD_CARD`(Task 2)、`HAN_TEXT`(Task 1)
- Produces: 无新符号。

**背景:** `LuckyBonus.tsx:20` 的「灵灵」是**活的假话** —— 苏灵灵已随「拼音积木取代全游戏」整批删除,全仓唯一残留 `lingling` 是 `src/features/speech/speech.ts:9` 登记保留、零生产调用的声纹条目。这句今天没有指称对象。**这条无条件删,不依赖任何裁定。**

- [ ] **Step 1: 写失败测试**

创建 `src/features/lucky-bonus/LuckyBonus.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { HAN_TEXT } from '@/shared/testing/han-text'
import { LuckyBonus } from './LuckyBonus'

describe('幸运奖励弹层', () => {
  afterEach(cleanup)

  // 原文案是「好运来了!」+「灵灵在草丛里找到了一颗隐藏星尘!」——
  // 后半句的「灵灵」(苏灵灵)已随「拼音积木取代全游戏」整批删除,那句今天没有指称对象。
  it('孩子面零汉字:只有 🍀 与 +N ⭐', () => {
    const { container } = render(<LuckyBonus amount={50} onDone={vi.fn()} />)
    expect(container.querySelector('[data-reward-card]'), '缺少 data-reward-card 锚点').not.toBeNull()
    expect(container.textContent ?? '').not.toMatch(HAN_TEXT)
    expect(screen.getByText('+50 ⭐')).toBeInTheDocument()
  })

  it('数字走 amount,不写死', () => {
    render(<LuckyBonus amount={20} onDone={vi.fn()} />)
    expect(screen.getByText('+20 ⭐')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: 跑,确认红**

Run: `npm test -- src/features/lucky-bonus/LuckyBonus.test.tsx`
Expected: 两条都 FAIL(锚点缺失 / 找不到 `+50 ⭐`)。

- [ ] **Step 3: 改幸运弹层**

`src/features/lucky-bonus/LuckyBonus.tsx`,import 区加:

```tsx
import { REWARD_CARD } from '@/shared/ui/reward-card'
import { cn } from '@/shared/ui/utils'
```

把 `:15` 的 className 与 `:18-21` 的内容行改成:

```tsx
        data-reward-card
        className={cn(REWARD_CARD, 'border-amber/50 bg-amber-100')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-5xl" aria-hidden>🍀</div>
        <p className="mt-3 text-lg font-extrabold text-amber">+{amount} ⭐</p>
      </motion.div>
```

- [ ] **Step 4: 跑,确认两条都绿**

Run: `npm test -- src/features/lucky-bonus/LuckyBonus.test.tsx src/app/App.test.tsx`
Expected: PASS。

- [ ] **Step 5: 反例验证**

```bash
cp src/features/lucky-bonus/LuckyBonus.tsx /tmp/lb.bak
```

注入:把 `+{amount} ⭐` 那行后面加回 `<p className="mt-1 text-sm text-ink-2">灵灵在草丛里找到了一颗隐藏星尘!</p>`,跑 Step 4 的命令,记下红在哪一句。还原:

```bash
cp /tmp/lb.bak src/features/lucky-bonus/LuckyBonus.tsx
md5sum -c <(md5sum /tmp/lb.bak | sed 's#/tmp/lb.bak#src/features/lucky-bonus/LuckyBonus.tsx#')
```

- [ ] **Step 6: 确认全仓再没有给孩子看的「灵灵」**

Run: `grep -rn "灵灵" src/`
Expected: **零命中**。若还有命中,逐个报告它是不是成人面(家长面板 / toast)的文案 —— 是就留着并说明,不是就删。

- [ ] **Step 7: 同提交把 W-S3 补全**

把 `docs/walkthrough.md`「结算与奖励」表里 Task 2 新增的 `W-S3` 那一行**整行替换**成:

```markdown
| **W-S3** 奖励弹层 | 任意设备 | 拿到一次成就;再拿到一次幸运奖励 | 弹层里**没有文字**,只有图标 + `+N ⭐`;**两个弹层卡片高度一致**(切换时不跳) |
```

- [ ] **Step 8: 提交**

```bash
git add src/features/lucky-bonus/LuckyBonus.tsx src/features/lucky-bonus/LuckyBonus.test.tsx docs/walkthrough.md
git commit -m "feat(lucky-bonus): 幸运弹层去字 —— 只剩 🍀 与 +N ⭐;删除指称对象已不存在的「灵灵」句

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 4: `CelebrateLevel` 改名 `step`→`combo5` + 四档全接线

**Files:**
- Modify: `src/shared/services/celebrate.ts`(改名 + 新增纯函数 `celebrationFor`)
- Modify: `src/shared/services/index.ts:14-15`(补导出)
- Modify: `src/features/celebrate/celebrate.ts:6-11`
- Modify: `src/features/celebrate/index.ts`(删死函数)
- Modify: `src/features/celebrate/celebrate.test.ts`
- Modify: `src/features/pinyin-blocks/LevelEntry.tsx`
- Create: `src/features/pinyin-blocks/LevelEntry.test.tsx`

**Interfaces:**
- Produces: `CelebrateLevel = 'combo5' | 'word' | 'combo10' | 'achievement'`
- Produces: `celebrationFor(combo: number): CelebrateLevel | null`(`@/shared/services`)—— 连击数 → 撒花档,5 → `'combo5'`、10 → `'combo10'`、其余 `null`。
- Produces: `LevelEntry` 内部 `celebrate` 变量 = `useService(CelebrateService)`,三个触发点:`combo5` / `combo10`(来自 `celebrationFor(combo.answer(kind))`)、`word`(一关拼成且**没有**奖励弹层接手)。

**为什么 `celebrationFor` 落 `shared/` 而不是 `features/combo/`(裁定):** `LevelEntry` 在 `features/pinyin-blocks/`,引 `features/combo/` 就是**跨 feature 编译期互引** —— `src/architecture.test.ts` 当场红。落 `shared/services/celebrate.ts` 则两侧都够得着,且它本来就是 `CelebrateLevel` 这个契约自己的纯映射。**代价**:档位阈值离家(combo)有点远;若判错,搬回去要同时破一次边界规则,不是一行的事。

**关于 spec §5.1③:** 原计划写「断言 `CONFIGS` 的键集 === `CelebrateLevel` 的值集」。**该断言不写** —— `Record<CelebrateLevel, confetti.Options>` 已经由编译器保证键集完整(少键 / 多键都是 TS 错误),再写一条测试就是「字面为真而承诺为假」(本仓病根)。真正的洞是**有档没人调**,由下面的纯函数用例 + Task 2 的 `achievement` 用例 + `word` 用例覆盖 = 四档各有行为覆盖。

**为什么把阈值抽成纯函数:** 不抽的话,「连到第 10 块」要在一局只有两三个槽的关卡里驱动十次落块 —— 要么驱动不出来,要么测的其实是关卡长度。抽出来之后 `LevelEntry` 那一侧只要一次落块就能证「返回值真的被接线了」。

- [ ] **Step 1: 写失败测试(先建 harness)**

创建 `src/features/pinyin-blocks/LevelEntry.test.tsx`:

```tsx
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AchievementService,
  AudioService,
  CelebrateService,
  ComboService,
  LuckyBonusService,
  PinyinProgressService,
  SettingsService,
  SpeechService,
  type AnswerKind,
  type Achievement,
} from '@/shared/services'
import { registry } from '@/shared/services/core'
import { UNITS } from './levels'
import { canPlace, slotsFor } from './rules'
import { SPEAK_OF, type Block, type BlockType } from './blocks'
import { LevelEntry } from './LevelEntry'

/** 稳定引用的可发布快照 —— useSyncExternalStore 要求 getSnapshot 返回稳定引用。 */
function makeStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    set(next: T) {
      value = next
      listeners.forEach((listener) => listener())
    },
  }
}

/** 只登记 LevelEntry 真正取用的服务 —— 未注册的服务会当场抛错,那本身也是断言。 */
function mountLevelEntry(opts: {
  comboAnswers?: number[]
  earned?: readonly Achievement[]
  luckyReward?: number
} = {}) {
  registry.clear()

  const progressStore = makeStore({ status: 'ready' as const, data: { stars: {}, totalStars: 0 } })
  const progress = {
    getSnapshot: progressStore.get,
    subscribe: progressStore.subscribe,
    load: vi.fn(async () => undefined),
    recordClear: vi.fn(async () => undefined),
    resetAll: vi.fn(async () => undefined),
  }

  const settingsStore = makeStore({
    status: 'ready' as const,
    data: { earnedAchievements: [], consecutiveDays: 0, lastActiveDate: '', updatedAt: '' },
  })
  const settings = {
    getSnapshot: settingsStore.get,
    subscribe: settingsStore.subscribe,
    load: vi.fn(async () => undefined),
    save: vi.fn(async () => undefined),
  }

  const comboStore = makeStore({ combo: 0, maxCombo: 0 })
  const answers = [...(opts.comboAnswers ?? [])]
  let combo = 0
  const comboService = {
    getSnapshot: comboStore.get,
    subscribe: comboStore.subscribe,
    answer: vi.fn((_kind: AnswerKind) => {
      const scripted = answers.shift()
      combo = scripted ?? 0
      comboStore.set({ combo, maxCombo: Math.max(comboStore.get().maxCombo, combo) })
      return combo
    }),
    reset: vi.fn(),
    getBonus: vi.fn(() => 0),
  }

  const celebrate = { play: vi.fn() }
  const achievements = { scan: vi.fn(() => [...(opts.earned ?? [])]) }
  const lucky = { roll: vi.fn(() => opts.luckyReward ?? 0) }

  registry.register(PinyinProgressService, progress as never)
  registry.register(SettingsService, settings as never)
  registry.register(ComboService, comboService as never)
  registry.register(CelebrateService, celebrate as never)
  registry.register(AchievementService, achievements as never)
  registry.register(LuckyBonusService, lucky as never)
  registry.register(SpeechService, { speak: () => true, speakRole: () => true, stop: () => undefined } as never)
  registry.register(AudioService, {
    getSnapshot: () => true,
    subscribe: () => () => {},
    isOn: () => true,
    setOn: () => {},
    play: vi.fn(),
    unlock: () => undefined,
  } as never)

  const onSettle = vi.fn()
  const utils = render(<LevelEntry unitIndex={0} onExitToMap={vi.fn()} onSettle={onSettle} />)
  return { ...utils, celebrate, comboService, comboStore, onSettle }
}

/** 托盘里还没入槽的块。 */
function trayBlocks(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).filter(
    (el) => el.closest('[data-slot-id]') === null,
  )
}

/** 读一块托盘积木的身份 —— 类型与值印在里层的 .pblock 上。 */
function blockOf(el: HTMLElement): Block {
  const chip = el.querySelector<HTMLElement>('[data-value]')
  const type = chip?.dataset.type as BlockType | undefined
  const value = chip?.dataset.value
  if (!type || !(type in SPEAK_OF) || value === undefined) {
    throw new Error(`托盘块读不出身份:${chip?.outerHTML ?? '(没有块)'}`)
  }
  return { type, value }
}

/** 按题目要求把正确块一个个点进去(点选路径 = 自动落位),一次不错。 */
function solveCorrectly() {
  for (const slot of slotsFor(UNITS[0]!.levels[0]!)) {
    const fits = trayBlocks().filter((el) => canPlace(blockOf(el), slot))
    const pick = fits.find((el) => blockOf(el).type === slot.type) ?? fits[0]
    expect(pick, `${slot.type}:${slot.value} 在托盘里找不到可放块`).toBeDefined()
    fireEvent.keyDown(pick as HTMLElement, { key: 'Enter' })
  }
}

/** 通关回调在成功动画**之后**才发(260ms 判定 + 1600ms 停顿)—— 推时钟并把微任务排干。 */
async function settle() {
  await act(async () => {
    vi.advanceTimersByTime(3000)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  // jsdom 没实现 document.elementFromPoint(真实浏览器都有),拖拽回调会调它。
  Object.defineProperty(document, 'elementFromPoint', { value: () => null, configurable: true })
})

afterEach(() => {
  cleanup()
  registry.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.querySelectorAll('.pblock--dragging').forEach((el) => el.remove())
})

/** 放一块**放得下**的块(点选路径 = 自动落位)—— 每次落块都会走一次 onBlock。 */
function placeOneFitting() {
  for (const slot of slotsFor(UNITS[0]!.levels[0]!)) {
    const pick = trayBlocks().find((el) => canPlace(blockOf(el), slot))
    if (pick) {
      fireEvent.keyDown(pick, { key: 'Enter' })
      return
    }
  }
  throw new Error('托盘里没有放得下的块,落块用例无法推进')
}

describe('关卡页 · 撒花接线', () => {
  // 只落一块:阈值判定在 celebrationFor(纯函数,用例在 celebrate.test.ts),
  // 这里证的是「combo.answer() 的返回值真的被接线了」—— 此前它被直接丢弃。
  it('落一块后 combo 返 5 → combo5 档撒花', () => {
    const { celebrate } = mountLevelEntry({ comboAnswers: [5] })
    placeOneFitting()
    expect(celebrate.play).toHaveBeenCalledWith('combo5')
    expect(celebrate.play).not.toHaveBeenCalledWith('combo10')
  })

  it('落一块后 combo 返 10 → combo10 档撒花', () => {
    const { celebrate } = mountLevelEntry({ comboAnswers: [10] })
    placeOneFitting()
    expect(celebrate.play).toHaveBeenCalledWith('combo10')
  })

  it('落一块后 combo 返 3 → 不撒花(不是每个数都撒)', () => {
    const { celebrate } = mountLevelEntry({ comboAnswers: [3] })
    placeOneFitting()
    expect(celebrate.play).not.toHaveBeenCalled()
  })

  it('一关拼成且没有奖励弹层接手 → word 档撒花', async () => {
    const { celebrate, onSettle } = mountLevelEntry()
    solveCorrectly()
    await settle()
    expect(onSettle).toHaveBeenCalled()
    expect(celebrate.play).toHaveBeenCalledWith('word')
  })

  it('有成就接手时 word 档不撒 —— 一次成功只撒一次花', async () => {
    const { celebrate, onSettle } = mountLevelEntry({
      earned: [{ id: 'perfect_level', name: '完美主义', description: 'x', emoji: '💎', reward: 50 }],
    })
    solveCorrectly()
    await settle()
    expect(onSettle).toHaveBeenCalled()
    expect(celebrate.play).not.toHaveBeenCalledWith('word')
  })

  it('有幸运奖励接手时 word 档不撒', async () => {
    const { celebrate, onSettle } = mountLevelEntry({ luckyReward: 50 })
    solveCorrectly()
    await settle()
    expect(onSettle).toHaveBeenCalled()
    expect(celebrate.play).not.toHaveBeenCalledWith('word')
  })
})
```

- [ ] **Step 2: 跑,确认全红**

Run: `npm test -- src/features/pinyin-blocks/LevelEntry.test.tsx`
Expected: 全部 FAIL(`play('combo5')` / `play('word')` 从没被调用;`CelebrateService` 甚至还没被 `LevelEntry` 取用)。

- [ ] **Step 3: 改 union 并新增纯函数**

`src/shared/services/celebrate.ts` 整体改成:

```ts
import type { ServiceToken } from './core'

export type CelebrateLevel = 'combo5' | 'word' | 'combo10' | 'achievement'

/**
 * 连击数 → 撒花档。**只有 5 与 10 两档**,其余返回 `null`(不撒)。
 *
 * 15 连走的是成就 `combo_15`(由 `achievement` 档撒花),**故意不设第三档** ——
 * 三个连击档对孩子只是噪声(设计 §3.3 的表)。
 *
 * 放在 shared 而不是 features/combo:`LevelEntry` 在 features/pinyin-blocks,
 * 引 features/combo 就是跨 feature 编译期互引(architecture.test.ts 守的边界)。
 */
export function celebrationFor(combo: number): CelebrateLevel | null {
  if (combo === 5) return 'combo5'
  if (combo === 10) return 'combo10'
  return null
}

export interface CelebrateService {
  play(level: CelebrateLevel): void
}

export const CelebrateService = Symbol('CelebrateService') as unknown as ServiceToken<CelebrateService>
```

`src/shared/services/index.ts:14-15` 改成:

```ts
export type { CelebrateLevel } from './celebrate'
export { CelebrateService, celebrationFor } from './celebrate'
```

- [ ] **Step 4: 改 CONFIGS**

`src/features/celebrate/celebrate.ts:6-11`:

```ts
// 档位即撒花规模。`combo5` 这一档是「放对一块就撒花」的替代 ——
// 一关 15 块 × 30 粒 = 撒 15 次,孩子很快就不看了;单块反馈已有槽位填色 + correct 音效(设计 §3.4)。
const CONFIGS: Record<CelebrateLevel, confetti.Options> = {
  combo5: { particleCount: 30, spread: 50 },
  word: { particleCount: 100, spread: 80, origin: { y: 0.6 } },
  combo10: { particleCount: 150, spread: 90 },
  achievement: { particleCount: 200, spread: 120 },
}
```

- [ ] **Step 5: 删死函数**

`src/features/celebrate/index.ts` 整体改成:

```ts
export { createCelebrateService } from './celebrate'
```

理由(写进提交信息):原文件里的 `celebrate(level)` 与它的注释「Compatibility for current lesson/reward components; Tasks 9 and 10 replace it with composition callbacks」都已经过期 —— `grep -rn "from '@/features/celebrate'" src/` 显示只有 `bootstrap.ts` 引 `createCelebrateService`,**这个导出的调用点数 = 0**,替代早就发生了。

- [ ] **Step 6: 改 celebrate.test.ts**

`src/features/celebrate/celebrate.test.ts` 的 import 行加 `celebrationFor`:

```ts
import { celebrationFor } from '@/shared/services'
```

把第 9–19 行改成:

```ts
    service.play('combo5')
    service.play('word')
    service.play('achievement')
    service.play('combo10')

    expect(confetti.mock.calls.map(([options]) => options)).toEqual([
      { particleCount: 30, spread: 50 },
      { particleCount: 100, spread: 80, origin: { y: 0.6 } },
      { particleCount: 200, spread: 120 },
      { particleCount: 150, spread: 90 },
    ])
```

(顺序与上面四个 `play` 调用一一对应 —— 别只改一个字符串名称而对不上位置。)

并在文件末尾追加:

```ts
describe('celebrationFor:连击数 → 撒花档', () => {
  // 逐值穷举 1..16,而不是只点 5 与 10:边界写错成 `>= 5` 时,
  // 只测 5/10 两条断言照样全绿 —— 那时「连到第 6 块」会跟着撒一次花。
  it('只有 5 与 10 命中,其余一律不撒', () => {
    const hit = (n: number) => celebrationFor(n)
    expect([1, 2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16].map(hit)).toEqual(
      Array.from({ length: 14 }, () => null),
    )
    expect(hit(5)).toBe('combo5')
    expect(hit(10)).toBe('combo10')
    expect(hit(0)).toBeNull()
  })
})
```

- [ ] **Step 7: 在 LevelEntry 里接线**

`src/features/pinyin-blocks/LevelEntry.tsx`:

- `@/shared/services` 的具名导入列表加 `CelebrateService`,并把 `celebrationFor` 加进**值**导入(`import { celebrationFor } from '@/shared/services'`);
- 在 `const audio = useService(AudioService)` 之后加 `const celebrate = useService(CelebrateService)`;
- `handleSolved` 里,在 `onSettle(result)` 之后、推进关卡之前插入:

```tsx
      // 一次成功只撒一次花:有成就 / 幸运弹层接手时由它们那一档撒,
      // 两处同帧叠加 = 300 粒,反而把「发生了什么」糊掉(设计 §3.4)。
      if (result.achievements.length === 0 && result.luckyReward <= 0) celebrate.play('word')
```

并把 `celebrate` 加进 `handleSolved` 的依赖数组;

- `handleBlock` 改成:

```tsx
  // 连击的落点:每放一块上报一次。放对 'first'、放错 'wrong'。
  // answer() 的返回值此前被丢弃 —— 撒花档就挂在它上面(阈值判定在 celebrationFor)。
  const handleBlock = useCallback(
    (kind: AnswerKind) => {
      const tier = celebrationFor(combo.answer(kind))
      if (tier) celebrate.play(tier)
    },
    [combo, celebrate],
  )
```

- [ ] **Step 8: 跑,确认全绿**

Run: `npm test -- src/features/pinyin-blocks/LevelEntry.test.tsx src/features/celebrate/celebrate.test.ts src/features/achievements/AchievementPopup.test.tsx`
Expected: PASS。

- [ ] **Step 9: 全仓搜残留的 `'step'` 档名**

Run: `grep -rn "'step'" src/ worker/`
Expected: 零命中。有命中就改掉(它是这次改名的漏网点)。

- [ ] **Step 10: 反例验证**

```bash
cp src/features/pinyin-blocks/LevelEntry.tsx /tmp/le.bak
```

注入 A:把 `const tier = celebrationFor(combo.answer(kind))` 改回 `combo.answer(kind); const tier = null`(即恢复「返回值被丢弃」)→ 「落一块后 combo 返 5」必须红。
还原(同上 md5 法),再注入 B:把 `if (result.achievements.length === 0 && result.luckyReward <= 0)` 整条删掉 → 「有成就接手时 word 档不撒」必须红。
还原后,再对 `src/shared/services/celebrate.ts` 做一次注入:把 `if (combo === 5)` 改成 `if (combo >= 5)` → `celebrate.test.ts` 的穷举用例必须红(这条同时证明那 14 个 `null` 不是摆设)。还原后再跑一次 Step 8,回到 PASS。

- [ ] **Step 11: 同提交更新走查**

在 `docs/walkthrough.md` 的「关卡与积木盘」表末尾加一行:

```markdown
| **W-L5** 撒花档位 | 任意设备,进任一关 | 连到第 5 块;再连到第 10 块;**单块放对** | 第 5 块出**一次小**撒花;第 10 块出**一次大**撒花;**单块放对不出撒花**(只有槽位填色 + 一声正确音) |
```

- [ ] **Step 12: 提交**

```bash
git add src/shared/services/celebrate.ts src/shared/services/index.ts src/features/celebrate/ \
  src/features/pinyin-blocks/LevelEntry.tsx src/features/pinyin-blocks/LevelEntry.test.tsx \
  docs/walkthrough.md
git commit -m "feat(celebrate): step 档改名 combo5 + 四档全接线;删掉零调用点的 celebrate() 死导出

- CelebrateLevel: step → combo5(旧名承诺的行为已不存在)
- 新增 shared 纯函数 celebrationFor(连击数 → 档),阈值收敛到一处并穷举用例钉住
- combo.answer() 的返回值此前被丢弃,现在接上 combo5/combo10;word 接 handleSolved,
  且只在没有成就/幸运弹层接手时撒 —— 一次成功只撒一次花

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 5: 关内连击圆点

**Files:**
- Modify: `src/features/pinyin-blocks/LevelEntry.tsx:84-96`
- Modify: `src/features/pinyin-blocks/LevelEntry.test.tsx`(追加用例)

**Interfaces:**
- Consumes: Task 4 建立的 `LevelEntry` 测试 harness(`mountLevelEntry` 已带 `comboStore`)。
- Produces: 头部行里的 `<span data-combo-dots data-combo-lit={n}>`,n ∈ [0,5]。

**口径(裁定,可推翻):** 圆点显示**会话连击**,不是「本关连击」—— `combo` 服务本身就是会话级(`sessionStorage`,跨关不清零),成就 `combo_15` 也是这个口径。再造一个「本关连击」= 第二个概念,两处口径迟早打架。代价若判错:孩子会看到「这一关才放 3 块却亮 7 颗」;要改得给 `combo` 服务加关卡边界重置,那会**同时改掉 `combo_15` 的口径**,不是一行的事。

- [ ] **Step 1: 追加失败测试**

在 `src/features/pinyin-blocks/LevelEntry.test.tsx` 的 `describe('关卡页 · 撒花接线', ...)` 之后追加:

```tsx
describe('关卡页 · 连击圆点', () => {
  const litCount = () => document.querySelectorAll('[data-combo-dots] .bg-accent').length
  const announced = () =>
    Number(document.querySelector<HTMLElement>('[data-combo-dots]')?.dataset.comboLit)

  it('会话连击 0 → 一颗不亮', () => {
    mountLevelEntry()
    expect(announced()).toBe(0)
    expect(litCount()).toBe(0)
  })

  it('会话连击 3 → 亮 3 颗', () => {
    const { comboStore } = mountLevelEntry()
    act(() => comboStore.set({ combo: 3, maxCombo: 3 }))
    expect(announced()).toBe(3)
    expect(litCount()).toBe(3)
  })

  it('会话连击 7 → 封顶 5 颗', () => {
    const { comboStore } = mountLevelEntry()
    act(() => comboStore.set({ combo: 7, maxCombo: 7 }))
    expect(announced()).toBe(5)
    expect(litCount()).toBe(5)
  })

  // 断的是**填色**这一态,不写动画:App.tsx 的 MotionConfig reducedMotion="user" 全局生效,
  // 纯动画表达对减动效用户等于不存在。
  it('答错归零 → 全部熄灭(填色态跟着快照走)', () => {
    const { comboStore } = mountLevelEntry()
    act(() => comboStore.set({ combo: 4, maxCombo: 4 }))
    expect(litCount()).toBe(4)
    act(() => comboStore.set({ combo: 0, maxCombo: 4 }))
    expect(litCount()).toBe(0)
  })
})
```

- [ ] **Step 2: 跑,确认红**

Run: `npm test -- src/features/pinyin-blocks/LevelEntry.test.tsx`
Expected: 四条新用例全部 FAIL(`data-combo-dots` 还不存在,`announced()` 是 `NaN`)。

- [ ] **Step 3: 实现圆点**

`src/features/pinyin-blocks/LevelEntry.tsx`:

import 区加 `import { cn } from '@/shared/ui/utils'`;

在文件顶部常量区加:

```tsx
/** 连击圆点:5 颗封顶 —— 再多也读不出来,而 5 正好对上第一个撒花档。 */
const COMBO_DOTS = [0, 1, 2, 3, 4] as const
```

在 `const combo = useService(ComboService)` 之后加订阅(今天 `combo` 只被命令式读一次,`LevelEntry.tsx:63`):

```tsx
  const comboSnap = useServiceSnapshot(combo)
```

在 return 里算出点亮数(组件体,`unit` 声明之后):

```tsx
  const comboLit = Math.min(comboSnap.data.combo, COMBO_DOTS.length)
```

把头部那一行改成:

```tsx
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onExitToMap}
          aria-label="回地图"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/70 text-ink-2"
        >
          ←
        </button>
        <span className="flex items-center gap-2">
          {/* 连击圆点:会话连击(见 spec §3.3 的裁定),封顶 5 颗。
              靠「亮/暗」两态表达,脉冲只作增强 —— 减动效用户也必须看得见。 */}
          <span
            data-combo-dots
            data-combo-lit={comboLit}
            aria-label={`连击 ${comboLit}`}
            className="flex items-center gap-1"
          >
            {COMBO_DOTS.map((index) => (
              <span
                key={index}
                aria-hidden
                className={cn('h-2.5 w-2.5 rounded-full', index < comboLit ? 'bg-accent' : 'bg-hairline')}
              />
            ))}
          </span>
          <span className="text-sm font-bold text-ink-3 tabular-nums">
            {levelIndex + 1}/{unit.levels.length}
          </span>
        </span>
      </div>
```

- [ ] **Step 4: 跑,确认全绿**

Run: `npm test -- src/features/pinyin-blocks/LevelEntry.test.tsx src/app/App.test.tsx`
Expected: PASS。

- [ ] **Step 5: 反例验证**

```bash
cp src/features/pinyin-blocks/LevelEntry.tsx /tmp/le2.bak
```

注入 A:`Math.min(comboSnap.data.combo, COMBO_DOTS.length)` 改成 `comboSnap.data.combo` → 「封顶 5 颗」必须红。
还原;注入 B:`index < comboLit ? 'bg-accent' : 'bg-hairline'` 改成恒 `'bg-hairline'` → 「亮 3 颗」必须红(且这条注入证明 `litCount()` 量的确实是填色,不是别的类)。
还原后再跑 Step 4,回到 PASS。

- [ ] **Step 6: 同提交更新走查**

在 `docs/walkthrough.md` 的「关卡与积木盘」表里,把这一行插在 Task 4 加的 `W-L5` **之前**(行序跟编号走):

```markdown
| **W-L4** 连击圆点 | 任意设备,进任一关 | 连续放对第 1…5 块 | 右上角圆点**逐颗点亮**;**第 6 块故意放错 → 全部归零**(暗回去) |
```

- [ ] **Step 7: 提交**

```bash
git add src/features/pinyin-blocks/LevelEntry.tsx src/features/pinyin-blocks/LevelEntry.test.tsx docs/walkthrough.md
git commit -m "feat(pinyin-blocks): 关内连击圆点 —— 会话连击封顶 5 颗,靠填色表达

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 6: 地图徽章栏

**Files:**
- Modify: `src/features/pinyin-blocks/UnitMap.tsx`(props + 渲染段 + 顶部注释)
- Modify: `src/features/pinyin-blocks/MapEntry.tsx`(接 SettingsService)
- Modify: `src/app/App.tsx:87`(注入成就目录)
- Modify: `src/features/pinyin-blocks/UnitMap.test.tsx`(8 处 render 调用 + 3 个新用例)

**Interfaces:**
- Consumes: `SettingsService` 快照的 `earnedAchievements: string[]`;`ACHIEVEMENTS`(`@/features/achievements` 公共面);`Achievement` 类型(`@/shared/services`)。
- Produces: `UnitMapProps = { stars; totalStars; badges: readonly Achievement[]; earned: readonly string[] | null; onPick; onOpenParent }`;**`earned === null` ⇒ 整条徽章栏不渲染**。

**为什么目录由 `app/` 注入(裁定):** `UnitMap` / `MapEntry` 在 `features/pinyin-blocks/`,而目录属主是 `features/achievements/` —— `features` 之间**禁编译期互引**(`src/architecture.test.ts` 守)。按本仓既有口径「组件跨 feature 只在 app 组装」,由 `App.tsx` 把 `ACHIEVEMENTS` 当 prop 传下去(与 `AchievementPopup` 的 `celebrate` prop 同一手法)。**不要**把目录搬进 `shared/` —— 它的语义属主是 achievements。

- [ ] **Step 1: 改 UnitMap 的 props 与渲染**

`src/features/pinyin-blocks/UnitMap.tsx`:

import 区加:

```tsx
import type { Achievement, LevelStars } from '@/shared/services'
```

props 类型改成:

```tsx
export type UnitMapProps = {
  stars: LevelStars
  totalStars: number
  /** 成就目录(emoji 是孩子唯一看得懂的那一列)。由 app 组装层注入 —— features 之间禁互引。 */
  badges: readonly Achievement[]
  /**
   * 已得的成就 id。**`null` = 还不知道**(settings 未就绪)→ 整条徽章栏不渲染。
   *
   * 为什么不是空数组:`App.tsx` 的地图分支只等 `progressSnap.status === 'ready'`,**不等 settings**。
   * 用 `[]` 冒充的话,徽章栏会先显示成「一个都没拿到」再跳变 —— 那是屏幕上出现的一句假话。
   */
  earned: readonly string[] | null
  onPick(unitIndex: number): void
  onOpenParent(): void
}
```

函数签名改成:

```tsx
export function UnitMap({ stars, totalStars, badges, earned, onPick, onOpenParent }: UnitMapProps) {
```

在顶部那行(星尘 + 家长齿轮)之后、网格之前插入:

```tsx
      {/* 成就徽章栏:8 格 = 目录全量,已得填色、未得压暗 —— 「还有 5 个空着」才是驱动力。
          独立一行 + flex-wrap,不吃格子内宽:8 × (24 + 6) = 240px < 375 − 32 ✓(UnitMap.test 钉输入,人眼由 W-V3 兜)。 */}
      {earned === null ? null : (
        <div
          data-achievement-badges
          className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-1.5"
        >
          {badges.map((badge) => {
            const got = earned.includes(badge.id)
            return (
              <span
                key={badge.id}
                data-badge-id={badge.id}
                data-badge-earned={got ? 'true' : 'false'}
                aria-label={`成就 ${badge.name}${got ? '(已得)' : '(未得)'}`}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border border-hairline bg-surface text-base',
                  got ? '' : 'opacity-30 grayscale',
                )}
              >
                <span aria-hidden>{badge.emoji}</span>
              </span>
            )
          })}
        </div>
      )}
```

- [ ] **Step 2: 改 MapEntry**

`src/features/pinyin-blocks/MapEntry.tsx` 整体改成:

```tsx
import { PinyinProgressService, SettingsService, type Achievement } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { UnitMap } from './UnitMap'

/**
 * 地图页入口。useService 只允许出现在 <Name>Entry.tsx,故服务在这里取、以 props 下传。
 * 地图不需要音频 / 语音服务 —— 点锁定格只是不响应,不发声(发声得先有一整套
 * 「哪种声音算提示、哪种算打扰」的判断,现在没有)。
 *
 * settings 只用来读已得成就:`status !== 'ready'` 时传 `null`(「还不知道」),
 * 由 UnitMap 决定整条徽章栏不渲染 —— 不拿空数组冒充「一个都没拿到」。
 * 成就目录由 app 组装层注入(见 UnitMap 的 props 注释)。
 */
export function MapEntry({
  badges,
  onPick,
  onOpenParent,
}: {
  badges: readonly Achievement[]
  onPick(unitIndex: number): void
  onOpenParent(): void
}) {
  const progress = useService(PinyinProgressService)
  const settings = useService(SettingsService)
  const snapshot = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settings)

  return (
    <UnitMap
      stars={snapshot.data.stars}
      totalStars={snapshot.data.totalStars}
      badges={badges}
      earned={settingsSnap.status === 'ready' ? settingsSnap.data.earnedAchievements : null}
      onPick={onPick}
      onOpenParent={onOpenParent}
    />
  )
}
```

- [ ] **Step 3: App 注入目录**

`src/app/App.tsx`:

把 `import { AchievementPopup } from '@/features/achievements'` 改成:

```tsx
import { ACHIEVEMENTS, AchievementPopup } from '@/features/achievements'
```

把地图那一行改成:

```tsx
    content = <MapEntry badges={ACHIEVEMENTS} onPick={actions.enterUnit} onOpenParent={actions.openParent} />
```

- [ ] **Step 4: 更新 UnitMap.test.tsx 的 8 处 render 调用**

`src/features/pinyin-blocks/UnitMap.test.tsx`:import 区加

```ts
import { ACHIEVEMENTS } from '@/features/achievements'
```

并在 `describe` 之前加一个共用 props 基座:

```ts
// UnitMap 的 props 基座:8 处 render 共用。earned 默认 null(= 还不知道),
// 需要徽章栏的用例自己覆盖 —— 这样「不小心渲染出来了」不会污染别的用例。
const base = { stars: {}, totalStars: 0, badges: ACHIEVEMENTS, earned: null, onPick: vi.fn(), onOpenParent: vi.fn() }
```

然后把这 8 处 render 改成 `{...base}` 形式(**逐条按用例名找,不要按行号**):

| 用例名 | 改成 |
|---|---|
| 每个单元各占一格:名片用真积木渲染(u1 格为证) | `<UnitMap {...base} />` |
| 标题与单元名等汉字不出现在地图上 | `<UnitMap {...base} />` |
| u1 解锁可点、u2 锁上点不动(只核这两格) | `<UnitMap {...base} onPick={onPick} />` |
| 通关的格子亮起对应颗数,没通的留着暗星位 | `<UnitMap {...base} stars={stars} totalStars={20} />` |
| 零星的关:一颗都不亮,进度数字归零 | `<UnitMap {...base} stars={{ [unit.levels[0]!.id]: 0 }} />` |
| 星尘计数带可读标签(星尘 340) | `<UnitMap {...base} totalStars={340} />` |
| 点「家长」按钮请求开家长面板 | `<UnitMap {...base} onOpenParent={onOpenParent} />` |
| u7 名片的布局预算:已知的输入都在 | `<UnitMap {...base} />` |

`onPick` / `onOpenParent` 为 `vi.fn()` 的用例里原有的局部变量照旧声明并使用。

- [ ] **Step 5: 跑 UnitMap 与 App 的测试,确认仍是绿**

Run: `npm test -- src/features/pinyin-blocks/UnitMap.test.tsx src/app/App.test.tsx`
Expected: PASS。App.test 的「地图零汉字」用例现在**顺带覆盖了徽章栏**(App 的默认 settings 已 ready → `earned = []` → 8 格全渲染)。

- [ ] **Step 6: 追加徽章栏守卫(UnitMap 三条 + App 一条)**

在 `src/features/pinyin-blocks/UnitMap.test.tsx` 的 `describe` 内追加:

```tsx
  // 「不知道」和「知道且为空」必须在屏幕上给出不同结果 —— 否则 settings 没到位时
  // 徽章栏会先显示成「一个都没拿到」再跳变,那是屏幕上的一句假话。
  it('earned 为 null(还不知道)时整条徽章栏不渲染', () => {
    render(<UnitMap {...base} earned={null} />)
    expect(document.querySelector('[data-achievement-badges]')).toBeNull()
  })

  it('earned 为空数组(知道且为空)时渲染 8 格、全暗', () => {
    render(<UnitMap {...base} earned={[]} />)
    const badges = [...document.querySelectorAll<HTMLElement>('[data-badge-id]')]
    expect(badges.map((badge) => badge.dataset.badgeId)).toEqual(ACHIEVEMENTS.map((a) => a.id))
    expect(badges.map((badge) => badge.dataset.badgeEarned)).toEqual(ACHIEVEMENTS.map(() => 'false'))
  })

  it('已得的格亮起,且只有它亮', () => {
    render(<UnitMap {...base} earned={['perfect_level']} />)
    const lit = [...document.querySelectorAll<HTMLElement>('[data-badge-earned="true"]')]
    expect(lit.map((badge) => badge.dataset.badgeId)).toEqual(['perfect_level'])
  })
```

再在 `src/app/App.test.tsx` 的 `describe('App 路由', ...)` 内追加(**这条不是临时工具,是长期的集成守卫** —— 上面 UnitMap 那三条只证 `earned` 传对了,这一条证 `MapEntry` 传出去的那个值在 settings 未就绪时**确实是 `null`**):

```tsx
  // settings 在路上时地图照样画得出来(App 的地图分支只等 progress),但徽章栏必须**整个不出现** ——
  // 画成「8 格全暗」等于对孩子说「你一个成就都没拿到」,而真相是「还不知道」。
  it('settings 未就绪时地图上不出现徽章栏(而不是画成全暗)', async () => {
    const { container } = mountApp({ settingsPublishes: false })

    await waitFor(() => expect(container.querySelector('[data-unit-map]')).not.toBeNull())
    expect(document.querySelectorAll('[data-badge-id]')).toHaveLength(0)
  })

  it('settings 就绪后徽章栏出现,8 格全暗(知道且为空 ≠ 不知道)', async () => {
    const { container } = mountApp()

    await waitFor(() => expect(container.querySelector('[data-unit-map]')).not.toBeNull())
    expect(document.querySelectorAll('[data-badge-id]')).toHaveLength(ACHIEVEMENTS.length)
    expect(document.querySelectorAll('[data-badge-earned="true"]')).toHaveLength(0)
  })
```

`src/app/App.test.tsx` 的 import 区加:

```ts
import { ACHIEVEMENTS } from '@/features/achievements'
```

- [ ] **Step 7: 跑,确认新用例绿**

Run: `npm test -- src/features/pinyin-blocks/UnitMap.test.tsx src/app/App.test.tsx`
Expected: PASS。

- [ ] **Step 8: 反例验证**

```bash
cp src/features/pinyin-blocks/UnitMap.tsx /tmp/um.bak
cp src/features/pinyin-blocks/MapEntry.tsx /tmp/me.bak
```

注入 A(改 UnitMap):`{earned === null ? null : ( ... )}` 改成无条件渲染 → 「earned 为 null 时整条不渲染」必须红。
还原;注入 B(改 MapEntry):把 `: null` 改成 `: []` → 「settings 未就绪时地图上不出现徽章栏」必须红(这一条正是为它写的)。

还原:

```bash
cp /tmp/um.bak src/features/pinyin-blocks/UnitMap.tsx
cp /tmp/me.bak src/features/pinyin-blocks/MapEntry.tsx
md5sum -c <(md5sum /tmp/um.bak | sed 's#/tmp/um.bak#src/features/pinyin-blocks/UnitMap.tsx#')
md5sum -c <(md5sum /tmp/me.bak | sed 's#/tmp/me.bak#src/features/pinyin-blocks/MapEntry.tsx#')
```

- [ ] **Step 9: 同提交更新走查**

在 `docs/walkthrough.md` 的「布局与窄屏」表末尾加一行:

```markdown
| **W-V3** 窄屏地图顶部徽章栏 | 窗口 **375px** | 看地图顶部那一排成就图标 | **不溢出**、不把上面的星尘行挤掉、**不换行成两排以上** |
```

- [ ] **Step 10: 提交**

```bash
git add src/features/pinyin-blocks/UnitMap.tsx src/features/pinyin-blocks/MapEntry.tsx \
  src/features/pinyin-blocks/UnitMap.test.tsx src/app/App.tsx src/app/App.test.tsx docs/walkthrough.md
git commit -m "feat(pinyin-blocks): 地图成就徽章栏(8 格,已得填色)+ earned=null 不渲染

- 目录由 app 组装层注入(features 之间禁编译期互引)
- MapEntry 新接 SettingsService;settings 未就绪传 null —— 不拿空数组冒充「一个都没拿到」

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 7: 家长面板成就目录

**Files:**
- Modify: `src/app/ParentPanel.tsx`
- Modify: `src/app/ParentPanel.test.tsx:7-11`(register 帮助函数补 SettingsService)

**Interfaces:**
- Consumes: `SettingsService`、`ACHIEVEMENTS`(`@/features/achievements`)。
- Produces: 列表项 `data-achievement-id` + `data-earned="true"|"false"`。

**口径:** 「隐藏成就」只对孩子有意义 —— 大人该看到**全部 8 条**目录与还差什么。中文在这一页**合法且应该**(`ParentPanel.tsx:7` 的注释已立此口径)。

- [ ] **Step 1: 先给测试补上 SettingsService(否则现有三条用例会当场抛「服务未注册」)**

`src/app/ParentPanel.test.tsx` 的 import 区加:

```ts
import { AuthService, PinyinProgressService, SettingsService } from '@/shared/services'
```

把 `register` 帮助函数改成:

```ts
function register(auth: unknown, progress: unknown, settings: unknown = readySettings()) {
  registry.clear()
  registry.register(AuthService, auth as never)
  registry.register(PinyinProgressService, progress as never)
  registry.register(SettingsService, settings as never)
}

/**
 * 家长面板只读 settings 的「已得成就」;三条旧用例不关心它,给个已就绪的空账。
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
```

- [ ] **Step 2: 跑,确认三条旧用例仍绿**

Run: `npm test -- src/app/ParentPanel.test.tsx`
Expected: PASS(此时 ParentPanel 还没读 settings,但注册进去无害)。

- [ ] **Step 3: 追加失败测试**

在 `src/app/ParentPanel.test.tsx` 的 `describe` 内追加:

```tsx
  it('成就目录 8 条全出现(含未得),中文说明读得通', async () => {
    register({ logout: vi.fn() }, { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll: vi.fn() }, readySettings(['perfect_level']))
    render(<ParentPanel onClose={vi.fn()} />)

    const items = [...document.querySelectorAll<HTMLElement>('[data-achievement-id]')]
    expect(items.map((item) => item.dataset.achievementId)).toEqual(ACHIEVEMENTS.map((a) => a.id))
    for (const achievement of ACHIEVEMENTS) {
      expect(screen.getByText(new RegExp(achievement.name))).toBeInTheDocument()
      expect(screen.getByText(new RegExp(achievement.description))).toBeInTheDocument()
    }
  })

  it('已得 / 未得两态分开', async () => {
    register({ logout: vi.fn() }, { getSnapshot: () => ({ status: 'ready', data: {} }), subscribe: () => () => {}, resetAll: vi.fn() }, readySettings(['perfect_level']))
    render(<ParentPanel onClose={vi.fn()} />)

    const earned = [...document.querySelectorAll<HTMLElement>('[data-earned="true"]')]
    expect(earned.map((item) => item.dataset.achievementId)).toEqual(['perfect_level'])
  })

  // 面板可能在地图刚画好、settings 还在路上时被打开(App.tsx 的 parent 分支不检查 settings)。
  // 这时候**不能**把 8 条全画成「未得」—— 那是屏幕上的一句假话。
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
```

并在该文件 import 区加:

```ts
import { ACHIEVEMENTS } from '@/features/achievements'
```

- [ ] **Step 4: 跑,确认三条红**

Run: `npm test -- src/app/ParentPanel.test.tsx`
Expected: 三条新用例 FAIL(「服务未注册: SettingsService」)。

- [ ] **Step 5: 实现**

`src/app/ParentPanel.tsx` 整体改成:

```tsx
import { X } from 'lucide-react'
import { ACHIEVEMENTS } from '@/features/achievements'
import { AuthService, PinyinProgressService, SettingsService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { Button } from '@/shared/ui/button'
import { cn } from '@/shared/ui/utils'

/**
 * 家长面板。**这一页可以写字** —— 它是给大人用的,不是给孩子用的。
 * 装的全是孩子不该碰的东西:登出、清空进度;以及孩子看不见的成就目录
 * (成就名与说明已从孩子面撤下,只在这里有出口)。
 */
export function ParentPanel({ onClose }: { onClose(): void }) {
  const auth = useService(AuthService)
  const progress = useService(PinyinProgressService)
  const settings = useService(SettingsService)
  const settingsSnap = useServiceSnapshot(settings)

  async function reset() {
    if (!window.confirm('确定要重置全部学习进度吗?所有星星都会清零,此操作无法撤销。')) return
    try {
      await progress.resetAll()
    } catch {
      // 服务自身已 toast 报错,这里不重复打扰
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div className="relative max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-[1.75rem] border border-hairline bg-surface p-5 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">家长设置</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-3">
          <Button variant="outline" className="w-full" onClick={() => { void auth.logout() }}>
            退出登录
          </Button>
          <Button variant="destructive" className="w-full" onClick={() => { void reset() }}>
            重置全部进度
          </Button>
        </div>

        <div className="mt-5">
          <h3 className="text-sm font-bold text-ink-2">成就</h3>
          {/* settings 没到位就不画目录:把 8 条全画成「未得」是在屏幕上说假话(同 MapEntry 的 null 口径) */}
          {settingsSnap.status !== 'ready' ? (
            <p className="mt-2 text-sm text-ink-3">成就数据读取中…</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {ACHIEVEMENTS.map((achievement) => {
                const got = settingsSnap.data.earnedAchievements.includes(achievement.id)
                return (
                  <li
                    key={achievement.id}
                    data-achievement-id={achievement.id}
                    data-earned={got ? 'true' : 'false'}
                    className={cn(
                      'flex items-start gap-2 rounded-2xl border border-hairline p-2',
                      got ? '' : 'opacity-55',
                    )}
                  >
                    <span aria-hidden className="text-xl">{achievement.emoji}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-bold">
                        {achievement.name}
                        {got ? ' · 已得' : ''}
                      </span>
                      <span className="block text-xs text-ink-3">
                        {achievement.description}(+{achievement.reward} ⭐)
                      </span>
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <Button size="lg" className="mt-4 w-full" onClick={onClose}>
          完成
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 跑,确认全绿**

Run: `npm test -- src/app/ParentPanel.test.tsx src/app/App.test.tsx`
Expected: PASS(App.test 的「map → parent → map」用例此时也有了 settings 假服务)。

- [ ] **Step 7: 反例验证**

```bash
cp src/app/ParentPanel.tsx /tmp/pp.bak
```

注入 A:把 `settingsSnap.status !== 'ready' ? (...)` 整段判断拆掉、无条件画列表 → 「settings 没就绪时不画目录」必须红。
还原;注入 B:`got ? 'true' : 'false'` 改成恒 `'true'` → 「已得 / 未得两态分开」必须红。
还原后再跑 Step 6,回到 PASS。

- [ ] **Step 8: 同提交更新走查**

在 `docs/walkthrough.md` 的「家长面板」表末尾加一行:

```markdown
| **W-P4** 成就目录 | 任意设备,面板内 | 往下看「成就」段 | **8 条全在**(含**未得**的,压暗显示),每条有名字 + 中文说明 + 奖励数;**已得的那条带「· 已得」** |
```

- [ ] **Step 9: 提交**

```bash
git add src/app/ParentPanel.tsx src/app/ParentPanel.test.tsx docs/walkthrough.md
git commit -m "feat(app): 家长面板加成就目录(8 条全显,已得/未得两态)—— 孩子面撤下的名字与说明在这里有出口

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

### Task 8: 走查跨面条目与 PLAN 收口

**Files:**
- Modify: `docs/walkthrough.md`
- Modify: `docs/PLAN.md`(0.2.0 feature 轨里「特效零文本化(撒花 / 连击 / 成就 / 幸运奖励)+ 地图徽章栏」那一行)

**本任务只收**跨面 / 收口的那几条:每个改动面的分区条目(`W-S3` / `W-L4` / `W-L5` / `W-V3` / `W-P4`)已经跟着**各自的行为提交**落进 `docs/walkthrough.md` 了 —— 那是 `CLAUDE.md` 的硬规则,不要挪到这里补。

**为什么 `W-C9` 留到最后(裁定):** 它的第一句前提是「地图 + 关卡 + 弹层三面都已改完」。提前写就是对当时为假的事实写期望 —— 本仓病根之一。代价是这一支(纯文档)在功能全部完成之后才落;它在分支内,合并前一定到位。

- [ ] **Step 1: §B 加 W-C9**

在 `docs/walkthrough.md` §B 表格末尾(「解锁」那行之后)追加一行:

```markdown
| **W-C9** 零文本 | 任意设备,先登录 | 依次看**地图**(含顶部徽章栏)、进一关拼完、触发一次**成就或幸运弹层** | 全程**肉眼看不到一个汉字**;**唯一例外**是拼对后答案行亮出的那个同音汉字(教学内容,故意留的)。徽章栏是一排图标,没有字 |
```

- [ ] **Step 2: 改 §B 的条目数**

先**数一遍** §B 表格里 `W-C*` 的行数(**数出来是多少就写多少**),再把 `docs/walkthrough.md` 里那一句

```markdown
> 今天共 **8 条**。全部走完 + 明确「通过」,闸门①才开。
```

改成实数。**同文件 §D 的触发条件表**里还有一处「**§B 核心回归**(8 条)」要同步。**按文字找,不按行号**。若数出来与 9 不符,写实数并在报告里说明差在哪。

- [ ] **Step 3: 核对各分区的条目都已就位**

Run: `grep -n "W-S3\|W-L4\|W-L5\|W-V3\|W-P4" docs/walkthrough.md`
Expected: 五行都在,且各在正确的分区表里(布局与窄屏 / 关卡与积木盘 / 结算与奖励 / 家长面板)。缺哪条就补哪条 —— 那是前面某个任务漏了走查更新。

- [ ] **Step 4: 改 §C 的两条诚实缺口**

把 §C「尚未纳入」里的那一条(**按文字找**):

```markdown
- **成就 / 连击 / 幸运奖励的可见反馈**:结算里触发,但**屏幕上能不能看出来、什么时候看出来**,未核 → **未纳入**。
```

整条**删掉**,替换为:

```markdown
- **成就 / 连击 / 幸运奖励的可见反馈**:**已纳入**(2026-09-23)—— 见 `W-C9` / `W-L4` / `W-L5` / `W-S3` / `W-P4`。
```

把同段落里紧跟着的那一条:

```markdown
- **「零文本」这条设计不变量**:「没有文字」与「没有**必须读懂才能玩**的文字」是两回事,**今天没有可判定的写法** → 要么补一条可判定的,要么**明确放弃它作为闸门**。
```

替换为:

```markdown
- **「零文本」这条设计不变量**:**已可判定**(2026-09-23)。精确形 = 孩子面上不许有「要读懂才玩得下去、或要读懂才明白刚才发生了什么」的文字;**两类除外**:① 教学内容(关卡答案行的同音汉字)② `aria-label`(不进视觉)。人眼判据见 `W-C9`;机器判据 = `npm test` 里地图 / 两个弹层的零汉字扫描 + 关卡页「直接文本含汉字的元素恰好一个」。
```

- [ ] **Step 5: W-C5 加注**

在 §B 的 `W-C5` 那行**之后**加一段注(同 §B 已有的 `W-C3 / W-C4 的注` 那种写法):

```markdown
> **W-C5 的注(2026-09-23)**:答案行那个汉字是**有意留的教学内容**,不是漏改 —— 拼音认读不强绑汉字就只是字母游戏(`docs/superpowers/specs/2026-09-23-effects-textless-design.md` §2 的除外项①)。别把它当缺陷报。
```

- [ ] **Step 6: PLAN 收口**

把 `docs/PLAN.md` 里「特效零文本化(撒花 / 连击 / 成就 / 幸运奖励)+ 地图徽章栏」那一行(**按文字找,不按行号**)开头的 `- [ ]` 改成 `- [x]`,并把行尾的 `— 已立项,spec 待出` 改成:

```
— 已实施(plan `docs/superpowers/plans/2026-09-23-effects-textless.md`),随 0.2.0 发
```

- [ ] **Step 7: 跑全量测试与 lint**

Run: `npm test && npm run lint`
Expected: 测试全绿;oxlint 输出**恰好 2 条 warning**,且是 `src/shared/ui/import-alias.test.ts:5:51` 与 `src/shared/ui/button.tsx:46:18`。多一条都算回归。

- [ ] **Step 8: 提交**

```bash
git add docs/walkthrough.md docs/PLAN.md
git commit -m "docs(walkthrough): 特效零文本化的走查条目 + 两条诚实缺口收口;PLAN 行随 0.2.0

- §B 加 W-C9(进 §B,条目数同步);§C 加 W-L4/W-L5/W-S3/W-V3/W-P4
- §C「零文本不变量没有可判定写法」与「成就/连击反馈未纳入」两条缺口改为已纳入
- W-C5 加注:答案行汉字是教学内容,不是漏改

Co-Authored-By: Claude Code <noreply@anthropic.com>"
```

---

## 收尾(不在任何 Task 内,由控制器执行)

- 全支终审(最强模型),按 `superpowers:subagent-driven-development` 的终审流程走。
- 终审前确认:`npm test` 全绿、`npm run lint` 与基线逐条一致、`git diff main...HEAD --stat` 里**没有** `worker/` 与 `migrations/` 的改动(本计划零后端改动)。
- 走 `superpowers:finishing-a-development-branch` 收尾 —— **push / tag / 部署一律不在本计划射程**,要单独拿用户的话。
- 走查 `§B`(含新 `W-C9`)+ `§C` 新增条目由**用户在浏览器里**走;`W-L4/W-L5` 需要真触摸设备才能验的部分按 `docs/walkthrough.md` §D 第 4 条记「未验」,**不许记「通过」**。
