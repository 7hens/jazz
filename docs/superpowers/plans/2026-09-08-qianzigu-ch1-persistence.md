# 千字谷 ch1 · P4 章节态持久化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 章节态(当前章节 + 断点 resume scene + 恢复进度)可持久化:新迁移 `0005_qianzigu_chapter.sql` + worker `/api/chapter-progress` GET/PUT handler + api 客户端 + 前端 `ChapterService`(reactive,乐观写)。

**Architecture:** 仿既有 `basics_progress` 链路(shared 契约 → worker handler 单表 upsert → api 方法 → reactive service)。数据为每 user 一行:chapter_id / resume_scene_id / restore_state(JSON)。后端只行级读写,不解析 JSON 语义。前端语义属主 = qianzigu feature 内实现 `chapter-progress.ts` 服务工厂,经 bootstrap 注册。

**Tech Stack:** TypeScript + vitest + D1(migrations + vitest 下 mock fetch)。

**Spec:** `docs/superpowers/specs/2026-09-08-qianzigu-ch1-design.md` §5(数据与迁移:表结构/单行/0005/additive)+ §3.5(断点续玩)。executor 读 spec + 本 plan。

## Global Constraints

- 迁移 additive、带 DEFAULT,不改 0001 基线;`migrations/` 下一号为 `0005`(0004 已用)。
- worker handler 先 `getAuthenticatedUser`(401),只做行级读写;`restore_state` 语义后端不解析。
- wrangler 命令一律显式 `--config wrangler.toml`(CLAUDE 红线)。
- 表结构变更顺序:先升库(本地 `npm run db:local` 应用迁移)→ 后升代码。
- 3 层纪律:shared 契约不含业务;service 实现入 qianzigu feature;`useService` 仅 `<Name>Entry.tsx`。
- api 层仿 `api.ts` 既有 isX 校验器 + 方法结构;新 URL 路径 `/api/chapter-progress`。

---

### Task 1: shared 契约 chapter-progress.ts

**Files:**
- Create: `src/shared/services/chapter-progress.ts`
- Modify: `src/shared/services/index.ts`(barrel 加导出)
- Test: `src/shared/services/chapter-progress.contract.test.ts`

**Interfaces:**
- Consumes: `LoadState`/`ReactiveService`/`ServiceToken`(shared/services/core)。
- Produces(后续任务引用):

```ts
import type { LoadState, ReactiveService, ServiceToken } from './core'

/** 每 user 的千字谷章节态(单行)。restoreState:已恢复 {wordId,layer} 集 + 场景元素点亮集合。 */
export type ChapterProgressRow = {
  chapterId: number
  resumeSceneId: string | null       // 断点续玩定位(自然断点/退出)
  restoreState: string               // JSON 字符串(引擎 restored + 元素点亮)
  updatedAt: string
}

/** 服务端行(不含 updatedAt)。 */
export type ApiChapterProgressRow = Omit<ChapterProgressRow, 'updatedAt'>

export type ChapterProgressData = { row: ChapterProgressRow | null }
export type ChapterProgressSnapshot = LoadState<ChapterProgressData>

export interface ChapterService extends ReactiveService<ChapterProgressSnapshot> {
  load(): Promise<void>
  /** 保存整行(upsert 单行);乐观写,失败滚回。 */
  save(row: ChapterProgressRow): Promise<void>
  /** 清空该 user 章节态(重置章节用,可选)。 */
  clear(): Promise<void>
}

export const ChapterService = Symbol('ChapterService') as unknown as ServiceToken<ChapterService>
```

- [ ] **Step 1: 写失败测试(契约编译 + 形状)**

```ts
import { describe, expect, it } from 'vitest'
import type { ChapterProgressRow } from './chapter-progress'

describe('chapter-progress 契约', () => {
  it('行形状含 chapterId/resumeSceneId/restoreState/updatedAt', () => {
    const row: ChapterProgressRow = {
      chapterId: 1, resumeSceneId: 't1-core', restoreState: '[]', updatedAt: '2026-09-08T00:00:00.000Z',
    }
    expect(row.chapterId).toBe(1)
    expect(row.resumeSceneId).toBe('t1-core')
    expect(typeof row.restoreState).toBe('string')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/shared/services/chapter-progress.contract.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 建契约文件 + barrel**

按 Interfaces 代码块创建 `chapter-progress.ts`。`src/shared/services/index.ts` 追加:

```ts
export type { ApiChapterProgressRow, ChapterProgressData, ChapterProgressRow, ChapterProgressSnapshot } from './chapter-progress'
export { ChapterService } from './chapter-progress'
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/shared/services/chapter-progress.contract.test.ts`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/chapter-progress.ts src/shared/services/chapter-progress.contract.test.ts src/shared/services/index.ts
git commit -m "feat(shared): chapter-progress 契约 + ChapterService token"
```

