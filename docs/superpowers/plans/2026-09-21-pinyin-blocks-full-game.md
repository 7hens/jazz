# 拼音积木取代全游戏 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `?mock=pinyin` 的拼音积木试验田扶正为唯一正式玩法（单元地图 + 单元内线性 + 每关星级 + 星尘累计），并整批删除千字谷 / 字母林 / 词课 / 基础引导 / 出题引擎 / 词库。

**Architecture:** 分两个提交。**Phase 1（Task 1-12）**先建：新迁移 `0008` + worker 路由 + 前端进度服务 + 进度统计纯函数 + 游戏内星级与提示降档 + 单元地图 + 家长面板 + 趣味系统重锚，最后切 `App.tsx` 壳。**Phase 2（Task 13-15）**后删：整目录删除 + `shared/ui` 清扫 + 文档同步，删除是独立可 revert 的提交。

**Tech Stack:** React 19 + TS + Vite + Tailwind 4 + motion 前端；Cloudflare Workers 手写路由 + D1；vitest（jsdom）+ @testing-library/react。

**Spec:** `docs/superpowers/specs/2026-09-21-pinyin-blocks-full-game-design.md`

## Global Constraints

- **`wrangler` 命令一律显式 `--config wrangler.toml`**，否则构建产物劫持配置 → env 失效、DB 落生产库。
- **禁止 `[env.production]`**；生产 = 默认 env。prod `ADMIN_TOKEN` 已是 secret，勿覆盖。
- **表结构变更只新增数字前缀迁移，不改 `0001` 基线**；新字段带 `DEFAULT` 或可 `NULL`。顺序：先升库后升代码。
- **`tag` 仅在部署成功 + 浏览器冒烟通过后打**；失败绝不 `npm version`。
- **3 层架构**（`src/architecture.test.ts` 守）：`shared/` 不得 import 上层；`features/<f>/` 之间禁编译期互引；`useService` 仅在 `features/<f>/<Name>Entry.tsx` 与 `app/`。
- **禁止截图/读图检查 UI**（No Screenshots）。验证一律用 `textContent` dump、`getComputedStyle`、测试、grep 构建产物 CSS、console / network。确需看像素请用户自己看。
- **材质类写在 `src/index.css` 普通（非 `@layer`）类**，走 token + `color-mix`，**禁颜色字面量**（唯一例外 = 白色高光 `rgb(255 255 255 / x)`）。
- **UI 文案中文**；依赖精简，无路由 / 状态管理库。
- **每个 Task 结束跑 `npx tsc -b`，Phase 结束跑 `npm test` 全绿**。
- 提交信息用中文，结尾加 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。

## 文件结构总览

| 文件 | 职责 | 动作 |
|---|---|---|
| `migrations/0008_pinyin_progress.sql` | 每 user 一行：星级 JSON + 星尘 | 建 |
| `worker/pinyin-progress.ts` | 该表的 GET / PUT / DELETE + 纯合并助手 | 建 |
| `worker/pinyin-progress.test.ts` | 纯助手护栏（首例 worker 测试） | 建 |
| `worker/index.ts` | 路由表：三条换一条 | 改 |
| `src/shared/services/pinyin-progress.ts` | 契约 + token + 数据类 | 建 |
| `src/shared/services/api.ts` | 换三个方法 | 改 |
| `src/features/api/api.ts` | http 实现 + 响应校验 | 改 |
| `src/features/pinyin-progress/*` | 乐观合并 + 串行事务的服务实现 | 建 |
| `src/features/pinyin-blocks/levels.ts` | 关卡稳定 id + 单元名片 | 改 |
| `src/features/pinyin-blocks/blocks.ts` | 提示档表 + `hintFor` | 改 |
| `src/features/pinyin-blocks/rules.ts` | `starsFor` 星级判定 | 改 |
| `src/features/pinyin-blocks/progress-stats.ts` | 解锁与统计纯函数 | 建 |
| `src/features/pinyin-blocks/settle.ts` | 关卡结算协调器（注入服务） | 建 |
| `src/features/pinyin-blocks/UnitMap.tsx` | 单元地图 | 建 |
| `src/features/pinyin-blocks/MapEntry.tsx` | 地图页入口（唯一取服务点之一） | 建 |
| `src/features/pinyin-blocks/LevelEntry.tsx` | 关卡页入口（唯一取服务点之一） | 建 |
| `src/features/pinyin-blocks/PinyinBlocksGame.tsx` | 星级计数 + 提示降档 + `onSolved` | 改 |
| `src/app/ParentPanel.tsx` | 登出 + 重置进度 | 建 |
| `src/app/useAppState.ts` | 8 相位 → 5 相位 | 改 |
| `src/app/App.tsx` | 渲染分支 8 条 → 5 条 | 改 |
| `src/features/achievements/achievements.ts` | 成就目录换锚 | 改 |
| `src/shared/services/achievements.ts` | `AchievementState` 换字段 | 改 |
| `src/index.css` | 提示强度收敛成两个变量 | 改 |

---

# Phase 1 — 先建（提交 1）

主线：**关卡数据 → 后端 → 前端服务 → 纯逻辑 → 游戏内 → 新界面 → 趣味重锚 → 切壳**。

---

### Task 1: 关卡稳定 id + 单元名片

**为什么先做**：后面每一个 Task 都要用到 `level.id` 当存档键、`unit.badge` 当地图名片。数据不先落，下层全是空中楼阁。

**Files:**
- Modify: `src/features/pinyin-blocks/levels.ts`
- Test: `src/features/pinyin-blocks/levels.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `Level.id: string`（格式 `/^u\d+-\d+$/`）、`Unit.badge: readonly Block[]`

- [ ] **Step 1: 改 `Level` / `Unit` 类型**

在 `src/features/pinyin-blocks/levels.ts` 里给两个类型加字段（`Block` 需要从 `./blocks` 引入类型）：

```ts
import type { Block } from './blocks'

/** 一关:一张图 + 一个(或两个)音节。双音节词给两组槽位。 */
export type Level = {
  /**
   * 存档键。与显示顺序**解耦** —— 顺序可调、可插入,已存的星不受影响。
   * 形如 'u2-3'(单元 id + 建关时的序号);序号只在创建时取一次,之后该关怎么挪都不改。
   */
  readonly id: string
  readonly emoji: string
  readonly pinyin: string
  readonly read: string
  readonly syl: readonly Syllable[]
}

export type Unit = {
  readonly id: string
  /** 仅用于家长/试玩者的关卡选择器,游戏内不出现。 */
  readonly name: string
  /** 地图格子里的名片 —— 本单元新教的块。跟 levels 一样**显式写死**,不靠反推。 */
  readonly badge: readonly Block[]
  readonly levels: readonly Level[]
}
```

- [ ] **Step 2: 给 37 关逐个加 `id`**

id 取值 = `${单元 id}-${关内序号}`（0 基）。按下表加进每个 level 字面量的**第一行**：

| 单元 | id 序列 |
|---|---|
| u1（3 关） | `u1-0` `u1-1` `u1-2` |
| u2（6 关） | `u2-0` … `u2-5` |
| u3（6 关） | `u3-0` … `u3-5` |
| u4（5 关） | `u4-0` … `u4-4` |
| u5（5 关） | `u5-0` … `u5-4` |
| u6（7 关） | `u6-0` … `u6-6` |
| u7（5 关） | `u7-0` … `u7-4` |

例（u2 的前两关）：

```ts
  {
    id: 'u2',
    name: '二拼',
    badge: [{ type: 'initial', value: 'b' }, { type: 'final', value: 'a' }],
    levels: [
      { id: 'u2-0', emoji: '👨', pinyin: 'bà', read: '爸', syl: [{ initial: 'b', final: 'a', tone: 4 }] },
      { id: 'u2-1', emoji: '🐴', pinyin: 'mǎ', read: '马', syl: [{ initial: 'm', final: 'a', tone: 3 }] },
      // …
    ],
  },
```

- [ ] **Step 3: 给 7 个单元加 `badge`**

```ts
u1: [{ type: 'final',   value: 'a' }]
u2: [{ type: 'initial', value: 'b' }, { type: 'final',   value: 'a' }]
u3: [{ type: 'final',   value: 'ai' }]
u4: [{ type: 'final',   value: 'a' }, { type: 'nasal',   value: 'n' }]
u5: [{ type: 'initial', value: 'g' }, { type: 'medial',  value: 'u' }, { type: 'final', value: 'a' }]
u6: [{ type: 'initial', value: 'zh' }, { type: 'final',  value: 'i' }]
u7: [{ type: 'initial', value: 'x' }, { type: 'final',   value: 'i' },
     { type: 'initial', value: 'g' }, { type: 'medial',  value: 'u' }, { type: 'final', value: 'a' }]
```

`u7` 的名片是**两组音节**（零宽间隔由渲染层用分隔符表达），共 5 块，比别的宽 —— 这是有意的，它要一眼看出「这一格是两段」。

- [ ] **Step 4: 写护栏测试**

追加到 `src/features/pinyin-blocks/levels.test.ts` 末尾（`describe` 块内）：

```ts
  // 存档只认 id。id 一重复,两个关就共用一份星 —— 而且是静默的,没有任何报错。
  it('每关都有稳定 id,格式合规且全局唯一', () => {
    const seen = new Map<string, string>()
    for (const entry of allLevels) {
      for (const [i, level] of entry.level.syl.entries()) void i
      const level = entry.level
      const label = where(entry)
      expect(level.id, `${label} 缺 id`).toMatch(/^u\d+-\d+$/)
      const owner = seen.get(level.id)
      expect(owner, `${level.id} 重复出现在 ${owner} 与 ${label}`).toBeUndefined()
      seen.set(level.id, label)
    }
    expect(seen.size, 'id 总数该等于关卡总数').toBe(allLevels.length)
  })

  // 地图格子靠名片表意 —— 名片空了,那一格对 4-8 岁的孩子就是一块灰砖。
  it('每个单元都有非空名片,且名片里的块都在块目录定义域内', () => {
    const pool: Record<string, readonly string[]> = {
      initial: INITIALS_ALL,
      medial: MEDIALS,
      final: [...FINAL_BASIC, ...FINAL_COMPOUND],
      nasal: NASALS,
      tone: TONE_VALUES,
    }
    for (const u of UNITS) {
      expect(u.badge.length, `${u.id} 名片为空`).toBeGreaterThan(0)
      for (const block of u.badge) {
        expect(pool[block.type], `${u.id} 名片块类型 ${block.type}`).toBeDefined()
        expect(pool[block.type], `${u.id} 名片块 ${block.type}:${block.value}`).toContain(block.value)
      }
      // 声调块不该出现在名片里:它不是一个「这个单元教什么」的答案
      expect(u.badge.some((b) => b.type === 'tone'), `${u.id} 名片混进了声调块`).toBe(false)
    }
  })
```

- [ ] **Step 5: 跑测试**

Run: `npx vitest run src/features/pinyin-blocks/levels.test.ts`
Expected: PASS（若 `id` 漏写，第一条红并指名是哪个单元第几关）

- [ ] **Step 6: 跑类型检查**

Run: `npx tsc -b`
Expected: 无输出。此刻 `levels.ts` 的新字段还没人消费，但 `Level` 是必填字段 → 任何构造 `Level` 的地方（目前只有 `levels.ts` 自己）漏字段都会在这里红。

- [ ] **Step 7: 提交**

```bash
git add src/features/pinyin-blocks/levels.ts src/features/pinyin-blocks/levels.test.ts
git commit -m "$(cat <<'EOF'
feat(pinyin-blocks): 关卡加稳定 id + 单元名片

存档要按 id 认关,不能用 UNITS 展平后的下标 —— 以后在 u2 中间插一关,
后面每一关的存档都会错位,孩子的星跳到别的关上去,且没有任何报错。
id 形如 'u2-3',建关时取一次,之后该关怎么挪都不改。

单元名片 = 地图格子里摆的那几块(本单元新教的块),数据即答案,
跟 levels 一样显式写死。零文本下这是格子唯一能自表意的方案。

护栏:37 个 id 格式合规且全局唯一;7 个单元名片非空、块值在目录定义域内、
不混声调块。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: 迁移 0008 + worker handler + 路由

**Files:**
- Create: `migrations/0008_pinyin_progress.sql`
- Create: `worker/pinyin-progress.ts`
- Create: `worker/pinyin-progress.test.ts`
- Modify: `worker/index.ts`

**Interfaces:**
- Consumes: Task 1 的 id 格式约定（worker 侧独立保留正则字面量，**不跨端 import**）
- Produces: `GET/PUT/DELETE /api/pinyin-progress`；导出纯助手 `parseStars(raw: string): Record<string, number>`、`readStars(payload: unknown): Record<string, number> | null`、`mergeStars(existing, incoming): Record<string, number>`

- [ ] **Step 1: 写迁移**

Create `migrations/0008_pinyin_progress.sql`:

```sql
-- 拼音积木正式版:每 user 一行(每关星级 + 星尘累计)。
-- additive:仅新增表,不改 0001 基线;旧代码回滚无视本表。
-- stars 是 JSON 对象 { "<levelId>": 1|2|3 },未通关的关不出现 ——
-- 用对象而非定长串:以后加关卡不用动 worker 里的常量。
CREATE TABLE IF NOT EXISTS pinyin_progress (
  user_id     TEXT    PRIMARY KEY,
  stars       TEXT    NOT NULL DEFAULT '{}',
  total_stars INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: 先写失败的 worker 测试**

Create `worker/pinyin-progress.test.ts`（`vitest.config.ts` 的 include 已含 `worker/**/*.test.ts`，无需改配置）：

```ts
import { describe, expect, it } from 'vitest'
import { mergeStars, parseStars, readStars } from './pinyin-progress'

describe('拼音进度 · worker 纯助手', () => {
  it('坏掉的存档当空表,不让整个接口 500', () => {
    expect(parseStars('')).toEqual({})
    expect(parseStars('不是 json')).toEqual({})
    expect(parseStars('[]')).toEqual({})
    expect(parseStars('null')).toEqual({})
  })

  // 存量里的脏数据不该被带出去:id 不合格式、星数越界的项一律丢弃。
  it('逐项过筛:非法 id 与非法星数都丢掉', () => {
    expect(parseStars('{"u1-0":3,"不是id":2,"u1-1":9,"u1-2":0,"u2-0":2}')).toEqual({ 'u1-0': 3, 'u2-0': 2 })
  })

  it('readStars 对入参校验:非对象返回 null,非法项整体 400', () => {
    expect(readStars(null)).toBeNull()
    expect(readStars([])).toBeNull()
    expect(readStars('{}')).toBeNull()
    expect(readStars({ 'u1-0': 4 })).toBeNull()
    expect(readStars({ 'bad': 1 })).toBeNull()
    expect(readStars({ 'u1-0': 3, 'u2-1': 1 })).toEqual({ 'u1-0': 3, 'u2-1': 1 })
  })

  // 只升不降:重玩拿了一星不该把三星冲掉。
  it('合并逐 key 取 max', () => {
    expect(mergeStars({ 'u1-0': 3, 'u1-1': 1 }, { 'u1-0': 1, 'u1-2': 2 }))
      .toEqual({ 'u1-0': 3, 'u1-1': 1, 'u1-2': 2 })
    expect(mergeStars({}, { 'u1-0': 2 })).toEqual({ 'u1-0': 2 })
    expect(mergeStars({ 'u1-0': 2 }, {})).toEqual({ 'u1-0': 2 })
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run worker/pinyin-progress.test.ts`
Expected: FAIL — `Failed to resolve import "./pinyin-progress"`

- [ ] **Step 4: 写 handler**

Create `worker/pinyin-progress.ts`:

```ts
// 拼音积木进度:每 user 一行 —— 每关星级(JSON)+ 星尘累计。
// 两条线都**单调升**,故合并一律取 max,幂等(重放同一份请求结果不变)。
//
// 存 JSON 而非定长串:以后加关卡不用在 worker 里维护「总关数」常量。
// 代价是 stars 没法在 SQL 里逐 key 取 max —— 只能读-改-写(见 handlePut)。
// 单档案自托管(一个家庭、一次一台设备写)下并发窗口不可达;且前端每次提交的是
// 已 merge 服务端旧值的**全量**,即使覆盖也不会丢已通关的位。

import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

/** 与前端 `levels.ts` 的 id 格式对齐。worker 侧独立保留字面量,不跨端 import。 */
const LEVEL_ID = /^u\d+-\d+$/
/** 星尘上限:纯防呆,挡住溢出与手改。 */
const MAX_TOTAL_STARS = 1_000_000

type Row = { stars: string; total_stars: number }

/** 坏掉的存档当空表 —— 一行脏数据不该让整个接口 500,把孩子挡在门外。 */
export function parseStars(raw: string): Record<string, number> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!LEVEL_ID.test(key)) continue
    if (value === 1 || value === 2 || value === 3) out[key] = value
  }
  return out
}

/** 校验入参的星级表;非法返回 null(调用方据此 400,不静默降级)。 */
export function readStars(payload: unknown): Record<string, number> | null {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (!LEVEL_ID.test(key)) return null
    if (value !== 1 && value !== 2 && value !== 3) return null
    out[key] = value
  }
  return out
}