---

### Task 2: 迁移 0005_qianzigu_chapter.sql

**Files:**
- Create: `migrations/0005_qianzigu_chapter.sql`
- Test: 手工 `npm run db:local` 应用确认无错(无自动化单测,迁移由 D1 CLI 应用)。

**Interfaces:**
- Consumes: 无(纯 SQL)。
- Produces: 表 `qianzigu_progress`:

```sql
-- 千字谷章节态:每 user × 活动章节一行(断点续玩 + 恢复进度)。
-- additive,不改 0001 基线;restore_state 为 JSON 字符串,后端不解析语义。
CREATE TABLE IF NOT EXISTS qianzigu_progress (
  user_id        TEXT PRIMARY KEY,
  chapter_id     INTEGER NOT NULL DEFAULT 1,
  resume_scene_id TEXT,
  restore_state  TEXT NOT NULL DEFAULT '[]',
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 1: 写迁移文件**

创建 `migrations/0005_qianzigu_chapter.sql`,内容见上。顶部注释注明 additive 性质与用途。

- [ ] **Step 2: 本地应用迁移**

Run: `npm run db:local`
Expected: 迁移 0005 应用成功(`wrangler d1 migrations apply --local`,wrangler 命令经 npm 脚本带 `--config`)。可加验证:

Run: `npx wrangler d1 execute jazz-life-tracker --local --config wrangler.toml --command "SELECT name FROM sqlite_master WHERE type='table' AND name='qianzigu_progress';"`
Expected: 返回该表名。

- [ ] **Step 3: Commit**

```bash
git add migrations/0005_qianzigu_chapter.sql
git commit -m "feat(migration): 0005 qianzigu_progress 章节态表"
```

---

### Task 3: worker handler(chapter.ts + 路由接线)

**Files:**
- Create: `worker/chapter-progress.ts`
- Modify: `worker/index.ts`(路由表加 `/api/chapter-progress`)

**Interfaces:**
- Consumes: `getAuthenticatedUser`(worker/_lib/auth)、`jsonResponse`(worker/_lib/http)、表 `qianzigu_progress`。
- Produces:
  - `handleGetChapterProgress(request, env)`:GET,无行返 `{ row: null }`。
  - `handlePutChapterProgress(request, env)`:PUT body `{ row: { chapterId, resumeSceneId, restoreState } }`,校验类型后单行 upsert,返 `{ ok: true }`。
  - 路由:`/api/chapter-progress` → GET/PUT;默认 405。

- [ ] **Step 1: 写测试(判断:worker/ 下无 *.test.ts —— 已核实,与 progress/basics handler 一致,不做单测)**

已确认 `worker/` 无任何 `.test.ts`(progress/basics handler 亦然)。因此本 Task **不写自动化单测**,handler 正确性由 Task 4 api 层测试(注入 fetch 打真 URL 校验请求/响应)兜底 + 浏览器人工验收。直接进入实现。

- [ ] **Step 2: 实现 handler**

按 `worker/basics.ts` 范式创建 `worker/chapter-progress.ts`:

```ts
import { getAuthenticatedUser } from './_lib/auth'
import { jsonResponse } from './_lib/http'
import type { Env } from './index'

type Row = { chapter_id: number; resume_scene_id: string | null; restore_state: string }

function toClient(r: Row) {
  return { chapterId: r.chapter_id, resumeSceneId: r.resume_scene_id, restoreState: r.restore_state }
}

export async function handleGetChapterProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const row = (await env.DB.prepare(
    'SELECT chapter_id, resume_scene_id, restore_state FROM qianzigu_progress WHERE user_id = ?',
  ).bind(user.id).first<Row>())
  return jsonResponse({ row: row ? toClient(row) : null })
}

export async function handlePutChapterProgress(request: Request, env: Env): Promise<Response> {
  const user = await getAuthenticatedUser(request, env)
  if (!user) return jsonResponse({ message: '未授权' }, { status: 401 })
  const body = (await request.json().catch(() => null)) as { row?: unknown } | null
  const r = body?.row as {
    chapterId?: unknown; resumeSceneId?: unknown; restoreState?: unknown
  } | undefined
  if (!r) return jsonResponse({ message: '章节数据不合法' }, { status: 400 })
  const chapterId = r.chapterId
  if (typeof chapterId !== 'number' || !Number.isInteger(chapterId) || chapterId < 1) {
    return jsonResponse({ message: `非法的 chapter_id:${String(chapterId)}` }, { status: 400 })
  }
  const restoreState = typeof r.restoreState === 'string' ? r.restoreState : ''
  const resumeSceneId = typeof r.resumeSceneId === 'string' ? r.resumeSceneId : null
  await env.DB.prepare(
    `INSERT INTO qianzigu_progress (user_id, chapter_id, resume_scene_id, restore_state, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       chapter_id=excluded.chapter_id,
       resume_scene_id=excluded.resume_scene_id,
       restore_state=excluded.restore_state,
       updated_at=excluded.updated_at`,
  ).bind(user.id, chapterId, resumeSceneId, restoreState, new Date().toISOString()).run()
  return jsonResponse({ ok: true })
}
```

`worker/index.ts` import 加入,并加 case(仿 `/api/basics-progress`):

```ts
case '/api/chapter-progress':
  if (method === 'GET') return handleGetChapterProgress(request, env)
  if (method === 'PUT') return handlePutChapterProgress(request, env)
  return methodNotAllowed()
```

- [ ] **Step 3: 类型检查**

Run: `npx tsc -b`
Expected: 无错误(handler 类型齐)。

- [ ] **Step 4: Commit**

```bash
git add worker/chapter-progress.ts worker/index.ts
git commit -m "feat(worker): /api/chapter-progress GET/PUT handler"
```

---

### Task 4: api 客户端方法(api.ts)

**Files:**
- Modify: `src/features/api/api.ts`(加校验器 + getChapterProgress/putChapterProgress)
- Test: `src/features/api/api.test.ts`(若存在)

**Interfaces:**
- Consumes: `ApiChapterProgressRow`(shared)、既有 `request<T>`/`isObject` 内部设施。
- Produces:
  - `ApiService` 增:`getChapterProgress(): Promise<{ row: ApiChapterProgressRow | null }>`
  - `ApiService` 增:`putChapterProgress(row: ApiChapterProgressRow): Promise<void>`
  - `shared/services/api.ts` 的 `ApiService` 接口同步(见 Step 说明)。

- [ ] **Step 1: 写失败测试**

查 `src/features/api/api.test.ts` 是否存在并采用其范式;追加:

```ts
it('getChapterProgress 解析 { row: null } 与 { row: {...} }', async () => { /* 用注入 fetch 返回 /api/chapter-progress */ })
it('putChapterProgress PUT 序列化 { row: {...} }', async () => { /* 断言 fetch body */ })
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/api/api.test.ts`
Expected: FAIL(方法不存在)。

- [ ] **Step 3: 实现**

在 `api.ts` 加校验器与类型:

```ts
function isChapterProgressRow(value: unknown): value is ApiChapterProgressRow {
  if (!isObject(value)) return false
  const resumeSceneId = value.resumeSceneId
  const restoreState = value.restoreState
  return typeof value.chapterId === 'number' && Number.isInteger(value.chapterId) && value.chapterId >= 1
    && (resumeSceneId === null || typeof resumeSceneId === 'string')
    && typeof restoreState === 'string'
}