/** 逐 key 取 max。重玩拿了一星不该把三星冲掉。 */
export function mergeStars(
  existing: Record<string, number>,
  incoming: Record<string, number>,
): Record<string, number> {
  const out = { ...existing }
  for (const [key, value] of Object.entries(incoming)) {
    out[key] = Math.max(out[key] ?? 0, value)
  }
  return out
}

function toClient(row: Row | null) {
  return {
    stars: parseStars(row?.stars ?? '{}'),
    totalStars: row?.total_stars ?? 0,
  }
}

export async function handleGetPinyinProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = await env.DB.prepare(
    'SELECT stars, total_stars FROM pinyin_progress WHERE user_id = ?',
  ).bind(user.id).first<Row>()
  return jsonResponse(toClient(row ?? null))
}

export async function handlePutPinyinProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { stars?: unknown; totalStars?: unknown } | null
  const incoming = readStars(body?.stars)
  if (!incoming) return jsonResponse({ message: '星级数据不合法' }, { status: 400 })

  const rawTotal = body?.totalStars
  if (typeof rawTotal !== 'number' || !Number.isInteger(rawTotal) || rawTotal < 0 || rawTotal > MAX_TOTAL_STARS) {
    return jsonResponse({ message: '星尘数不合法' }, { status: 400 })
  }

  const existing = await env.DB.prepare(
    'SELECT stars FROM pinyin_progress WHERE user_id = ?',
  ).bind(user.id).first<Row>()
  const merged = mergeStars(parseStars(existing?.stars ?? '{}'), incoming)

  await env.DB.prepare(
    `INSERT INTO pinyin_progress (user_id, stars, total_stars, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       stars       = excluded.stars,
       total_stars = MAX(pinyin_progress.total_stars, excluded.total_stars),
       updated_at  = excluded.updated_at`,
  ).bind(user.id, JSON.stringify(merged), rawTotal, new Date().toISOString()).run()

  return jsonResponse({ ok: true })
}

export async function handleDeletePinyinProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  await env.DB.prepare('DELETE FROM pinyin_progress WHERE user_id = ?').bind(user.id).run()
  return jsonResponse({ ok: true })
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run worker/pinyin-progress.test.ts`
Expected: PASS（4 条）

- [ ] **Step 6: 挂路由**

在 `worker/index.ts` 里加 import 并加 case（**先加新的，旧的留到 Task 13 再删**）：

```ts
import {
  handleDeletePinyinProgress,
  handleGetPinyinProgress,
  handlePutPinyinProgress,
} from './pinyin-progress'
```

```ts
      case '/api/pinyin-progress':
        if (method === 'GET') return handleGetPinyinProgress(request, env)
        if (method === 'PUT') return handlePutPinyinProgress(request, env)
        if (method === 'DELETE') return handleDeletePinyinProgress(request, env)
        return methodNotAllowed()
```

- [ ] **Step 7: 升本地库**

```bash
npm run db:local
```

Expected: 输出含 `0008_pinyin_progress.sql` 已 apply（`✅`）。**先升库后升代码** —— 之后本地 `npm run dev` 才不会因为表不存在而 500。

- [ ] **Step 8: 类型检查 + 提交**

```bash
npx tsc -b
git add migrations/0008_pinyin_progress.sql worker/pinyin-progress.ts worker/pinyin-progress.test.ts worker/index.ts
git commit -m "$(cat <<'EOF'
feat(pinyin): 迁移 0008 + /api/pinyin-progress 路由

每 user 一行:stars(JSON,关卡 id → 星数)+ total_stars(星尘累计)。
两条线都单调升,合并一律取 max,幂等。

stars 存 JSON 而非定长串 —— 以后加关卡不用在 worker 里维护总关数常量;
代价是没法在 SQL 里逐 key 取 max,只能读-改-写。单档案自托管下并发窗口
不可达,且前端每次提交的是已 merge 服务端旧值的全量,覆盖也不丢位。

worker 侧独立保留 LEVEL_ID 正则与星数上限字面量,不跨端 import;
坏了存档当空表(一行脏数据不该把孩子挡在门外),但入参非法仍一律 400。

纯助手单测 4 条 —— 这是仓库第一份 worker 测试(vitest include 早已留位)。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: API 契约与 http 实现

**Files:**
- Create: `src/shared/services/pinyin-progress.ts`
- Modify: `src/shared/services/index.ts`
- Modify: `src/shared/services/api.ts`
- Modify: `src/features/api/api.ts`
- Test: `src/features/api/api.test.ts`

**Interfaces:**
- Consumes: Task 2 的响应形状 `{ stars: Record<string, number>; totalStars: number }`
- Produces: 契约 `PinyinProgressData` / `PinyinProgressSnapshot` / `PinyinProgressService` + token；`ApiService.getPinyinProgress() / putPinyinProgress(data) / deletePinyinProgress()`

- [ ] **Step 1: 写契约**

Create `src/shared/services/pinyin-progress.ts`:

```ts
import type { LoadState, ReactiveService, ServiceToken } from './core'

/** 关卡 id → 星数(1..3)。未通关的关不出现 —— 「没这个 key」就是「没通关」。 */
export type LevelStars = Readonly<Record<string, number>>

/** 每 user 一份(单档案:整表就一行)。 */
export type PinyinProgressData = Readonly<{
  stars: LevelStars
  /** 星尘累计:连击加成 / 成就奖励 / 幸运奖励都往这加,只增不减。 */
  totalStars: number
}>

export type PinyinProgressSnapshot = LoadState<PinyinProgressData>

/** 一次通关的产出,由关卡结算算出后交给服务落库。 */
export type LevelClear = Readonly<{
  levelId: string
  /** 本次拿到的星(1..3);与旧值取 max 后才入库。 */
  stars: number
  /** 本次产出的星尘(连击加成 + 幸运 + 成就),累加进 totalStars。 */
  starDust: number
}>

export interface PinyinProgressService extends ReactiveService<PinyinProgressSnapshot> {
  load(): Promise<void>
  recordClear(clear: LevelClear): Promise<void>
  resetAll(): Promise<void>
}

export const PinyinProgressService = Symbol('PinyinProgressService') as unknown as ServiceToken<PinyinProgressService>
```

- [ ] **Step 2: 从 barrel 流出**

在 `src/shared/services/index.ts` 的字母序位置加两行：

```ts
export type { LevelStars, LevelClear, PinyinProgressData, PinyinProgressSnapshot } from './pinyin-progress'
export { PinyinProgressService } from './pinyin-progress'
```

- [ ] **Step 3: 改 ApiService 接口（只加不删）**

在 `src/shared/services/api.ts` 里**新增**三个方法：

```ts
import type { PinyinProgressData } from './pinyin-progress'
```

```ts
  getPinyinProgress(): Promise<PinyinProgressData>
  putPinyinProgress(data: PinyinProgressData): Promise<void>
  deletePinyinProgress(): Promise<void>
```

> ⚠ **旧的七个方法（`getProgress` / `putProgress` / `deleteProgress` / `getBasicsProgress` / `putBasicsProgress` / `getChapterProgress` / `putChapterProgress`）与 `ApiWordProgress` 类型本步一律不动。** 它们的消费方（`features/progress/`、`features/foundation/`、`features/qianzigu/`）要到 Task 13 才删 —— 现在摘掉，中间十个 Task 全程 `tsc -b` 红，违反 Global Constraints「每个 Task 结束 tsc 全绿」。**新旧并存十个 Task 是刻意的**，Task 13 随文件一并清。

- [ ] **Step 4: 先写失败的 api 测试**

追加到 `src/features/api/api.test.ts`（照该文件既有的 fake fetcher 写法；`isValid` 会校验响应体，所以假响应必须完整）：

```ts
  it('拼音进度:GET 解析 stars 与 totalStars', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({
      stars: { 'u1-0': 3, 'u2-1': 2 },
      totalStars: 340,
    }))
    const api = createHttpApiService(fetcher)
    await expect(api.getPinyinProgress()).resolves.toEqual({
      stars: { 'u1-0': 3, 'u2-1': 2 },
      totalStars: 340,
    })
  })

  // 响应体不合法时整包被拒 —— 这是刻意的:宁可不写,也不要把半截数据当真相写进服务快照。
  it('拼音进度:响应里星数越界 → 抛 Invalid API response', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ stars: { 'u1-0': 9 }, totalStars: 0 }))
    const api = createHttpApiService(fetcher)
    await expect(api.getPinyinProgress()).rejects.toThrow('Invalid API response')
  })

  it('拼音进度:PUT 发 stars 与 totalStars 两个字段', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    const api = createHttpApiService(fetcher)
    await api.putPinyinProgress({ stars: { 'u1-0': 3 }, totalStars: 30 })
    const [path, init] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/pinyin-progress')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(String(init.body))).toEqual({ stars: { 'u1-0': 3 }, totalStars: 30 })
  })

  it('拼音进度:DELETE 打同一个路径', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ ok: true }))
    const api = createHttpApiService(fetcher)
    await api.deletePinyinProgress()
    const [path, init] = fetcher.mock.calls[0] as [string, RequestInit]
    expect(path).toBe('/api/pinyin-progress')
    expect(init.method).toBe('DELETE')
  })
```

> 若该文件里没有 `jsonResponse` 助手，就用它现有的构造响应写法（形如 `{ ok: true, status: 200, json: async () => payload }`），**照抄同文件里已有的一个用例**，不要新造风格。

- [ ] **Step 5: 跑测试确认失败**

Run: `npx vitest run src/features/api/api.test.ts`
Expected: FAIL — `api.getPinyinProgress is not a function`

- [ ] **Step 6: 实现 http 层**

在 `src/features/api/api.ts` 里删对应旧代码，加：

```ts
import type { PinyinProgressData } from '@/shared/services'

type PinyinProgressResponse = { stars: Record<string, number>; totalStars: number }
```

```ts
/** 星数上限与前端星级判定(1..3)、worker 的 LEVEL_ID/上限三处对齐,有锚定测试防漂移。 */
const LEVEL_ID = /^u\d+-\d+$/

function isLevelStars(value: unknown): value is Record<string, number> {
  if (!isObject(value)) return false
  return Object.entries(value).every(([key, stars]) =>
    LEVEL_ID.test(key) && (stars === 1 || stars === 2 || stars === 3))
}

function isPinyinProgressResponse(value: unknown): value is PinyinProgressResponse {
  return isObject(value)
    && isLevelStars(value.stars)
    && typeof value.totalStars === 'number'
    && Number.isInteger(value.totalStars)
    && value.totalStars >= 0
}
```

```ts
    async getPinyinProgress() {
      const payload = await request('/api/pinyin-progress', {}, isPinyinProgressResponse)
      return { stars: payload.stars, totalStars: payload.totalStars } satisfies PinyinProgressData
    },
    async putPinyinProgress(data) {
      await request('/api/pinyin-progress', {
        method: 'PUT',
        body: JSON.stringify({ stars: data.stars, totalStars: data.totalStars }),
      }, isOkResponse)
    },
    async deletePinyinProgress() {
      await request('/api/pinyin-progress', { method: 'DELETE' }, isOkResponse)
    },
```

- [ ] **Step 7: 跑测试确认通过**

Run: `npx vitest run src/features/api/api.test.ts`
Expected: PASS

- [ ] **Step 8: 提交**

```bash
npx tsc -b
git add src/shared/services/pinyin-progress.ts src/shared/services/index.ts src/shared/services/api.ts src/features/api/api.ts src/features/api/api.test.ts
git commit -m "$(cat <<'EOF'
feat(pinyin): 进度契约与 http 层

PinyinProgressService 契约 + token 一体(LevelStars / PinyinProgressData /
LevelClear)。ApiService 换三个方法,旧的七个先留着(Task 13 随文件一起删)。

响应体校验独立保留 LEVEL_ID 与星数上限字面量(不跨端 import),与 worker、
与前端的星级判定三处对齐。不合法整包拒 —— 宁可不写,也不要把半截数据当
真相写进服务快照。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: pinyin-progress 前端服务

**Files:**
- Create: `src/features/pinyin-progress/pinyin-progress.ts`
- Create: `src/features/pinyin-progress/index.ts`
- Create: `src/features/pinyin-progress/pinyin-progress.test.ts`
- Modify: `src/app/bootstrap.ts`

**Interfaces:**
- Consumes: Task 3 的 `ApiService.getPinyinProgress/putPinyinProgress/deletePinyinProgress`、`PinyinProgressService` 契约
- Produces: `createPinyinProgressService(api, callbacks): PinyinProgressService`

- [ ] **Step 1: 写实现**

Create `src/features/pinyin-progress/pinyin-progress.ts`（照搬旧 `src/features/progress/progress.ts` 的乐观合并 + 串行事务结构，删掉按词的多行逻辑）：

```ts
import type {
  ApiService,
  LevelClear,
  LevelStars,
  PinyinProgressData,
  PinyinProgressService,
  PinyinProgressSnapshot,
} from '@/shared/services'

export interface PinyinProgressCallbacks {
  onUnauthorized(): void
  onError(message: string): void
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown pinyin progress error'
}

function freeze(data: PinyinProgressData): PinyinProgressData {
  return Object.freeze({ stars: Object.freeze({ ...data.stars }), totalStars: data.totalStars })
}

function immutable(next: PinyinProgressSnapshot): PinyinProgressSnapshot {
  const data = freeze(next.data)
  return next.status === 'error'
    ? Object.freeze({ status: 'error', data, error: next.error })
    : Object.freeze({ status: next.status, data })
}

/**
 * 一步通关的合并:星级取 max(只升不降),星尘累加。
 * 星尘累加而非取 max —— 它不是「一个值变好了」,是「又赚了一笔」。
 */
export function mergeClear(data: PinyinProgressData, clear: LevelClear): PinyinProgressData {
  const stars: LevelStars = {
    ...data.stars,
    [clear.levelId]: Math.max(data.stars[clear.levelId] ?? 0, clear.stars),
  }
  return { stars, totalStars: data.totalStars + Math.max(0, clear.starDust) }
}

function mergeInto(base: PinyinProgressData, next: PinyinProgressData): PinyinProgressData {
  const stars: Record<string, number> = { ...base.stars }
  for (const [levelId, value] of Object.entries(next.stars)) {
    stars[levelId] = Math.max(stars[levelId] ?? 0, value)
  }
  return { stars, totalStars: Math.max(base.totalStars, next.totalStars) }
}