type ChapterProgressResponse = { row: ApiChapterProgressRow | null }
function isChapterProgressResponse(value: unknown): value is ChapterProgressResponse {
  return isObject(value) && (value.row === null || isChapterProgressRow(value.row))
}
```

返回对象加方法:

```ts
async getChapterProgress() {
  return (await request('/api/chapter-progress', {}, isChapterProgressResponse)).row
},
async putChapterProgress(row) {
  await request('/api/chapter-progress', {
    method: 'PUT',
    body: JSON.stringify({ row: { chapterId: row.chapterId, resumeSceneId: row.resumeSceneId, restoreState: row.restoreState } }),
  }, isOkResponse)
},
```

`shared/services/api.ts` 的 `ApiService` 接口加两方法签名(与实现一致;如该文件即接口所在,一并改)。若 `ApiWordProgress`/`ApiBasicsProgressRow` 模式显示「服务端行类型定义在 shared/api.ts」,则 `ApiChapterProgressRow` 从 shared/chapter-progress.ts 导出并在 `shared/services/api.ts` 用 `import type` 引回(与 basics 一致)。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/api/api.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: Commit**

```bash
git add src/features/api/api.ts src/shared/services/api.ts src/features/api/api.test.ts
git commit -m "feat(api): chapter-progress GET/PUT 客户端方法"
```

---

### Task 5: ChapterService 实现(乐观写 reactive,属主 qianzigu)

**Files:**
- Create: `src/features/qianzigu/chapter-progress.ts`(服务工厂)
- Test: `src/features/qianzigu/chapter-progress.test.ts`
- Modify: `src/features/qianzigu/index.ts`(导出工厂)
- Modify: `src/app/bootstrap.ts`(注册 ChapterService + token 加 `ALL_SERVICE_TOKENS`)
- 视需要 Modify: `src/shared/services/core.ts`(无——token 模式与既有一致)

**Interfaces:**
- Consumes: `ApiService`(含 P4 Task4 方法)、`ChapterService`/`ChapterProgressRow`/`ChapterProgressData`(shared)、回调 `{ onUnauthorized, onError }`。
- Produces: `createChapterService(api: ApiService, callbacks): ChapterService`(reactive,仿 `features/settings-state/settings.ts` 的乐观写/事务提交范式;契约接口名 `ChapterService`,工厂名 `createChapterService` 避免 token 同名冲突)。

- [ ] **Step 1: 写失败测试**

仿 `features/settings-state/settings.test.ts`(读其结构与 mock fetch 方式)写:

```ts
it('load 拉取 row 并暴露 ready 快照')
it('save 乐观置行,成功后 stable;失败滚回并报错')
it('clear 清空行(null)')
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/features/qianzigu/chapter-progress.test.ts`
Expected: FAIL(模块不存在)。

- [ ] **Step 3: 实现服务工厂**

参照 `features/settings-state/settings.ts` 结构(immutable snapshot / transactions / visibleSnapshot / settleSave / report 401+error),数据形状为 `ChapterProgressData = { row: ChapterProgressRow | null }`:

```ts
import { ApiError } from '@/shared/services'
import type { ApiService, ChapterProgressRow, ChapterService } from '@/shared/services'

export interface ChapterProgressCallbacks { onUnauthorized(): void; onError(message: string): void }

export function emptyRow(): ChapterProgressRow {
  return { chapterId: 1, resumeSceneId: null, restoreState: '[]', updatedAt: new Date().toISOString() }
}
// ... createChapterService(api: ApiService, callbacks: ChapterProgressCallbacks): ChapterService
//     实现 load/save/clear + reactive snapshot(仿 settings-state/settings.ts)
```

> 实现时命名注意:shared 契约导出 `ChapterService`(token/接口同名一体)。工厂函数若与接口重名会冲突,故命名 `createChapterService`;`index.ts` 导出 `createChapterService` 与 `emptyRow`。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/features/qianzigu/chapter-progress.test.ts`
Expected: 全 PASS。

- [ ] **Step 5: bootstrap 注册**

`src/app/bootstrap.ts`:import `createChapterService` 与 `ChapterService`;`ALL_SERVICE_TOKENS` 数组加 `ChapterService`;`bootstrap()` 内建 `createChapterService(api, callbacks)` 并 `registry.register(ChapterService, ...)`(顺序在 api 建立后)。

- [ ] **Step 6: 全量回归 + 架构边界**

Run: `npm test`
Expected: 全绿(`architecture.test.ts` 要求新 token 进 ALL_SERVICE_TOKENS;qianzigu 不引其它 feature)。

- [ ] **Step 7: Commit**

```bash
git add src/features/qianzigu/chapter-progress.ts src/features/qianzigu/chapter-progress.test.ts src/features/qianzigu/index.ts src/app/bootstrap.ts
git commit -m "feat(qianzigu): ChapterService 章节态乐观写服务 + bootstrap 注册"
```

---

## Self-Review

**Spec 覆盖:** §5 表结构/单行/0005/additive/先库后码 → Task2;worker 行级读写不解析 restore_state → Task3;断点续玩 resume_scene_id/restore_state → Task1/5;每词进度/星尘复用由 P5 settle 承接(本 plan 只存章节壳)。api 校验一致性 → Task4。

**占位扫描:** Task1 的 Step 中「是否已有 worker/api 测试」以判断命令先行 —— 实现者在 Step1 先 `ls`/`grep` 再定,属程序化检查非 TBD;若 api.test.ts 不存在则按其不存在情况落在 api 层测试 Task4 Step1 改为新建最小测试文件(指令已给用例内容)。

**类型一致性:** `ChapterService` token 在 shared 定义、qianzigu 工厂 `createChapterService` 避免重名;`ApiChapterProgressRow` 跨 shared/chapter-progress 与 shared/api 的类型互引仿 basics 既有做法(需实现者按 basics 现状核对 `ApiBasicsProgressRow` 定义位置后对齐)。