export function createPinyinProgressService(
  api: ApiService,
  callbacks: PinyinProgressCallbacks,
): PinyinProgressService {
  let snapshot = immutable({ status: 'idle', data: { stars: {}, totalStars: 0 } })
  let settled = snapshot
  const listeners = new Set<() => void>()
  let nextCommandId = 0
  let latestLoadCommandId = 0
  let latestUserMutationId = 0
  let successfulResetLoadCutoff = 0
  type SaveTransaction = { data: PinyinProgressData; status: 'pending' | 'succeeded' | 'failed' }
  const saves: SaveTransaction[] = []

  function setSnapshot(next: PinyinProgressSnapshot) {
    snapshot = immutable(next)
    listeners.forEach((listener) => listener())
  }

  function startCommand(isUserMutation: boolean): number {
    const commandId = ++nextCommandId
    if (isUserMutation) latestUserMutationId = commandId
    return commandId
  }

  function canPublishLoad(commandId: number): boolean {
    return latestLoadCommandId === commandId
      && latestUserMutationId <= commandId
      && successfulResetLoadCutoff < commandId
  }

  function setStableSnapshot(next: PinyinProgressSnapshot) {
    saves.length = 0
    setSnapshot(next)
    settled = snapshot
  }

  function report(error: unknown) {
    callbacks.onError(errorMessage(error))
  }

  function visibleSnapshot(): PinyinProgressSnapshot {
    let data = settled.data
    let hasVisibleSave = false
    for (const transaction of saves) {
      if (transaction.status === 'failed') continue
      data = mergeInto(data, transaction.data)
      hasVisibleSave = true
    }
    return hasVisibleSave ? { status: 'ready', data } : settled
  }

  function settleSave(transaction: SaveTransaction, status: 'succeeded' | 'failed') {
    if (!saves.includes(transaction)) return
    transaction.status = status
    while (saves[0]?.status !== 'pending' && saves.length > 0) {
      const done = saves.shift()
      if (done?.status === 'succeeded') {
        settled = immutable({ status: 'ready', data: mergeInto(settled.data, done.data) })
      }
    }
    setSnapshot(visibleSnapshot())
    if (saves.length === 0) settled = snapshot
  }

  async function persist(data: PinyinProgressData) {
    startCommand(true)
    const transaction: SaveTransaction = { data: freeze(data), status: 'pending' }
    saves.push(transaction)
    setSnapshot(visibleSnapshot())
    try {
      await api.putPinyinProgress(transaction.data)
      settleSave(transaction, 'succeeded')
    } catch (error) {
      settleSave(transaction, 'failed')
      report(error)
      throw error
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async load() {
      const commandId = startCommand(false)
      latestLoadCommandId = commandId
      const previous = snapshot.data
      setSnapshot({ status: 'loading', data: previous })
      try {
        const data = await api.getPinyinProgress()
        if (!canPublishLoad(commandId)) return
        setStableSnapshot({ status: 'ready', data })
      } catch (error) {
        if (!canPublishLoad(commandId)) return
        setStableSnapshot({ status: 'error', data: previous, error: errorMessage(error) })
        report(error)
      }
    },
    // 提交的是**已 merge 本地的全量** —— 覆盖服务端也不会丢已通关的位(见 worker 注释)。
    async recordClear(clear) {
      await persist(mergeClear(snapshot.data, clear))
    },
    async resetAll() {
      const commandId = startCommand(false)
      try {
        await api.deletePinyinProgress()
        successfulResetLoadCutoff = Math.max(successfulResetLoadCutoff, nextCommandId)
        if (latestUserMutationId <= commandId) {
          setStableSnapshot({ status: 'ready', data: { stars: {}, totalStars: 0 } })
        }
      } catch (error) {
        if (snapshot.status === 'loading') setSnapshot(visibleSnapshot())
        report(error)
        throw error
      }
    },
  }
}
```

Create `src/features/pinyin-progress/index.ts`:

```ts
export { createPinyinProgressService, mergeClear } from './pinyin-progress'
export type { PinyinProgressCallbacks } from './pinyin-progress'
```

- [ ] **Step 2: 先写失败的测试**

Create `src/features/pinyin-progress/pinyin-progress.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'
import { createPinyinProgressService, mergeClear } from './pinyin-progress'
import type { ApiService, PinyinProgressData } from '@/shared/services'

const EMPTY: PinyinProgressData = { stars: {}, totalStars: 0 }

function fakeApi(overrides: Partial<ApiService> = {}): ApiService {
  return {
    getPinyinProgress: vi.fn().mockResolvedValue(EMPTY),
    putPinyinProgress: vi.fn().mockResolvedValue(undefined),
    deletePinyinProgress: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as ApiService
}

const callbacks = { onUnauthorized: vi.fn(), onError: vi.fn() }

describe('拼音进度服务', () => {
  // 重玩拿一星不该把三星冲掉 —— 服务端取 max,本地这一层也必须先取 max。
  it('mergeClear 星级取 max、星尘累加', () => {
    const base: PinyinProgressData = { stars: { 'u1-0': 3 }, totalStars: 10 }
    expect(mergeClear(base, { levelId: 'u1-0', stars: 1, starDust: 5 }))
      .toEqual({ stars: { 'u1-0': 3 }, totalStars: 15 })
    expect(mergeClear(base, { levelId: 'u1-1', stars: 2, starDust: 0 }))
      .toEqual({ stars: { 'u1-0': 3, 'u1-1': 2 }, totalStars: 10 })
  })

  // 服务端确认前就该显示为已通关 —— 孩子拼完抬头看,星星必须已经在那。
  it('recordClear 立刻可见,不必等服务端', async () => {
    let resolvePut: (() => void) | undefined
    const api = fakeApi({
      putPinyinProgress: vi.fn(() => new Promise<void>((resolve) => { resolvePut = () => resolve() })),
    })
    const service = createPinyinProgressService(api, callbacks)
    const pending = service.recordClear({ levelId: 'u1-0', stars: 3, starDust: 10 })
    expect(service.getSnapshot().data.stars['u1-0']).toBe(3)
    expect(service.getSnapshot().data.totalStars).toBe(10)
    resolvePut?.()
    await pending
    expect(service.getSnapshot().data.totalStars).toBe(10)
  })

  it('写失败要报错且乐观值回退', async () => {
    const api = fakeApi({ putPinyinProgress: vi.fn().mockRejectedValue(new Error('boom')) })
    const service = createPinyinProgressService(api, callbacks)
    await expect(service.recordClear({ levelId: 'u1-0', stars: 3, starDust: 10 })).rejects.toThrow('boom')
    expect(service.getSnapshot().data.stars).toEqual({})
  })

  // 重置与 in-flight 的 GET 抢跑:reset 之后落地的旧响应不能把数据复活。
  it('resetAll 之后,抢跑的 load 结果不复活旧数据', async () => {
    let resolveGet: ((data: PinyinProgressData) => void) | undefined
    const api = fakeApi({
      getPinyinProgress: vi.fn(() => new Promise<PinyinProgressData>((resolve) => { resolveGet = resolve })),
    })
    const service = createPinyinProgressService(api, callbacks)
    const loading = service.load()
    await service.resetAll()
    resolveGet?.({ stars: { 'u1-0': 3 }, totalStars: 100 })
    await loading
    expect(service.getSnapshot().data).toEqual({ stars: {}, totalStars: 0 })
  })
})
```

- [ ] **Step 3: 跑测试确认失败，再实现，再确认通过**

Run: `npx vitest run src/features/pinyin-progress/pinyin-progress.test.ts`
Expected: 先 FAIL（模块不存在），实现后 PASS（4 条）

- [ ] **Step 4: 注册服务**

在 `src/app/bootstrap.ts`：

```ts
import { createPinyinProgressService } from '@/features/pinyin-progress'
```

```ts
  PinyinProgressService,
```

（加进 `@/shared/services` 的 import 清单与 `ALL_SERVICE_TOKENS` 数组，保持字母序）

```ts
  registry.register(PinyinProgressService, createPinyinProgressService(api, callbacks))
```

（放在 `registry.register(ChapterService, …)` 之后；`ChapterService` 那一行留到 Task 13 再删）

- [ ] **Step 5: 跑全量测试 + 提交**

```bash
npx tsc -b && npm test
git add src/features/pinyin-progress src/app/bootstrap.ts
git commit -m "$(cat <<'EOF'
feat(pinyin): 进度服务(乐观合并 + 串行事务)

照搬旧按词进度服务那套:写立即可见(孩子拼完抬头看,星星必须已经在那),
失败回退并报错,reset 之后抢跑落地的旧响应不复活数据。

服务端确认前显示的是乐观值,但提交的是「已 merge 本地与服务端的全量」——
worker 那边读-改-写即使被覆盖也不丢已通关的位。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: 进度统计纯函数（解锁与成就口径）

**Files:**
- Create: `src/features/pinyin-blocks/progress-stats.ts`
- Create: `src/features/pinyin-blocks/progress-stats.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `UNITS` / `Level.id`；Task 3 的 `LevelStars`
- Produces: `isUnitUnlocked(unitIndex, stars): boolean`、`completedLevelCount(stars): number`、`perfectLevelCount(stars): number`、`perfectUnitCount(stars): number`、`totalLevelCount(): number`

- [ ] **Step 1: 先写失败的测试**

Create `src/features/pinyin-blocks/progress-stats.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { UNITS } from './levels'
import {
  completedLevelCount,
  isUnitUnlocked,
  perfectLevelCount,
  perfectUnitCount,
  totalLevelCount,
} from './progress-stats'

const firstUnit = UNITS[0]!
const secondUnit = UNITS[1]!

/** 把某个单元的所有关都打到指定星数。 */
function clearUnit(unitIndex: number, stars: number, base: Record<string, number> = {}) {
  const out = { ...base }
  for (const level of UNITS[unitIndex]!.levels) out[level.id] = stars
  return out
}

describe('拼音进度统计', () => {
  it('u1 恒解锁,后面的要前一单元全通关', () => {
    expect(isUnitUnlocked(0, {})).toBe(true)
    expect(isUnitUnlocked(1, {})).toBe(false)
    expect(isUnitUnlocked(1, clearUnit(0, 1))).toBe(true)
    // 一星也算通关 —— 「过了」不等同于「打好了」,不能拿三星当前置门槛
    expect(isUnitUnlocked(1, clearUnit(0, 1))).toBe(true)
  })

  // 前一单元「全」通关:漏一关就不解锁。
  it('前一单元漏一关就不解锁下一单元', () => {
    const partial = clearUnit(0, 3)
    delete partial[firstUnit.levels[firstUnit.levels.length - 1]!.id]
    expect(isUnitUnlocked(1, partial)).toBe(false)
  })

  it('通关数 / 三星数只数到已通关的关', () => {
    expect(completedLevelCount({})).toBe(0)
    expect(perfectLevelCount({})).toBe(0)
    const stars = { ...clearUnit(0, 3), [secondUnit.levels[0]!.id]: 2 }
    expect(completedLevelCount(stars)).toBe(firstUnit.levels.length + 1)
    expect(perfectLevelCount(stars)).toBe(firstUnit.levels.length)
  })

  // 星数 0 或未出现的 key 都算「没通关」,不能混进计数。
  it('星数 0 视同未通关', () => {
    const id = firstUnit.levels[0]!.id
    expect(completedLevelCount({ [id]: 0 })).toBe(0)
    expect(perfectLevelCount({ [id]: 0 })).toBe(0)
  })

  it('全三星的单元才算完美单元', () => {
    expect(perfectUnitCount(clearUnit(0, 2))).toBe(0)
    expect(perfectUnitCount(clearUnit(0, 3))).toBe(1)
    expect(perfectUnitCount({ ...clearUnit(0, 3), ...clearUnit(1, 3) })).toBe(2)
  })

  it('总关卡数与 UNITS 展平后一致', () => {
    expect(totalLevelCount()).toBe(UNITS.reduce((sum, u) => sum + u.levels.length, 0))
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/pinyin-blocks/progress-stats.test.ts`
Expected: FAIL — `Failed to resolve import "./progress-stats"`

- [ ] **Step 3: 写实现**

Create `src/features/pinyin-blocks/progress-stats.ts`：

```ts
// 由星级表派生的统计:解锁、通关数、三星数、完美单元数。
// 地图与成就都从这一份口径取数 —— 两处各算一遍必然漂移。
// 纯函数,不引 React、不引服务。

import type { LevelStars } from '@/shared/services'
import { UNITS, type Unit } from './levels'

/** 一关算不算通:有 key 且星数 ≥ 1。「0 星」与「没这个 key」是同一件事。 */
function cleared(stars: LevelStars, levelId: string): boolean {
  return (stars[levelId] ?? 0) >= 1
}

export function totalLevelCount(units: readonly Unit[] = UNITS): number {
  return units.reduce((sum, unit) => sum + unit.levels.length, 0)
}

export function completedLevelCount(stars: LevelStars, units: readonly Unit[] = UNITS): number {
  return units.reduce(
    (sum, unit) => sum + unit.levels.filter((level) => cleared(stars, level.id)).length,
    0,
  )
}

export function perfectLevelCount(stars: LevelStars, units: readonly Unit[] = UNITS): number {
  return units.reduce(
    (sum, unit) => sum + unit.levels.filter((level) => stars[level.id] === 3).length,
    0,
  )
}

/** 单元内每一关都三星。空单元不算完美(现在没有空单元,但不给未来的自己埋坑)。 */
export function perfectUnitCount(stars: LevelStars, units: readonly Unit[] = UNITS): number {
  return units.filter(
    (unit) => unit.levels.length > 0 && unit.levels.every((level) => stars[level.id] === 3),
  ).length
}

/**
 * 单元是否解锁:u1 恒开,其余要求**前一单元全关通关**。
 * 一星即可 —— 「过了」是解锁的门槛,「打好」是星级的事,两件事不能混。
 */
export function isUnitUnlocked(
  unitIndex: number,
  stars: LevelStars,
  units: readonly Unit[] = UNITS,
): boolean {
  if (unitIndex <= 0) return true
  const previous = units[unitIndex - 1]
  if (!previous) return false
  return previous.levels.every((level) => cleared(stars, level.id))
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/pinyin-blocks/progress-stats.test.ts`
Expected: PASS（6 条）

- [ ] **Step 5: 提交**

```bash
npx tsc -b
git add src/features/pinyin-blocks/progress-stats.ts src/features/pinyin-blocks/progress-stats.test.ts
git commit -m "$(cat <<'EOF'
feat(pinyin-blocks): 进度统计纯函数(解锁 / 通关数 / 三星数)

地图与成就都从这一份口径取数 —— 两处各算一遍必然漂移。

解锁的门槛是一星而非三星:「过了」是通行证,「打好」是星级的事。
星数 0 与「没这个 key」一律视同未通关。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: 星级判定、连错计数与放块事件

**为什么三件一起做**：星级与连击的落点是**同三处**（放错槽 / 点选无槽可落 / 全填后判出错块），分开两个 Task 就是把同几个函数改两遍。

**Files:**
- Modify: `src/features/pinyin-blocks/rules.ts`
- Modify: `src/features/pinyin-blocks/PinyinBlocksGame.tsx`
- Test: `src/features/pinyin-blocks/rules.test.ts`
- Test: `src/features/pinyin-blocks/PinyinBlocksGame.test.tsx`

**Interfaces:**
- Consumes: 无
- Produces: `starsFor(missCount: number): number`（1..3）；`PinyinBlocksGameProps.onSolved?: (stars: number) => void` 取代 `onFinished` 的内部语义；`PinyinBlocksGameProps.onBlock?: (kind: AnswerKind) => void`（`AnswerKind` = `'first' | 'retry' | 'wrong'`，来自 `@/shared/services`）

- [ ] **Step 1: 先写失败判定测试**

追加到 `src/features/pinyin-blocks/rules.test.ts`：

```ts
  // 0 错才给三星 —— 「一次就对」与「错一次再对」是两件事,差在有没有真听出来。
  it('星级按本关错误次数判:0 错三星 / 1-2 错二星 / 更多一星', () => {
    expect(starsFor(0)).toBe(3)
    expect(starsFor(1)).toBe(2)
    expect(starsFor(2)).toBe(2)
    expect(starsFor(3)).toBe(1)
    expect(starsFor(99)).toBe(1)
  })

  // 一星也是通关。孩子不该因为「拿不到三星」而觉得这一关没过。
  it('再错也保底一星,不会出现 0 星', () => {
    for (const miss of [0, 1, 5, 1000]) expect(starsFor(miss)).toBeGreaterThanOrEqual(1)
  })
```

（记得在该文件的 import 里加 `starsFor`）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/pinyin-blocks/rules.test.ts`
Expected: FAIL — `starsFor is not a function`

- [ ] **Step 3: 实现 `starsFor`**

追加到 `src/features/pinyin-blocks/rules.ts` 末尾：

```ts
/**
 * 本关星级。miss = 本关累计的错误次数(放错槽 / 点选无槽可落 / 全填后判出错块)。
 *
 * 一星是**通关**不是失败 —— 判定的下限必须是 1,否则「星级」会变成一道否决题,
 * 而这一关的教学目标(拼出来)其实已经达成了。
 */
export function starsFor(missCount: number): number {
  if (missCount <= 0) return 3
  if (missCount <= 2) return 2
  return 1
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/pinyin-blocks/rules.test.ts`
Expected: PASS

- [ ] **Step 5: 先写失败的组件测试**

追加到 `src/features/pinyin-blocks/PinyinBlocksGame.test.tsx`：

```tsx
  // 「错」= 触发红圈抖动的那件事。三处都要算:放错槽、点选无槽可落、全填后判出错块。
  it('一次不错通关给三星', async () => {
    const onSolved = vi.fn()
    render(<PinyinBlocksGame unitIndex={1} levelIndex={0} speak={vi.fn()} onSolved={onSolved} />)
    solveCorrectly()
    await waitFor(() => expect(onSolved).toHaveBeenCalledWith(3))
  })

  it('放错拖拽算一次错,拿二星', async () => {
    const onSolved = vi.fn()
    mountWithSolved(1, 0, onSolved) // 👨 bà:声母槽要 b,韵母槽要 a
    // 把 b 拖到韵母槽上 —— 放不下,红一下
    const finalSlot = document.querySelector<HTMLElement>('[data-slot-id="s0-f"]') as HTMLElement
    vi.spyOn(document, 'elementFromPoint').mockReturnValue(finalSlot)
    const b = Array.from(document.querySelectorAll<HTMLElement>('[data-block-id]')).find(
      (el) => el.getAttribute('aria-label') === '积木 b',
    )
    fireEvent.pointerDown(b as HTMLElement, { clientX: 10, clientY: 10 })
    fireEvent.pointerMove(window, { clientX: 40, clientY: 40 })
    fireEvent.pointerUp(window, { clientX: 40, clientY: 40 })
    solveCorrectly()
    await waitFor(() => expect(onSolved).toHaveBeenCalledWith(2))
  })
```

> **计时器坑**：`onSolved` 是在成功动画**放完之后**才回调的（`succeed` 里 260ms 判定 + 1600ms 停顿）。`solveCorrectly()` 返回的那一刻它还没被调用 —— 所以必须 `await waitFor(...)`，直接断言必红。嫌慢就照抄同文件那条 `拖到放不下的槽` 用例的 `vi.useFakeTimers()` 包裹写法把时间推快，**不要新造计时器风格**。`waitFor` 要加进文件顶部 `@testing-library/react` 的 import。

```tsx
  // 连击的粒度是「每放一块」,不是「每答一题」—— 孩子的节奏本来就是一块一块搭出来的。
  it('每放一块上报一次:放对 first,放错 wrong', () => {
    const onBlock = vi.fn()
    render(
      <PinyinBlocksGame unitIndex={1} levelIndex={0} speak={vi.fn()} onBlock={onBlock} />,
    )
    // 用声调块当「必定放不下」的那一块:四个调恒全出(bà 只要四声),
    // 所以「声调块 1」在任何题上都无处可落 —— 不受干扰块随机性影响。
    fireEvent.keyDown(screen.getByLabelText('声调块 1'), { key: 'Enter' })
    expect(onBlock).toHaveBeenCalledWith('wrong')
    // 再放对一块
    fireEvent.keyDown(screen.getByLabelText('积木 b'), { key: 'Enter' })
    expect(onBlock).toHaveBeenCalledWith('first')
  })
```

其中 `mountWithSolved` 是本文件新增的 helper（`mount` 的 `onAdvance` 之外多接一个 `onSolved`）：

```tsx
function mountWithSolved(unit: number, level: number, onSolved: (stars: number) => void) {
  const speak = vi.fn()
  const utils = render(
    <PinyinBlocksGame unitIndex={unit} levelIndex={level} speak={speak} onSolved={onSolved} />,
  )
  return { ...utils, speak }
}
```

（这条不涉及计时器 —— `onBlock` 在按下的一刻同步触发，与成功动画无关。）

- [ ] **Step 6: 跑测试确认失败**

Run: `npx vitest run src/features/pinyin-blocks/PinyinBlocksGame.test.tsx`
Expected: FAIL — `onSolved` 未被调用（组件还没有这个 prop）

- [ ] **Step 7: 在 `PinyinRound` 里计数并上报**

`src/features/pinyin-blocks/PinyinBlocksGame.tsx` 的 `PinyinRound` 内：

```tsx
import { starsFor, /* …既有 import */ } from './rules'
```

```tsx
  /** 本关累计错误次数。星级靠它,提示回强也靠它 —— 「卡住了」是同一种信号。 */
  const [missCount, setMissCount] = useState(0)
  const missRef = useRef(0)
  /** 同步计数:placeBlock 的闭包里读到的是旧 state,而判定发生在同一次调用里。 */
  function noteMiss() {
    missRef.current += 1
    setMissCount(missRef.current)
  }
```

三处 `noteMiss()`（都在 `status === 'playing'` 的路径上）：

```tsx
      if (!canPlace(block, slot)) {
        noteMiss()
        playSound?.('wrong')
        flashReject(slotId)
        return
      }
```

```tsx
      const target = autoTargetId(block, slots, placement)
      if (target) placeBlock(blockId, target)
      else {
        noteMiss()
        playSound?.('wrong')
      }
```

```tsx
      if (wrong.length === 0) {
        clearTimer()
        timer.current = window.setTimeout(succeed, 260)
        return
      }
      noteMiss()
      setStatus('wrong')
```

`succeed` 改为把星数交出去：

```tsx
  const succeed = useCallback(() => {
    setStatus('solved')
    playSound?.('victory')
    speak(level.read)
    setBurst(true)
    const stars = starsFor(missRef.current)
    timer.current = window.setTimeout(
      () => {
        setBurst(false)
        onSolved(stars)
      },
      welded ? 2100 : 1600,
    )
  }, [level, onSolved, playSound, speak, welded])
```

- [ ] **Step 7b: 接上连击的触发点**

连击的粒度从「词课每答一题」改成「**每放一块**」—— 孩子的节奏本来就是一块一块搭出来的，不是一题一题答出来的。组件不碰服务，照 `speak` / `playSound` 的样子用回调透出：

```tsx
import type { AnswerKind } from '@/shared/services'
```

`PinyinBlocksGameProps` / `RoundProps` 加 `onBlock?: (kind: AnswerKind) => void`。三处 `noteMiss()` **旁边**各加一行（同一次判定，两件事一起说）：

```tsx
      if (!canPlace(block, slot)) {
        noteMiss()
        onBlock?.('wrong')
        playSound?.('wrong')
        flashReject(slotId)
        return
      }
```

```tsx
      const target = autoTargetId(block, slots, placement)
      if (target) placeBlock(blockId, target)
      else {
        noteMiss()
        onBlock?.('wrong')
        playSound?.('wrong')
      }
```

```tsx
      noteMiss()
      onBlock?.('wrong')
      setStatus('wrong')
```

放对的那一处（`canPlace` 通过之后）：

```tsx
      playSound?.('tap')
      onBlock?.('first')
      const next: Record<string, string> = { ...placement }
```

`RoundProps` / `PinyinBlocksGameProps` 的 `onFinished: () => void` → `onSolved: (stars: number) => void`，外壳透传：

```tsx
export type PinyinBlocksGameProps = {
  speak: (text: string) => void
  playSound?: (cue: 'correct' | 'wrong' | 'victory' | 'tap') => void
  /** 每放一块上报一次 —— 连击靠它驱动。放对 'first',放错 'wrong'。 */
  onBlock?: (kind: AnswerKind) => void
  unitIndex?: number
  levelIndex?: number
  /** 通关:交出本关星级(1..3),由入口页负责落库与推进。 */
  onSolved?: (stars: number) => void
  onAdvance?: (unit: number, level: number) => void
}
```

`PinyinBlocksGame` 外壳里 `onFinished` 的落点分两种情况 —— **两者只能跑一个**，否则 `advance` 里的 `setRound(r => r + 1)` 会把刚结算完的那一关重挂一次（表现是闪一下、发牌换一副）：

```tsx
  const unit = unitIndex ?? self.unit
  const level = levelIndex ?? self.level

  /** 关内自己往下走(试玩路径)。由外层控关时不动 —— 那是 LevelEntry 的事。 */
  const advance = () => {
    const u = UNITS[unit] ?? UNITS[0]!
    const next =
      level + 1 < u.levels.length ? { unit, level: level + 1 } : { unit: (unit + 1) % UNITS.length, level: 0 }
    setRound((r) => r + 1)
    if (unitIndex === undefined) setSelf(next)
    onAdvance?.(next.unit, next.level)
  }

  return (
    <PinyinRound
      // 关卡换了要重挂:key 带上 level,重玩同一关时靠 round 区分
      key={`${unit}-${level}-${round}`}
      unitIdx={unit}
      lvlIdx={level}
      round={round}
      speak={speak}
      playSound={playSound}
      onBlock={onBlock}
      // 有 onSolved 就归外层管(结算 + 推进),没有才走自走逻辑
      onSolved={(stars) => {
        if (onSolved) onSolved(stars)
        else advance()
      }}
    />
  )
```

- [ ] **Step 8: 跑测试确认通过**

Run: `npx vitest run src/features/pinyin-blocks/PinyinBlocksGame.test.tsx`
Expected: PASS。既有那条 `点对块会落位,拼齐后亮出拼音答案` 若断言了 `onFinished`，一并改成 `onSolved`。

- [ ] **Step 9: 提交**

```bash
npx tsc -b && npm test
git add src/features/pinyin-blocks/rules.ts src/features/pinyin-blocks/rules.test.ts src/features/pinyin-blocks/PinyinBlocksGame.tsx src/features/pinyin-blocks/PinyinBlocksGame.test.tsx
git commit -m "$(cat <<'EOF'
feat(pinyin-blocks): 星级判定与连错计数

一关的历史 = 本关错了多少次。三处都算「错」:放错槽、点选无槽可落、
全填后判出错块 —— 也就是会触发红圈抖动的那三件事。

0 错三星 / 1-2 错二星 / 更多一星,下限恒为 1:一星是**通关**不是失败,
否则星级就成了一道否决题,而这关的教学目标(拼出来)其实已经达成。

计数走 ref 同步 —— placeBlock 的闭包里读到的是旧 state,而判定发生在
同一次调用里,异步 setState 会漏记。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: 提示三档收敛成两个 CSS 变量

**Files:**
- Modify: `src/index.css`
- Modify: `src/features/pinyin-blocks/blocks.ts`
- Modify: `src/features/pinyin-blocks/PinyinBlocksGame.tsx`
- Test: `src/features/pinyin-blocks/material.test.ts`
- Test: `src/features/pinyin-blocks/levels.test.ts`

**Interfaces:**
- Consumes: Task 6 的 `missCount`
- Produces: `Hint` 类型、`HINT_BY_UNIT` 表、`hintFor(unitId, missCount): Hint`；CSS 变量 `--slot-line` / `--slot-fill` 与容器类 `.pslots` / `.pslots--mid` / `.pslots--weak`

- [ ] **Step 1: 先写失败的纯函数测试**

追加到 `src/features/pinyin-blocks/levels.test.ts`：

```ts
  // 脚手架要随课程撤掉 —— 到最后一关还全染色,颜色就成了拐杖。
  it('每个单元都有提示基线,且随课程递减不回头', () => {
    const order = { strong: 0, mid: 1, weak: 2 } as const
    let previous = -1
    for (const u of UNITS) {
      const hint = HINT_BY_UNIT[u.id]
      expect(hint, `${u.id} 缺提示基线`).toBeDefined()
      const rank = order[hint as keyof typeof order]
      expect(rank, `${u.id} 的提示比上一单元更强 —— 脚手架回头了`).toBeGreaterThanOrEqual(previous)
      previous = rank
    }
  })

  // 连错回强是「救急垫脚石」,不是存档:它只该让提示变强,不该让它变弱。
  it('连错 2 次把提示提到强档,且只升不降', () => {
    for (const u of UNITS) {
      const base = hintFor(u.id, 0)
      expect(hintFor(u.id, 1)).toBe(base)
      expect(hintFor(u.id, 2)).toBe('strong')
      expect(hintFor(u.id, 7)).toBe('strong')
    }
  })
```

（该文件 import 里加 `HINT_BY_UNIT, hintFor`）

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/pinyin-blocks/levels.test.ts`
Expected: FAIL — `hintFor is not a function`

- [ ] **Step 3: 在 blocks.ts 里加表与函数**

追加到 `src/features/pinyin-blocks/blocks.ts`：

```ts
/* ---------------------------------------------------------- 提示强度 */

/**
 * 空槽提示的三档。梯度是**染色深浅**,不是「染不染」——
 * 旧版 mid 与 weak 只差 2% 墨色,肉眼分不出,等于只有两档。
 */
export type Hint = 'strong' | 'mid' | 'weak'

/**
 * 每个单元的提示基线。脚手架随课程推进撤掉(u1-u3 强 → u4-u5 中 → u6-u7 弱),
 * 跟难度曲线同步,而不是孩子一进关就面对满屏颜色。
 */
export const HINT_BY_UNIT: Readonly<Record<string, Hint>> = {
  u1: 'strong', u2: 'strong', u3: 'strong',
  u4: 'mid', u5: 'mid',
  u6: 'weak', u7: 'weak',
}

/**
 * 本关此刻的提示档。连错 2 次临时提到强档 —— 脚手架既要会撤,也要能回来。
 * 只升不降:卡住时把颜色加回来,不会在孩子答对几次后又抽走。
 * 表里没有的单元 id 兜底强档(宁可多给线索,也不要让新单元变成一块灰砖)。
 */
export function hintFor(unitId: string, missCount: number): Hint {
  if (missCount >= 2) return 'strong'
  return HINT_BY_UNIT[unitId] ?? 'strong'
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/pinyin-blocks/levels.test.ts`
Expected: PASS

- [ ] **Step 5: 改 CSS**

在 `src/index.css` 的凹槽段，把 `.pslot` 一组替换为下面这版（**关键：五套类型规则一律消费 `--slot-line` / `--slot-fill`，档位只改容器上的两个值**）：

```css
/* ---- 凹槽 ---- */
.pslot {
  position: relative;
  border-radius: var(--radius-2xl);
  /* 类型色按 --slot-line 的比例混进中性色。0% 时整条退回中性 —— 弱档就是这样来的,
     不必再有一条 .pslot--plain 把每套规则复制一遍。 */
  --slot-base-line: color-mix(in srgb, var(--color-ink) 16%, transparent);
  border: 3px dashed var(--slot-base-line);
  background-color: color-mix(in srgb, var(--color-surface) 46%, transparent);
  transition: border-color 0.18s, background-color 0.18s, transform 0.12s;
}
.pslot--tone { border-radius: 999px; }

/* 提示强度:三档只调容器上这两个变量,块类型规则一律照读。
   强 55/12 → 中 30/6 → 弱 0/0。 */
.pslots        { --slot-line: 55%; --slot-fill: 12%; }
.pslots--mid   { --slot-line: 30%; --slot-fill: 6%; }
.pslots--weak  { --slot-line: 0%;  --slot-fill: 0%; }

.pslot--initial {
  border-color: color-mix(in srgb, var(--color-block-initial) var(--slot-line), var(--slot-base-line));
  background-color: color-mix(in srgb, var(--color-block-initial) var(--slot-fill), transparent);
}
/* 介母槽:跟介母块同一套斜切双色(角度与两端停点必须一致,两边一漂移孩子就对不上号),
   只是化成淡版 —— 浓了就像个已经填好的槽。
   斜切只能由背景承载:CSS 的 dashed 边框不吃渐变,border-image 会把虚线变成实线。
   边框取介母定色版的淡版,是这套双色里唯一能用的单色。 */
.pslot--medial {
  border-color: color-mix(in srgb, var(--color-block-medial) var(--slot-line), var(--slot-base-line));
  background-color: transparent;
  background-image: linear-gradient(
    118deg,
    color-mix(in srgb, var(--color-block-initial-edge) var(--slot-fill), transparent) 0 48%,
    color-mix(in srgb, var(--color-block-final-edge) var(--slot-fill), transparent) 52% 100%
  );
}
.pslot--final {
  border-color: color-mix(in srgb, var(--color-block-final) var(--slot-line), var(--slot-base-line));
  background-color: color-mix(in srgb, var(--color-block-final) var(--slot-fill), transparent);
}
.pslot--nasal {
  border-color: color-mix(in srgb, var(--color-block-nasal) var(--slot-line), var(--slot-base-line));
  background-color: color-mix(in srgb, var(--color-block-nasal) var(--slot-fill), transparent);
}
.pslot--tone {
  border-color: color-mix(in srgb, var(--color-gold-edge) var(--slot-line), var(--slot-base-line));
  background-color: color-mix(in srgb, var(--color-gold) var(--slot-fill), transparent);
}
```

**删掉整条 `.pslot--plain`**（它的存在本身就是「每加一档就要复制五条规则」这个问题的产物）。

- [ ] **Step 6: 改组件接线**

`PinyinBlocksGame.tsx`：

- 删掉 `PinyinBlocksGameProps.hint` 与 `RoundProps.hint`
- **`hint` 从 props 换成组件自算**：`PinyinRound` 内 `const hint = hintFor(unit.id, missCount)`（`missCount` 来自 Task 6）
- `PinyinRound` 内计算：`const hint = hintFor(unit.id, missCount)`
- 拼装台容器挂提示类：

```tsx
      <div
        role="group"
        aria-label="拼装台"
        className={cn(
          'pslots flex min-h-[7.5rem] items-end justify-center gap-1',
          hint === 'mid' && 'pslots--mid',
          hint === 'weak' && 'pslots--weak',
        )}
      >
```

- **[必做，否则 `tsc -b` 立刻红]** 同一步里修剪 `src/features/pinyin-blocks/PinyinBlocksEntry.tsx` —— 它此刻正在传 `hint={hint}`（`:98`），而 `hint` prop 刚被删掉。删三样：`const [hint, setHint] = useState<Hint>('strong')`、试玩控制台里那组三档提示按钮、以及 `hint={hint}` 传参。该文件 Task 12 会整个删除，所以这只是一次三行的临时修剪，不是重复劳动。
- 删掉该文件顶部 `type Hint = ...`（若因删按钮而失去引用）

- `renderSlot` 的空槽分支简化为一条（类型类**恒挂**，浓淡交给变量）：

```tsx
          // 类型类恒挂:强/中/弱是染色深浅的差别,由容器上的两个变量决定,不是挂不挂类。
          !block && (isTone ? 'pslot--tone' : `pslot--${slot.type}`),
```

- [ ] **Step 7: 改写材质护栏**

`src/features/pinyin-blocks/material.test.ts`：把「介母槽用与介母块同参数的斜切双色」一条里的透明度断言换成变量断言，并新增一条三档护栏：

```ts
  // 三档提示只该由容器上的两个变量表达。再冒出一条 .pslot--plain 这类复制规则,
  // 就说明有人又按「一档一套规则」写了 —— 那是这套变量要解决的问题本身。
  it('提示三档只调容器上的两个变量,没有按档复制的槽规则', () => {
    for (const cls of ['.pslots ', '.pslots--mid ', '.pslots--weak ']) {
      const start = css.indexOf(cls)
      expect(start, cls).toBeGreaterThan(-1)
      const rule = css.slice(start, css.indexOf('}', start))
      expect(rule, cls).toContain('--slot-line:')
      expect(rule, cls).toContain('--slot-fill:')
    }
    // 弱档把线宽置 0 → 类型色整条退回中性,不需要另一条规则来「撤掉颜色」
    const weak = css.slice(css.indexOf('.pslots--weak '), css.indexOf('}', css.indexOf('.pslots--weak ')))
    expect(weak).toContain('--slot-line: 0%')
    expect(css).not.toContain('.pslot--plain')

    // 五套类型规则一律读这两个变量,谁自己写死百分比谁就是漏网的
    for (const cls of ['pblock--initial', 'pblock--medial', 'pblock--final', 'pblock--nasal', 'pblock--tone']) {
      const i = css.indexOf(`.pslot--${cls.replace('pblock--', '')} {`)
      expect(i, cls).toBeGreaterThan(-1)
      expect(css.slice(i, css.indexOf('}', i))).toContain('var(--slot-line)')
    }
  })
```

并把原「介母槽」用例里的：

```ts
    const alphas = [...ruleOf('.pslot--medial {').matchAll(/edge\)\s*(\d+)%,\s*transparent/g)].map((m) => Number(m[1]))
    expect(alphas, '两个端点色各要一条淡版').toHaveLength(2)
    for (const a of alphas) expect(a, '太浓就像填好的槽').toBeLessThanOrEqual(25)
```

换成：

```ts
    // 两个端点色各要一条淡版,且浓度由容器变量给 —— 写死百分比就拿不到三档了
    const stops = [...ruleOf('.pslot--medial {').matchAll(/edge\)\s*var\(--slot-fill\)/g)]
    expect(stops, '两个端点色各要一条淡版').toHaveLength(2)
```

- [ ] **Step 8: 改写组件里的提示测试**

`PinyinBlocksGame.test.tsx` 里两条按 `hint` prop 断言的老用例（`提示档「弱」…` / `提示档「强」…`）改为按容器类断言：

```tsx
  it('提示档「强」:容器不带降档类,空槽恒挂类型类', () => {
    render(<PinyinBlocksGame unitIndex={1} levelIndex={0} speak={vi.fn()} />) // u2 = 强档
    const stage = screen.getByLabelText('拼装台')
    expect(stage.classList.contains('pslots')).toBe(true)
    expect(stage.classList.contains('pslots--mid')).toBe(false)
    expect(stage.classList.contains('pslots--weak')).toBe(false)
    expect(document.querySelector('.pslot--initial')).not.toBeNull()
  })

  it('提示档「弱」:容器带降档类,颜色由变量归零', () => {
    render(<PinyinBlocksGame unitIndex={6} levelIndex={0} speak={vi.fn()} />) // u7 = 弱档
    const stage = screen.getByLabelText('拼装台')
    expect(stage.classList.contains('pslots--weak')).toBe(true)
    // 类型类仍在(slot 的语义没变),浓淡交给 --slot-line/--slot-fill
    expect(document.querySelector('.pslot--initial, .pslot--final')).not.toBeNull()
  })

  // 脚手架既要会撤,也要能回来 —— 卡住的时候颜色得回来。
  it('同一关连错 2 次,容器回强档', () => {
    render(<PinyinBlocksGame unitIndex={6} levelIndex={0} speak={vi.fn()} />) // u7 = 弱档
    const stage = () => screen.getByLabelText('拼装台')
    expect(stage().classList.contains('pslots--weak')).toBe(true)
    // 声调块恒四调全出,xī guā 两句都是阴平 → 「声调块 2」必定无处可落。
    // 用它而不是干扰块:干扰块由 makeRng 决定,拿它当判据等于把测试绑在发牌上。
    const wrong = screen.getByLabelText('声调块 2')
    fireEvent.keyDown(wrong, { key: 'Enter' })
    expect(stage().classList.contains('pslots--weak'), '错 1 次还不回强').toBe(true)
    fireEvent.keyDown(wrong, { key: 'Enter' })
    expect(stage().classList.contains('pslots--weak'), '错 2 次该回强').toBe(false)
    expect(stage().classList.contains('pslots--mid')).toBe(false)
  })
```

- [ ] **Step 9: 跑测试 + 提交**

```bash
npx tsc -b && npm test
git add src/index.css src/features/pinyin-blocks/blocks.ts src/features/pinyin-blocks/levels.test.ts src/features/pinyin-blocks/material.test.ts src/features/pinyin-blocks/PinyinBlocksGame.tsx src/features/pinyin-blocks/PinyinBlocksGame.test.tsx
git commit -m "$(cat <<'EOF'
feat(pinyin-blocks): 提示三档收敛成两个 CSS 变量

旧版 mid 与 weak 只差 2% 墨色,肉眼分不出 —— 等于只有两档,还白养了
一条 .pslot--plain(它是「每加一档就要复制五条规则」这个问题的产物)。

现在档位只改容器上的 --slot-line / --slot-fill,五套 .pslot--* 一律消费
它们;弱档把线宽置 0,类型色整条退回中性,不需要另一条规则来「撤掉颜色」。

档位按单元走(u1-u3 强 → u4-u5 中 → u6-u7 弱),脚手架随课程撤掉;
连错 2 次临时回强 —— 既要会撤,也要能回来。只升不降。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: 单元地图

**Files:**
- Create: `src/features/pinyin-blocks/UnitMap.tsx`
- Create: `src/features/pinyin-blocks/UnitMap.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `Unit.badge`、Task 5 的统计函数、Task 3 的 `LevelStars`
- Produces: `<UnitMap stars={LevelStars} totalStars={number} onPick={(unitIndex: number) => void} onOpenParent={() => void} />`

- [ ] **Step 1: 先写失败的测试**

Create `src/features/pinyin-blocks/UnitMap.test.tsx`：

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { UNITS } from './levels'
import { UnitMap } from './UnitMap'

describe('拼音单元地图', () => {
  it('七个单元各占一格,名片用真积木渲染', () => {
    render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cells = document.querySelectorAll('[data-unit-id]')
    expect(cells).toHaveLength(UNITS.length)
    // 名片是块本体,不是 emoji、不是文字
    expect(cells[0]?.querySelectorAll('.pblock').length).toBe(UNITS[0]!.badge.length)
  })

  // 零文本:孩子读不出「单韵母」三个字,格子只能靠块自表意。
  it('标题与单元名等汉字不出现在地图上', () => {
    const { container } = render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const map = container.querySelector('[data-unit-map]')
    expect(map?.textContent ?? '').not.toMatch(/[一-鿿]/)
  })

  it('只解锁 u1:其余格子锁上且点不动', () => {
    const onPick = vi.fn()
    render(<UnitMap stars={{}} totalStars={0} onPick={onPick} onOpenParent={vi.fn()} />)
    const cells = document.querySelectorAll<HTMLElement>('[data-unit-id]')
    expect(cells[0]?.dataset.locked).toBe('false')
    expect(cells[1]?.dataset.locked).toBe('true')
    fireEvent.click(cells[1] as HTMLElement)
    expect(onPick).not.toHaveBeenCalled()
    fireEvent.click(cells[0] as HTMLElement)
    expect(onPick).toHaveBeenCalledWith(0)
  })

  // 一格里的星位 = 该单元的关卡数;亮几颗 = 通了几关。
  // 不画「本关几星」—— 格子放不下 3-7 组三星,而且地图该答的是「这格过了多少」。
  it('通关的格子亮起对应颗数,没通的留着暗星位', () => {
    const unit = UNITS[0]!
    const stars = { [unit.levels[0]!.id]: 2, [unit.levels[1]!.id]: 1 }
    render(<UnitMap stars={stars} totalStars={20} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cell = document.querySelector<HTMLElement>('[data-unit-id="u1"]')
    expect(cell?.querySelectorAll('.pstar')).toHaveLength(unit.levels.length)
    expect(cell?.querySelectorAll('.pstar--on')).toHaveLength(2)
    // 进度数字与亮星数一致
    expect(cell?.textContent).toContain(`2/${unit.levels.length}`)
  })

  it('零星的关只留暗星位', () => {
    const unit = UNITS[0]!
    render(<UnitMap stars={{ [unit.levels[0]!.id]: 0 }} totalStars={0} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    const cell = document.querySelector<HTMLElement>('[data-unit-id="u1"]')
    expect(cell?.querySelectorAll('.pstar--on')).toHaveLength(0)
    expect(cell?.textContent).toContain(`0/${unit.levels.length}`)
  })

  it('星尘计数显示在顶部', () => {
    render(<UnitMap stars={{}} totalStars={340} onPick={vi.fn()} onOpenParent={vi.fn()} />)
    expect(screen.getByLabelText('星尘 340')).toBeInTheDocument()
  })

  it('齿轮开家长面板', () => {
    const onOpenParent = vi.fn()
    render(<UnitMap stars={{}} totalStars={0} onPick={vi.fn()} onOpenParent={onOpenParent} />)
    fireEvent.click(screen.getByLabelText('家长'))
    expect(onOpenParent).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/pinyin-blocks/UnitMap.test.tsx`
Expected: FAIL — `Failed to resolve import "./UnitMap"`

- [ ] **Step 3: 写地图**

Create `src/features/pinyin-blocks/UnitMap.tsx`：

```tsx
import { Settings, Star } from 'lucide-react'
import type { LevelStars } from '@/shared/services'
import { cn } from '@/shared/ui/utils'
import { BlockChip } from './BlockChip'
import { UNITS } from './levels'
import { isUnitUnlocked } from './progress-stats'

export type UnitMapProps = {
  stars: LevelStars
  totalStars: number
  onPick(unitIndex: number): void
  onOpenParent(): void
}

/** 格子里名片的块尺寸:比游戏内小一档(u7 的名片有 5 块,按原尺寸会撑破格子)。 */
const BADGE_BOX = 'h-9 w-9 text-[1rem]'

/**
 * 单元地图。**零文本** —— 格子靠名片积木自表意,不写「单韵母」这类字:
 * 4-8 岁的孩子读不出它们,而积木是他刚在游戏里摸过的东西。
 */
export function UnitMap({ stars, totalStars, onPick, onOpenParent }: UnitMapProps) {
  return (
    <div data-unit-map className="min-h-screen px-4 pb-10 pt-4">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <span
          aria-label={`星尘 ${totalStars}`}
          className="flex items-center gap-1.5 rounded-full border border-hairline bg-surface/70 px-3 py-1.5"
        >
          <Star className="h-4 w-4 text-gold" aria-hidden />
          <span className="text-base font-extrabold tabular-nums">{totalStars}</span>
        </span>
        <button
          type="button"
          onClick={onOpenParent}
          aria-label="家长"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/70 text-ink-2"
        >
          <Settings className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="mx-auto mt-6 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-3">
        {UNITS.map((unit, index) => {
          const locked = !isUnitUnlocked(index, stars)
          const earned = unit.levels.map((level) => stars[level.id] ?? 0)
          const gained = earned.filter((n) => n > 0).length
          return (
            <button
              key={unit.id}
              type="button"
              data-unit-id={unit.id}
              data-locked={locked ? 'true' : 'false'}
              aria-label={`第 ${index + 1} 单元`}
              aria-disabled={locked}
              onClick={() => {
                if (locked) return
                onPick(index)
              }}
              className={cn(
                'flex flex-col items-center gap-2 rounded-4xl border-2 border-hairline bg-surface p-4 shadow-card transition-transform',
                locked ? 'opacity-45' : 'hover:border-accent/60 active:scale-[0.98]',
              )}
            >
              <span className="flex min-h-9 items-center gap-1">
                {unit.badge.map((block, i) => (
                  <BlockChip
                    key={`${block.type}-${block.value}-${i}`}
                    type={block.type}
                    value={block.value}
                    className={BADGE_BOX}
                  />
                ))}
              </span>
              {/* 星排:已通关的关各占一颗,颜色由 CSS 的 --pb 一族之外的 .pstar 给 */}
              <span className="flex min-h-4 items-center gap-0.5" aria-hidden>
                {unit.levels.map((level, i) => (
                  <span
                    key={level.id}
                    className={cn('pstar', (earned[i] ?? 0) > 0 && 'pstar--on')}
                  >
                    ★
                  </span>
                ))}
              </span>
              <span className="text-xs font-bold text-ink-3 tabular-nums">
                {gained}/{unit.levels.length}
              </span>
              {locked ? <span aria-hidden className="text-lg">🔒</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 补 `.pstar` 材质**

在 `src/index.css` 拼音积木材质段内加（走 token，禁字面量）：

```css
/* 地图格子上的星:未通关是空壳,通关才填色 —— 形状先给,颜色后给，
   一眼能看出「这格过了几关」而不只是「过没过」。 */
.pstar {
  font-size: 0.9rem;
  line-height: 1;
  color: color-mix(in srgb, var(--color-ink) 14%, transparent);
}
.pstar--on {
  color: var(--color-gold);
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/features/pinyin-blocks/UnitMap.test.tsx`
Expected: PASS（6 条）

- [ ] **Step 6: 提交**

```bash
npx tsc -b
git add src/features/pinyin-blocks/UnitMap.tsx src/features/pinyin-blocks/UnitMap.test.tsx src/index.css
git commit -m "$(cat <<'EOF'
feat(pinyin-blocks): 单元地图(名片块 + 解锁 + 星)

零文本:格子靠名片积木自表意,不写「单韵母」这类字 —— 4-8 岁读不出它们,
而积木是他刚在游戏里摸过的东西。名片缩一档,u7 的五块才放得下。

锁定格整块去饱和 + 🔒,点了不进去(只抖不报错,报错也没人读得懂)。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: 家长面板

**Files:**
- Create: `src/app/ParentPanel.tsx`
- Create: `src/app/ParentPanel.test.tsx`

**Interfaces:**
- Consumes: `AuthService.logout()`、Task 4 的 `PinyinProgressService.resetAll()`
- Produces: `<ParentPanel onClose={() => void} />`（在 `app/` 内用 `useService`，那边不受 feature 的 `*Entry.tsx` 限制）

- [ ] **Step 1: 先写失败的测试**

Create `src/app/ParentPanel.test.tsx`：

```tsx
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/app/ParentPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "./ParentPanel"`

- [ ] **Step 3: 写面板**

Create `src/app/ParentPanel.tsx`：

```tsx
import { X } from 'lucide-react'
import { AuthService, PinyinProgressService } from '@/shared/services'
import { useService } from '@/shared/services/core'
import { Button } from '@/shared/ui/button'

/**
 * 家长面板。**这一页可以写字** —— 它是给大人用的,不是给孩子用的。
 * 装的全是孩子不该碰的东西:登出、清空进度。
 */
export function ParentPanel({ onClose }: { onClose(): void }) {
  const auth = useService(AuthService)
  const progress = useService(PinyinProgressService)

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
      <div className="relative w-full max-w-sm rounded-[1.75rem] border border-hairline bg-surface p-5 shadow-pop">
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
        <Button size="lg" className="mt-4 w-full" onClick={onClose}>
          完成
        </Button>
      </div>
    </div>
  )
}
```

（`outline` / `destructive` 是 `src/shared/ui/button.tsx` 里已有的 variant —— 别自己拼颜色类。）

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/app/ParentPanel.test.tsx`
Expected: PASS（3 条）

- [ ] **Step 5: 提交**

```bash
npx tsc -b
git add src/app/ParentPanel.tsx src/app/ParentPanel.test.tsx
git commit -m "$(cat <<'EOF'
feat(app): 家长面板(登出 + 重置进度)

这两件事原本挂在字母林首页,随词课一起消失 —— 得有新家。
面板是给大人用的,所以这一页可以写字;孩子的地图页仍然零文本。

清空进度不可逆,先 confirm 再动。服务自身已 toast 报错,这里不重复打扰。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: 成就目录换锚

**Files:**
- Modify: `src/shared/services/achievements.ts`
- Modify: `src/features/achievements/achievements.ts`
- Test: `src/features/achievements/achievements.test.ts`

**Interfaces:**
- Consumes: 无（纯数据 + 纯函数）
- Produces: 新 `AchievementState`（`totalLevels` / `completedLevels` / `perfectLevels` / `perfectUnits` / `maxCombo` / `firstCompleteToday` / `consecutiveDays` / `hour`）；`checkAchievements(state, earned)` 签名不变

- [ ] **Step 1: 改契约**

`src/shared/services/achievements.ts` 的 `AchievementState` 换成：

```ts
/** 成就判定的输入。全部由关卡进度与设置派生 —— 没有一项来自词库。 */
export type AchievementState = Readonly<{
  /** 全部关卡数。 */
  totalLevels: number
  /** 通过的关数(星数 ≥ 1)。 */
  completedLevels: number
  /** 三星关数。 */
  perfectLevels: number
  /** 单元内全三星的单元数。 */
  perfectUnits: number
  maxCombo: number
  /** 本次会话首通的关数。 */
  firstCompleteToday: number
  consecutiveDays: number
  /** 当前小时(0..23),给早晚成就用。 */
  hour: number
}>
```

- [ ] **Step 2: 先写失败的测试**

改写 `src/features/achievements/achievements.test.ts` 里绑定旧字段的用例，并新增：

```ts
const BASE: AchievementState = {
  totalLevels: 37,
  completedLevels: 0,
  perfectLevels: 0,
  perfectUnits: 0,
  maxCombo: 0,
  firstCompleteToday: 0,
  consecutiveDays: 0,
  hour: 12,
}

describe('成就目录 · 换锚到关卡', () => {
  it('目录里没有一条依赖词库口径(词数 / 分类)', () => {
    const source = readFileSync(join(process.cwd(), 'src/features/achievements/achievements.ts'), 'utf8')
    for (const banned of ['completedWords', 'totalWords', 'categoryDone', 'perfectWords']) {
      expect(source, `成就目录还在引用词课字段 ${banned}`).not.toContain(banned)
    }
  })

  it('零错一关解锁「完美主义」', () => {
    const earned = checkAchievements({ ...BASE, perfectLevels: 1 }, []).map((a) => a.id)
    expect(earned).toContain('perfect_level')
  })

  it('连击 15 仍然原样可解锁', () => {
    expect(checkAchievements({ ...BASE, maxCombo: 15 }, []).map((a) => a.id)).toContain('combo_15')
  })

  it('一次会话首通 5 关解锁「马拉松」', () => {
    expect(checkAchievements({ ...BASE, firstCompleteToday: 5 }, []).map((a) => a.id)).toContain('marathon')
  })

  it('一个单元全三星解锁「收集者」', () => {
    expect(checkAchievements({ ...BASE, perfectUnits: 1 }, []).map((a) => a.id)).toContain('collector')
  })

  it('全部关卡通关解锁「大法师」', () => {
    expect(checkAchievements({ ...BASE, completedLevels: 37 }, []).map((a) => a.id)).toContain('grand_master')
    expect(checkAchievements({ ...BASE, completedLevels: 36 }, []).map((a) => a.id)).not.toContain('grand_master')
  })

  it('已领过的不重发', () => {
    expect(checkAchievements({ ...BASE, perfectLevels: 1 }, ['perfect_level'])).toEqual([])
  })
})
```

（记得 import `readFileSync` / `join`，与 `checkAchievements`、`AchievementState`）

- [ ] **Step 3: 跑测试确认失败**

Run: `npx vitest run src/features/achievements/achievements.test.ts`
Expected: FAIL — 字段不存在 / 目录仍引用旧字段

- [ ] **Step 4: 改写目录**

`src/features/achievements/achievements.ts` 的 `ACHIEVEMENTS` 换成：

```ts
export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: 'perfect_level', name: '完美主义', description: '一关一块不错,拿到三颗星', emoji: '💎', reward: 50,
    check: (s) => s.perfectLevels >= 1 },
  { id: 'combo_15', name: '连击王者', description: '连击达到 15', emoji: '⚡', reward: 50,
    check: (s) => s.maxCombo >= 15 },
  { id: 'marathon', name: '马拉松', description: '一次学习首通 5 关', emoji: '🏃', reward: 100,
    check: (s) => s.firstCompleteToday >= 5 },
  { id: 'early_bird', name: '早起鸟', description: '早上学习', emoji: '🌅', reward: 20,
    check: (s) => s.hour < 10 },
  { id: 'night_owl', name: '夜猫子', description: '晚上学习', emoji: '🦉', reward: 20,
    check: (s) => s.hour >= 21 },
  { id: 'collector', name: '收集者', description: '一个单元全部拿到三颗星', emoji: '📦', reward: 200,
    check: (s) => s.perfectUnits >= 1 },
  { id: 'dedicated', name: '坚持者', description: '连续 7 天学习', emoji: '🔥', reward: 300,
    check: (s) => s.consecutiveDays >= 7 },
  { id: 'grand_master', name: '大法师', description: '全部关卡通关', emoji: '👑', reward: 1000,
    check: (s) => s.completedLevels >= s.totalLevels },
]
```

- [ ] **Step 5: 切断旧词课路径的成就扫描（搭桥）**

`AchievementState` 一换口径，`src/features/lesson/settlement.ts` 里构造旧字段的那个调用点立刻类型不匹配 —— 而 `features/lesson/` 要到 Task 13 才删。

**不要给那四个词库字段编映射**：`completedWords` / `categoryDone` / `perfectWords` / `totalWords` 在关卡语境里没有对应来源，硬凑就是造假数据；尤其 `totalLevels: 0` 会让 `completedLevels >= totalLevels` 恒真，「大法师」当场白送。

改为**短路**：

```ts
  // 【过渡桥】词课路径与它的成就接线在 Task 13 整条删除。
  // 这里不再扫描:旧口径的四个字段(词数/分类/整词完美)在关卡语境里没有对应来源,
  // 编一套映射等于造假数据。新路径的成就由 pinyin-blocks/settle.ts 承担。
  const achievements: readonly TAchievement[] = []
```

同时删掉 `src/features/lesson/settlement.test.ts` 里断言成就触发的用例（保留其余）。

- [ ] **Step 6: 跑测试确认通过**

Run: `npx vitest run src/features/achievements/achievements.test.ts src/features/lesson/settlement.test.ts`
Expected: PASS（后者只剩不涉成就的用例）

- [ ] **Step 7: 提交**

```bash
npx tsc -b
git add src/shared/services/achievements.ts src/features/achievements/achievements.ts src/features/achievements/achievements.test.ts
git commit -m "$(cat <<'EOF'
feat(achievements): 成就目录换锚到关卡

8 条里 5 条原本直接读词库(100 词 / 分类 / 词数里程碑),词库一删就全废:
  完美主义 → 一关零错  马拉松 → 一次会话首通 5 关
  收集者   → 一个单元全三星  大法师 → 全部关卡通关
连击 / 早起鸟 / 夜猫子 / 坚持者 原样不动。

弹窗保留汉字文案 —— 它是全游戏唯一还给孩子看汉字的地方,低频、emoji 已
承担主视觉、且这些是给家长看的里程碑。这是**故意的例外**,不是遗漏。

旧词课路径的成就扫描在此短路(见 Step 5),不是漏接:它的四个输入字段在
关卡语境里没有对应来源,编一套映射等于造假数据。该路径随 Task 13 删除。

护栏钉死目录里不再出现词课字段名。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: 关卡结算协调器

**Files:**
- Create: `src/features/pinyin-blocks/settle.ts`
- Create: `src/features/pinyin-blocks/settle.test.ts`

**Interfaces:**
- Consumes: Task 4 的 `PinyinProgressService.recordClear`、Task 5 的统计函数、Task 10 的 `AchievementState`、`SettingsService.save`、`ComboService.getBonus`、`LuckyBonusService.roll`
- Produces: `settleLevel(input, services): Promise<LevelSettlement>`，`LevelSettlement = { stars: number; starDust: number; achievements: readonly Achievement[]; luckyReward: number }`

- [ ] **Step 1: 先写失败的测试**

Create `src/features/pinyin-blocks/settle.test.ts`：

```ts
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
    const roll = vi.fn().mockReturnValue(50)
    const result = await settleLevel(
      { ...INPUT, stars: 1, currentStars: { 'u1-0': 3 } },
      { ...SERVICES, combo: { getBonus: () => 0 }, lucky: { roll } },
    )
    expect(roll).not.toHaveBeenCalled()
    expect(result.luckyReward).toBe(0)
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
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/pinyin-blocks/settle.test.ts`
Expected: FAIL — `Failed to resolve import "./settle"`

- [ ] **Step 3: 写协调器**

Create `src/features/pinyin-blocks/settle.ts`：

```ts
// 一次通关的结算:星级落库 + 星尘入账 + 成就扫描 + 连续天数推进。
// 纯协调器 —— 服务由调用方注入(照旧 settlement.ts 的做法),本文件不碰 useService。
//
// 时间与随机都可注入,保证单测确定性。

import type {
  Achievement,
  AchievementState,
  LevelStars,
  Rng,
  UserSettings,
} from '@/shared/services'
import { UNITS } from './levels'
import {
  completedLevelCount,
  perfectLevelCount,
  perfectUnitCount,
  totalLevelCount,
} from './progress-stats'

export type LevelSettlement = Readonly<{
  stars: number
  /** 本次入账的星尘(连击加成 + 幸运 + 成就奖励)。 */
  starDust: number
  luckyReward: number
  achievements: readonly Achievement[]
  /** 结算后的会话首通数 —— 交回调用方存着,下次结算再带进来。 */
  sessionCleared: number
}>

export type SettleInput = Readonly<{
  levelId: string
  /** 本次拿到的星(1..3)。 */
  stars: number
  /** 结算**之前**的星级表 —— 用来判断这是不是首通。 */
  currentStars: LevelStars
  totalStars: number
  settings: UserSettings
  /** 本次会话(浏览器会话内)已首通的关数。 */
  sessionCleared: number
  /** 本次会话里的最高连击 —— 由调用方从 ComboService 快照读。 */
  maxCombo: number
  now?: () => Date
  rng?: Rng
}>

export type SettleServices = Readonly<{
  progress: { recordClear(clear: { levelId: string; stars: number; starDust: number }): Promise<void> }
  settings: { save(settings: UserSettings): Promise<void> }
  combo: { getBonus(): number }
  lucky: { roll(rng?: Rng): number }
  achievements: { scan(state: AchievementState, earned: readonly string[]): readonly Achievement[] }
}>

const pad = (value: number) => String(value).padStart(2, '0')

function todayKey(now: Date): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function shiftDate(date: string, delta: number): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + delta).getTime()
}

function nextConsecutive(previous: number, lastDate: string, today: string): number {
  if (lastDate === '') return 1
  if (lastDate === today) return previous
  const yesterday = todayKey(new Date(shiftDate(today, -1)))
  return yesterday === lastDate ? previous + 1 : 1
}

export async function settleLevel(input: SettleInput, services: SettleServices): Promise<LevelSettlement> {
  const clock = input.now ?? (() => new Date())
  const now = clock()
  const today = todayKey(now)

  // 首通 = 这一关此前一颗星都没有。
  const firstClear = (input.currentStars[input.levelId] ?? 0) === 0

  // 重玩不再掷幸运、不再计首通 —— 否则刷同一关就能刷星尘,运气变成农活。
  const comboReward = input.stars > 0 ? services.combo.getBonus() : 0
  const luckyReward = firstClear ? services.lucky.roll(input.rng) : 0

  const nextStars: LevelStars = {
    ...input.currentStars,
    [input.levelId]: Math.max(input.currentStars[input.levelId] ?? 0, input.stars),
  }
  const settingsWithStreak: UserSettings = {
    ...input.settings,
    lastActiveDate: today,
    consecutiveDays: nextConsecutive(input.settings.consecutiveDays, input.settings.lastActiveDate, today),
  }
  const sessionCleared = input.sessionCleared + (firstClear ? 1 : 0)

  const achievements = services.achievements.scan({
    totalLevels: totalLevelCount(UNITS),
    completedLevels: completedLevelCount(nextStars, UNITS),
    perfectLevels: perfectLevelCount(nextStars, UNITS),
    perfectUnits: perfectUnitCount(nextStars, UNITS),
    maxCombo: input.maxCombo,
    firstCompleteToday: sessionCleared,
    consecutiveDays: settingsWithStreak.consecutiveDays,
    hour: now.getHours(),
  }, [...settingsWithStreak.earnedAchievements])

  const achievementReward = achievements.reduce((sum, achievement) => sum + achievement.reward, 0)
  const starDust = comboReward + luckyReward + achievementReward

  const settings: UserSettings = achievements.length === 0
    ? settingsWithStreak
    : {
        ...settingsWithStreak,
        earnedAchievements: Array.from(new Set([
          ...settingsWithStreak.earnedAchievements,
          ...achievements.map((achievement) => achievement.id),
        ])),
      }

  await Promise.allSettled([
    services.progress.recordClear({ levelId: input.levelId, stars: input.stars, starDust }),
    services.settings.save(settings),
  ])

  return { stars: input.stars, starDust, luckyReward, achievements, sessionCleared }
}
```

`maxCombo` 走入参而非由 `settleLevel` 自己去问服务：连击存在 `sessionStorage` 里，是**浏览器会话**的账，而结算是**一关**的账 —— 谁的两个生命周期，谁负责把它带过来。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/pinyin-blocks/settle.test.ts`
Expected: PASS（5 条）

- [ ] **Step 5: 提交**

```bash
npx tsc -b
git add src/features/pinyin-blocks/settle.ts src/features/pinyin-blocks/settle.test.ts
git commit -m "$(cat <<'EOF'
feat(pinyin-blocks): 关卡结算协调器

一次通关的账:星级落库 + 星尘(连击加成 + 幸运 + 成就)入账 + 成就扫描 +
连续天数推进。纯协调器,服务注入,时间与随机注入,单测确定。

重玩已通关的关不再掷幸运、不再计首通 —— 否则刷同一关就能刷星尘,
运气变成农活。星级仍交服务端取 max,重玩只能升不能降。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: 切 App 壳（Phase 1 收口）

**Files:**
- Create: `src/features/pinyin-blocks/MapEntry.tsx`
- Create: `src/features/pinyin-blocks/LevelEntry.tsx`
- Modify: `src/features/pinyin-blocks/index.ts`
- Delete: `src/features/pinyin-blocks/PinyinBlocksEntry.tsx`
- Modify: `src/app/useAppState.ts`
- Modify: `src/app/App.tsx`
- Test: `src/app/useAppState.test.tsx`、`src/app/App.test.tsx`

**Interfaces:**
- Consumes: Task 4-11 的全部产出
- Produces: 相位 `'boot' | 'login' | 'map' | 'level' | 'parent'`；`actions.enterUnit(index)` / `enterLevelAt(unitIndex)` / `exitToMap()` / `openParent()` / `closeParent()`

- [ ] **Step 1: 写两个入口页**

Create `src/features/pinyin-blocks/MapEntry.tsx`：

```tsx
import { PinyinProgressService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { UnitMap } from './UnitMap'

/**
 * 地图页入口。useService 只允许出现在 <Name>Entry.tsx,故服务在这里取、以 props 下传。
 * 地图不需要音频 / 语音服务 —— 点锁定格只是不响应,不发声(发声得先有一整套
 * 「哪种声音算提示、哪种算打扰」的判断,现在没有)。
 */
export function MapEntry({
  onPick,
  onOpenParent,
}: {
  onPick(unitIndex: number): void
  onOpenParent(): void
}) {
  const progress = useService(PinyinProgressService)
  const snapshot = useServiceSnapshot(progress)

  return (
    <UnitMap
      stars={snapshot.data.stars}
      totalStars={snapshot.data.totalStars}
      onPick={onPick}
      onOpenParent={onOpenParent}
    />
  )
}
```

Create `src/features/pinyin-blocks/LevelEntry.tsx`：

```tsx
import { useCallback, useState } from 'react'
import {
  AchievementService,
  AudioService,
  ComboService,
  LuckyBonusService,
  PinyinProgressService,
  SettingsService,
  SpeechService,
} from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { UNITS } from './levels'
import { PinyinBlocksGame } from './PinyinBlocksGame'
import { settleLevel, type LevelSettlement } from './settle'

/**
 * 关卡页入口。一关拼完 → 结算 → 继续下一关(单元最后一关的「继续」回地图)。
 *
 * 本关是单元内第几关由 unitIndex 决定,恒从该单元**第一个未通关**的关口进 ——
 * 地图上点的是单元,不是具体某一关。
 */
export function LevelEntry({
  unitIndex,
  onExitToMap,
  onSettle,
}: {
  unitIndex: number
  onExitToMap(): void
  onSettle(result: LevelSettlement): void
}) {
  const progress = useService(PinyinProgressService)
  const settings = useService(SettingsService)
  const combo = useService(ComboService)
  const lucky = useService(LuckyBonusService)
  const achievements = useService(AchievementService)
  const speech = useService(SpeechService)
  const audio = useService(AudioService)
  const progressSnap = useServiceSnapshot(progress)
  const settingsSnap = useServiceSnapshot(settings)

  const [sessionCleared, setSessionCleared] = useState(0)
  const unit = UNITS[unitIndex] ?? UNITS[0]!
  const firstUncleared = unit.levels.findIndex((level) => (progressSnap.data.stars[level.id] ?? 0) === 0)
  const [levelIndex, setLevelIndex] = useState(firstUncleared < 0 ? 0 : firstUncleared)

  const speak = useCallback((text: string) => speech.speak(text, 'zh-CN'), [speech])

  const handleSolved = useCallback(
    async (stars: number) => {
      const level = unit.levels[levelIndex]
      if (!level) return
      const result = await settleLevel(
        {
          levelId: level.id,
          stars,
          currentStars: progressSnap.data.stars,
          totalStars: progressSnap.data.totalStars,
          settings: settingsSnap.data,
          sessionCleared,
          // 连击存在 sessionStorage,是浏览器会话的账;结算把它带过来一次用掉
          maxCombo: combo.getSnapshot().maxCombo,
        },
        { progress, settings, combo, lucky, achievements },
      )
      // 用结算交回的**结果**,不是自己 +1 —— 重玩一关不该让首通数虚增
      setSessionCleared(result.sessionCleared)
      onSettle(result)
      if (levelIndex + 1 < unit.levels.length) setLevelIndex(levelIndex + 1)
      else onExitToMap()
    },
    [unit, levelIndex, progressSnap, settingsSnap, sessionCleared, progress, settings, combo, lucky, achievements, onSettle, onExitToMap],
  )

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onExitToMap}
          aria-label="回地图"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline bg-surface/70 text-ink-2"
        >
          ←
        </button>
        <span className="text-sm font-bold text-ink-3 tabular-nums">
          {levelIndex + 1}/{unit.levels.length}
        </span>
      </div>
      <PinyinBlocksGame
        key={unit.levels[levelIndex]?.id}
        unitIndex={unitIndex}
        levelIndex={levelIndex}
        speak={speak}
        playSound={audio.play}
        // 连击的落点:每放一块上报一次。放对 'first'、放错 'wrong'
        onBlock={(kind) => { combo.answer(kind) }}
        onSolved={(stars) => { void handleSolved(stars) }}
      />
    </div>
  )
}
```

- [ ] **Step 2: 改相位机**

`src/app/useAppState.ts` 整文件替换：

```ts
import { useState } from 'react'

export type AppPhase = 'boot' | 'login' | 'map' | 'level' | 'parent'

export interface AppState {
  phase: AppPhase
  currentUnitIndex: number | null
  actions: {
    enterUnit(unitIndex: number): void
    exitToMap(): void
    openParent(): void
    closeParent(): void
  }
}

/** 五个相位:登录 → 单元地图 → 关卡,外加一个家长面板。地图是唯一的「家」。 */
export function useAppState(): AppState {
  const [phase, setPhase] = useState<AppPhase>('boot')
  const [currentUnitIndex, setCurrentUnitIndex] = useState<number | null>(null)

  return {
    phase,
    currentUnitIndex,
    actions: {
      enterUnit(unitIndex) {
        setCurrentUnitIndex(unitIndex)
        setPhase('level')
      },
      exitToMap() {
        setCurrentUnitIndex(null)
        setPhase('map')
      },
      openParent() {
        setPhase('parent')
      },
      closeParent() {
        setPhase('map')
      },
    },
  }
}
```

同步改写 `src/app/useAppState.test.tsx`：删掉 `qianzigu` / `letter-forest` / `lesson` / `settings` 相关的断言，改为断言这五相位的迁移（boot→map、map→level→map、map→parent→map、`exitToMap` 清 `currentUnitIndex`）。

- [ ] **Step 3: 改 App.tsx**

`src/app/App.tsx` 整文件重写为：

```tsx
import { useEffect, useRef, useState } from 'react'
import { MotionConfig } from 'motion/react'
import { Loader2 } from 'lucide-react'
import { AchievementPopup } from '@/features/achievements'
import { AuthEntry } from '@/features/auth'
import { LuckyBonus } from '@/features/lucky-bonus'
import { LevelEntry, MapEntry, type LevelSettlement } from '@/features/pinyin-blocks'
import { AuthService, CelebrateService, PinyinProgressService } from '@/shared/services'
import { useService, useServiceSnapshot } from '@/shared/services/core'
import { ParentPanel } from './ParentPanel'
import { useAppState } from './useAppState'

type Celebration = Readonly<{ achievements: LevelSettlement['achievements']; luckyReward: number }>

function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-ink-3" />
    </div>
  )
}

/** App 只做页面状态路由与跨 feature 组装;玩法、结算、奖励规则都在 feature 内。 */
export default function App() {
  const auth = useService(AuthService)
  const progress = useService(PinyinProgressService)
  const celebrateService = useService(CelebrateService)
  // 快照必须先于任何读它的东西声明 —— previousAuthStatus 的初值就取自 authSnap
  const authSnap = useServiceSnapshot(auth)
  const progressSnap = useServiceSnapshot(progress)
  const { phase, currentUnitIndex, actions } = useAppState()
  const [celebration, setCelebration] = useState<Celebration | null>(null)
  const previousAuthStatus = useRef(authSnap.status)

  // 挂载探测登录态
  useEffect(() => { void auth.check() }, [auth])

  // 登录成功后拉进度并进地图
  useEffect(() => {
    const previous = previousAuthStatus.current
    previousAuthStatus.current = authSnap.status
    if (authSnap.status !== 'authenticated' || previous === 'authenticated') return
    actions.exitToMap()
    void progress.load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authSnap])

  function advanceCelebration() {
    setCelebration((current) => {
      if (!current) return current
      if (current.achievements.length > 1) return { ...current, achievements: current.achievements.slice(1) }
      if (current.luckyReward > 0) return { achievements: [], luckyReward: current.luckyReward }
      return null
    })
  }

  function handleSettle(result: LevelSettlement) {
    if (result.achievements.length === 0 && result.luckyReward <= 0) return
    setCelebration({ achievements: result.achievements, luckyReward: result.luckyReward })
  }

  let content
  if (authSnap.status === 'checking') content = <BootScreen />
  else if (authSnap.status !== 'authenticated') content = <AuthEntry />
  else if (phase === 'parent') content = <ParentPanel onClose={actions.closeParent} />
  else if (phase === 'level' && currentUnitIndex !== null) {
    content = (
      <LevelEntry
        key={`unit-${currentUnitIndex}`}
        unitIndex={currentUnitIndex}
        onExitToMap={actions.exitToMap}
        onSettle={handleSettle}
      />
    )
  // 地图要拿它渲染星星与星尘 —— 进度没到位就先停 boot,别闪一下空地图再跳
  } else if (progressSnap.status !== 'ready') {
    content = <BootScreen />
  } else {
    content = <MapEntry onPick={actions.enterUnit} onOpenParent={actions.openParent} />
  }

  return (
    <MotionConfig reducedMotion="user">
      {content}
      {celebration ? (
        celebration.achievements.length > 0 ? (
          <AchievementPopup list={celebration.achievements} celebrate={celebrateService.play} onDone={advanceCelebration} />
        ) : (
          <LuckyBonus amount={celebration.luckyReward} onDone={() => setCelebration(null)} />
        )
      ) : null}
    </MotionConfig>
  )
}
```

同步改写 `src/app/App.test.tsx`：删掉千字谷 / 字母林 / 冷启动 / 词课的用例，改为断言「未登录 → AuthEntry」「登录后 → 地图」「点单元 → 关卡」。

- [ ] **Step 4: 更新 feature 公共面**

`src/features/pinyin-blocks/index.ts` 换成：

```ts
// 拼音积木组合游戏 —— 公共面。
// 玩法:看图 → 从积木盘挑块 → 拼进凹槽 → 声调块盖在韵腹上方。
// 块按类型着色:声母蓝 / 介母青 / 韵母绿 / 鼻音紫 / 声调金。
export { MapEntry } from './MapEntry'
export { LevelEntry } from './LevelEntry'
export { UnitMap } from './UnitMap'
export { PinyinBlocksGame } from './PinyinBlocksGame'
export { BlockChip } from './BlockChip'
export { UNITS } from './levels'
export type { Level, Syllable, Unit } from './levels'
export type { Block, BlockType, Hint } from './blocks'
export { hintFor, HINT_BY_UNIT } from './blocks'
export type { LevelSettlement } from './settle'
export {
  completedLevelCount,
  isUnitUnlocked,
  perfectLevelCount,
  perfectUnitCount,
  totalLevelCount,
} from './progress-stats'
export {
  autoTargetId,
  buildBlocks,
  canPlace,
  isComplete,
  requiredBlocks,
  slotsFor,
  starsFor,
  toneBlocks,
  wrongSlotIds,
} from './rules'
export type { Placement, Rng, Slot, TrayBlock } from './rules'
```

删掉 `src/features/pinyin-blocks/PinyinBlocksEntry.tsx`。

- [ ] **Step 5: 跑全闸门**

```bash
npx tsc -b && npm test && npx oxlint
```
Expected: 全绿。**此时旧 feature 目录仍在，但已不可达** —— 这是有意的，删除独立成 Phase 2 的提交。

- [ ] **Step 6: 浏览器冒烟（Phase 1 验收）**

`npm run dev`，逐条走 spec §12.2 的 1-9 项。**不截图** —— 用 DevTools 的 Elements/Console/Network 面板与 DOM 检查（`document.querySelector('[data-unit-map]')` 的 `textContent` 不该有汉字；`.pslots--weak` 的 `getComputedStyle(document.querySelector('.pslot')).borderTopColor` 应等于中性色）。

- [ ] **Step 7: 提交（Phase 1 收口）**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(app): App 壳切到拼音积木(Phase 1 收口)

相位 8 个收成 5 个:boot → login → map → level,外加 parent。
登录直达单元地图,不再有「选择你的世界」。

新增两个入口页:MapEntry(取进度快照给地图)、LevelEntry(拼完结算、
单元内推进、末关回地图)。旧 PinyinBlocksEntry 试玩台删除。

旧 feature 目录此刻仍在,但已不可达 —— 删除独立成下一个提交,
真发现漏了什么,退那一个就行,不用把新东西一起退掉。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

# Phase 2 — 后删（提交 2）

---

### Task 13: 删旧 feature 与旧后端

**Files:**
- Delete: `src/features/qianzigu/` `archipelago/` `lesson/` `foundation/` `question-engine/` `vocabulary/` `lingling/` `progress/` `settings/`
- Delete: `worker/progress.ts` `worker/basics.ts` `worker/chapter-progress.ts`
- Modify: `worker/index.ts`
- Modify: `src/shared/services/index.ts`、`api.ts`、`src/features/api/api.ts`、`src/app/bootstrap.ts`、`src/shared/services/core.ts`（若需要）
- Delete: `src/shared/services/progress.ts` `basics-progress.ts` `chapter-progress.ts` `foundation.ts` `question-engine.ts` `vocabulary.ts` `progress-rules.ts`

**Interfaces:**
- Consumes: Phase 1 全部
- Produces: 只剩拼音积木的仓库

- [ ] **Step 1: 删目录**

```bash
git rm -r src/features/qianzigu src/features/archipelago src/features/lesson src/features/foundation \
  src/features/question-engine src/features/vocabulary src/features/lingling src/features/progress \
  src/features/settings
git rm worker/progress.ts worker/basics.ts worker/chapter-progress.ts
```

> **`src/features/settings-state/` 不删** —— 它是 `createSettingsService` 的实现，成就系统仍要它承载 `earned_achievements` / `consecutive_days` / `last_active_date`。被删的是设置**页 UI**。

- [ ] **Step 2: 删 worker 路由**

`worker/index.ts` 里删掉这三个 case 与对应的三行 import：`/api/progress`、`/api/basics-progress`、`/api/chapter-progress`。

- [ ] **Step 3: 删共享契约**

```bash
git rm src/shared/services/progress.ts src/shared/services/basics-progress.ts \
  src/shared/services/chapter-progress.ts src/shared/services/foundation.ts \
  src/shared/services/question-engine.ts src/shared/services/vocabulary.ts \
  src/shared/services/progress-rules.ts
```

`src/shared/services/index.ts` 里删掉这些文件的全部 `export` 行。

`src/shared/services/settings.ts` 里删 `DomainKey` / `DOMAIN_ORDER` / `enableKeyOf`（`SettingsService` 本体与 `UserSettings` 保留）；`index.ts` 对应改导出。

- [ ] **Step 4: 删 api 方法**

`src/shared/services/api.ts` 删 `getProgress` / `putProgress` / `deleteProgress` / `getBasicsProgress` / `putBasicsProgress` / `getChapterProgress` / `putChapterProgress` 与它们的 import。
`src/features/api/api.ts` 删对应实现、对应 `is*Response` 校验函数、对应 `type *Response`，以及 `isWordProgress` / `isBasicsRow` / `isChapterProgressRow`。同步删 `src/features/api/api.test.ts` 里对应的用例。

- [ ] **Step 5: 收 bootstrap**

`src/app/bootstrap.ts` 删：`AchievementService` 之外的词课相关——即 `ChapterService` / `QuestionEngineService` / `ProgressRulesService` / `VocabularyService` / `FoundationService` / `BasicsService` / `ProgressService` 的 import、register 与 `ALL_SERVICE_TOKENS` 条目。

**留下**：`AchievementService` / `ApiService` / `AudioService` / `AuthService` / `CelebrateService` / `ComboService` / `LuckyBonusService` / `PinyinProgressService` / `SettingsService` / `SpeechService` / `ToastService`。

- [ ] **Step 6: 清 `settings.ts` 的领域开关**

`UserSettings` 里删 `enableChinese` / `enableEnglish`；`worker/settings.ts` 同步（DB 列保留，只是读写不再带上它们）；`src/features/settings-state/settings.ts` 与 `src/features/api/api.ts` 的 `isSettings` 同步。
`migrations/0004_chinese_domain.sql` **不改**（历史迁移不可改）。

- [ ] **Step 7: 反复编译直到干净**

```bash
npx tsc -b
```
Expected: 起初会报一批「找不到模块」。**逐个修**：删 import、删引用、删测试。这一步没有捷径，但 `tsc` 会把你带到每一个漏网点。

**两处明确点名**（清单里容易漏，先写在这）：

- `src/app/useCompletedWords.ts` —— 整文件删掉。它 import `ProgressService`，本步删掉该契约后就红了；而新 App（Task 12）根本没引用它。
- `src/features/lesson/settlement.ts` —— Task 10 在那里搭了一座「成就短路」的过渡桥，随本步与整个 `lesson/` 一起消失。**它不该在删除后留下任何残迹**，包括那句桥注释。

```bash
npm test
```
Expected: 起初会有一批测试文件因 import 失败而红，逐个删（它们测的是已删的模块）。**留到最后的绿必须是 77 以下的一个新数** —— 记下它，Step 8 要用。

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: 删除词课 / 千字谷 / 字母林全套(拼音积木取代)

删:features 下 qianzigu / archipelago / lesson / foundation / question-engine /
vocabulary / lingling / progress / settings 九个目录;worker 三条旧路由;
shared/services 下七份旧契约;api 层七个方法;bootstrap 七个服务注册。

留:settings-state/(createSettingsService 的实现,成就仍用它承载
earned_achievements / consecutive_days / last_active_date)—— 被删的是设置
页 UI,跟这个不是一回事。

D1 的旧表 progress / user_settings / basics_progress / qianzigu_progress 一律
保留不删:0001 基线不可改,DROP 也无法回滚,且删了拿不回任何东西。
新代码不再读写它们。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: `shared/ui` 清扫 + 文档同步

**Files:**
- Delete: `src/shared/ui/quiz/`（整目录）
- Delete/Modify: `src/shared/ui/` 下零引用的基础件
- Modify: `src/features/pinyin-blocks/material.test.ts`（陈旧注释）
- Modify: `CLAUDE.md`、`docs/dev-reference.md`、`docs/PLAN.md`
- Delete: `docs/design/`、`docs/superpowers/plans/` 下的旧计划

**Interfaces:**
- Consumes: Task 13 的删除结果
- Produces: 无死代码的 `shared/ui`

- [ ] **Step 1: 删 `shared/ui/quiz/` 整棵**

```bash
git rm -r src/shared/ui/quiz
```

理由：`pinyin-blocks` 只从 `shared/ui` 拿了一个 `cn`（已核实）。整个 `quiz/`（`Choice` `MatchGame` `Stone` `CastButton` `QuestionBubble` `SparkBurst` `ListenChoice` `ProgressCrystals` `TypeBadge`）的消费者是词课 / 千字谷 / 短教 / 冷启动 —— 全部已删。

- [ ] **Step 2: 逐个确认基础件引用**

```bash
for f in badge button card chart-tooltip input label select utils; do
  n=$(grep -rl "shared/ui/$f" src --include='*.ts' --include='*.tsx' | grep -v "shared/ui/$f" | wc -l)
  echo "$f: $n 处引用"
done
```

`0 处引用`的用 `git rm` 删掉。**这一步 `tsc` 帮不上忙** —— 无人引用的模块不会报错，只会静静腐烂，只能这样人工点。`utils.ts` 的 `cn` 有引用，必留。

- [ ] **Step 3: 修陈旧注释**

`src/features/pinyin-blocks/material.test.ts` 开头引 `stone.test.ts` 当「读源文件而非 `?raw`」的先例 —— 该文件已随 `quiz/` 删除，改指仍在的文件（例如 `src/features/pinyin-blocks/material.test.ts` 自身的说明，或删掉这个类比只留理由）：

```ts
/** 直接读源文件,不用 `?raw` 导入(那条路在本仓返回空串,是沉默的假绿陷阱)。 */
```

- [ ] **Step 4: 全量闸门**

```bash
npx tsc -b && npm test && npx oxlint && npm run build
```
Expected: 全绿。`npm run build` 必须跑 —— **Tailwind v4 的扫描器陷阱只有 build 能暴露**（材质类若被抽成 helper，产物规则会归零而 test/lint 全绿）。build 后 grep 产物 CSS 确认 `.pslots--weak` 与 `.pstar` 都在：

```bash
grep -c "pslots--weak" dist/client/assets/*.css
grep -c "pstar--on" dist/client/assets/*.css
```
Expected: 两个数都 ≥ 1。

- [ ] **Step 5: 同步文档**

- `CLAUDE.md`：改「项目概述」（不再是 100 词星尘，改为 37 关拼音积木）、「架构」段的服务清单、按需参考表（删 `docs/design/` 一行）
- `docs/dev-reference.md`：数据模型（`pinyin_progress` 取代 `progress`）、后端 handler 事实、模块清单；**明确标注**「`0001`/`0003`/`0005` 建的表已停用，保留仅为不可回滚」
- `docs/PLAN.md`：0.2.0 轨那一行从 `[ ]` 改 `[x]` 并补状态；`0.3.0` 整轨失效横幅已在 spec 阶段写好
- `git rm -r docs/design docs/superpowers/plans`（故事文档与旧计划；**新计划就是本文件，先 `git mv` 到别处或直接保留本文件再删其余**）

> `docs/superpowers/plans/` 里有本计划自身。做法：先 `git rm` 该目录下除本文件外的全部旧计划，保留本文件。

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: shared/ui 清扫 + 文档同步

删 shared/ui/quiz/ 整棵 —— 它的消费者是词课/千字谷/短教/冷启动,全已删;
pinyin-blocks 只从 shared/ui 拿了一个 cn。基础件按引用逐个确认后删。

这一步 tsc 帮不上忙:无人引用的模块不会报错,只会静静腐烂。

文档:CLAUDE.md / dev-reference / PLAN 同步;docs/design 故事文档、
docs/superpowers/plans 旧计划删除(本计划保留)。

build 后 grep 产物 CSS 确认 .pslots--weak 与 .pstar--on 都在 ——
Tailwind v4 扫描器陷阱只有 build 能暴露,test/lint 全绿也说明不了问题。

Co-Authored-By: Claude Code <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: 终审 + 发布前闸门

**Files:** 无新增；只读与验证

- [ ] **Step 1: 全闸门复跑**

```bash
npx tsc -b && npm test && npx oxlint && npm run build
```

- [ ] **Step 2: 死引用扫描**

```bash
grep -rn "qianzigu\|archipelago\|letter-forest\|WordUnit\|vocabulary\|question-engine\|progress-rules\|enableChinese\|enableEnglish" src worker --include='*.ts' --include='*.tsx' | grep -v '\.test\.'
```
Expected: **0 命中**（测试文件里的历史引用也一并清掉）。

```bash
grep -rn "GameState\|game_state\|kingdom" src worker --include='*.ts' --include='*.tsx'
```
Expected: 0 命中（红线：勿重建旧结构）。

- [ ] **Step 3: 浏览器全量冒烟**

`npm run dev`，走 spec §12.2 全部 10 项，含：
- 重玩一个二星的关拿三星 → 地图上星星**增加不减少**
- 齿轮 → 登出 → 重登 → 状态仍在
- 齿轮 → 重置全部进度 → 地图回零

**不截图**：用 DevTools 的 Elements / Console / Network 面板。重点看 Network 里 `PUT /api/pinyin-progress` 的请求体与响应，确认 `stars` 取 max 而非覆盖。

- [ ] **Step 4: 合并回 main**

本次在 topic 分支 `feat/pinyin-full-game` 上执行（项目铁律：大 plan 走 topic 分支 + worktree，成即合删）。**不要直接 `git push origin main`** —— 走 `superpowers:finishing-a-development-branch` 把分支合回 main，之后推 main。

- [ ] **Step 5: 发布**

**在合并后的 main 上**跑 `/release` skill 的流水线。**红线**：`tag` 仅在部署成功 + 冒烟通过后打；`wrangler` 命令一律显式 `--config wrangler.toml`；迁移顺序 preview → prod。

---

## 附录 A：本计划覆盖的 spec 章节对照

| spec 节 | 由哪个 Task 落地 |
|---|---|
| §3 关卡 id | Task 1 |
| §4 信息架构 | Task 12 |
| §5.1 迁移 0008 | Task 2 |
| §5.2 worker | Task 2 |
| §5.3 前端服务 | Task 4 |
| §5.4 api.ts | Task 3 |
| §6.1 名片块 | Task 1（数据）+ Task 8（渲染） |
| §6.2 格子状态 | Task 5（解锁）+ Task 8（表现） |
| §6.3 地图其它元素 | Task 8 |
| §7.1 三档提示 | Task 7 |
| §7.2 连错回强 | Task 7 |
| §7.3 星级判定 | Task 6 |
| §7.4 关卡间衔接 | Task 12 |
| §8.1 连击（触发点 = 每放一块） | Task 6（`onBlock` 上报）+ Task 12（接 `combo.answer`）+ Task 11（`maxCombo` 入账） |
| §8.2 幸运 | Task 11 |
| §8.3 成就 | Task 10（目录）+ Task 11（扫描接线） |
| §9 家长面板 | Task 9 |
| §10 删除清单 | Task 13 + Task 14 |
| §11 实施时序 | 全局：Phase 1 = 提交 1，Phase 2 = 提交 2 |
| §12 测试与验收 | 每个 Task 的测试步骤 + Task 15 |
| §13 未纳入本轮 | 不在本计划内（内容扩充另立一条） |

## 附录 B：执行纪律（写给执行者）

1. **每个 Task 结束都要 `npx tsc -b`**。Task 13 的删除是唯一一处允许「先红后修」的例外 —— `tsc` 在那里是你的向导，它会带你走到每一个漏网点。
2. **`npm run build` 不能省**（Task 14、Task 15）。Tailwind v4 的扫描器陷阱是：材质类若被抽成 helper，产物里规则会归零，而 **test / lint 全绿，只有 build 能暴露**。
3. **`npm test` 的最后那个数字要记下来**。Task 13 之前它是 561，之后必然变小 —— 变小是对的，但**你要能说清少掉的每一批对应哪个被删的模块**。说不清就是删过头了。
4. **不截图**。UI 一律用 `textContent` dump、`getComputedStyle`、DOM 查询、Network 面板验证。确需看像素请**用户自己看**。
5. **`git commit` 一律带上 `Co-Authored-By: Claude Code <noreply@anthropic.com>`。**
6. **Phase 1 与 Phase 2 之间不要合提交**。删除独立成提交的价值是：真发现漏了什么，退那一个就行，不用把新东西一起退掉。
