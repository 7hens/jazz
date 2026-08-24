# 三 Tab 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将单页记录应用重构为体重 / 财务 / 运动三个 tab;体重与财务带 recharts 图表与软提醒,运动改为纯静态指导,新增收入记录类型,清理旧运动数据。

**Architecture:** 前端单页 App 拆为 3 个受控 tab 组件,App 持有 records 状态与 CRUD 下发给 tab;后端仅改 `records.ts` POST 校验(加 income、删 exercise);DB 通过表重建迁移加入 income 类型并删除运动记录;图表数据全部前端聚合,不新增 API。

**Tech Stack:** React 19 / TypeScript / Vite / Tailwind 4 / recharts ^3.10.1 / Cloudflare Pages Functions / D1。

**Spec:** `docs/superpowers/specs/2026-08-25-tabs-restructure-design.md`

## Global Constraints

- `records.type` CHECK 最终为 `('expense','income','weight')`(迁移 + schema.sql 同步)
- recharts 版本 ^3.10.1(支持 React 19)
- 不新增路由库、不新增后端 API;统计与图表全前端 `useMemo`
- 软提醒不拦截提交(非强制)
- UI 文案为中文
- `verbatimModuleSyntax: true` → 类型导入必须 `import type { ... }`
- `noUnusedLocals` / `noUnusedParameters` 开启 → 未使用导入会编译失败
- 无测试框架;验证方式 = `npm run lint` + `npm run build` + `pages:dev` 手动验证

**共享接口(由各任务产出,后续任务依赖):**

```ts
// src/lib/date.ts
export function toIsoDate(date: Date): string
export function todayIso(): string
export function getThisWeekFriday(): string
export function isInThisWeek(dateStr: string): boolean
export function isInThisMonth(dateStr: string): boolean
export function getMonthKey(dateStr: string): string

// src/data/exercises.ts
export type ExerciseGuide = { id: string; name: string; target: string; steps: string[]; sets: string; tips: string[] }
export const exercises: ExerciseGuide[]

// tab 组件通用 props
type TabProps = {
  records: LifeRecord[]
  error: string
  onSave: (payload: Record<string, string | number | undefined>) => Promise<void>
  onDelete: (recordId: string) => Promise<void>
}
```

---

### Task 1: 数据库迁移与 schema

**Files:**
- Create: `migrations/2026-08-25-finance-types.sql`
- Modify: `schema.sql`(records 表 CHECK)
- Modify: `package.json`(新增 `db:migrate` script)

**Interfaces:**
- Produces: 迁移脚本可通过 `wrangler d1 execute jazz-life-tracker --local --file=./migrations/2026-08-25-finance-types.sql` 执行

- [ ] **Step 1: 创建迁移脚本**

Create `migrations/2026-08-25-finance-types.sql`:

```sql
DELETE FROM records WHERE type = 'exercise';

CREATE TABLE records_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'weight')),
  date TEXT NOT NULL,
  note TEXT,
  amount REAL,
  category TEXT,
  weight REAL,
  exercise_type TEXT,
  duration INTEGER,
  calories INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO records_new (id, user_id, type, date, note, amount, category, weight, exercise_type, duration, calories, created_at)
  SELECT id, user_id, type, date, note, amount, category, weight, exercise_type, duration, calories, created_at FROM records;

DROP TABLE records;
ALTER TABLE records_new RENAME TO records;
```

- [ ] **Step 2: 更新 schema.sql**

在 `schema.sql` 中把 `records` 表的 CHECK 行改为:

```sql
  type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'weight')),
```

(其余列定义不变。)

- [ ] **Step 3: 新增 npm script**

在 `package.json` 的 `scripts` 中,`db:apply` 行之后新增:

```json
    "db:migrate": "wrangler d1 execute jazz-life-tracker --local --file=./migrations/2026-08-25-finance-types.sql"
```

- [ ] **Step 4: 验证迁移**

Run:

```bash
cd /home/thens/Projects/jazz
npm run db:apply
npm run db:migrate
npx wrangler d1 execute jazz-life-tracker --local --command "PRAGMA table_info(records)"
```

Expected: 最后一条输出 `type` 行的 dflt/sql 含 `CHECK(type IN ('expense', 'income', 'weight'))`;且无报错。

- [ ] **Step 5: Commit**

```bash
git add migrations/2026-08-25-finance-types.sql schema.sql package.json package-lock.json
git commit -m "feat: 数据库迁移加入 income 类型并清理运动记录"
```

---

### Task 2: 后端 records POST 校验

**Files:**
- Modify: `functions/api/records.ts`(POST 校验与 INSERT bind)

**Interfaces:**
- Consumes: 无(不依赖前面任务)
- Produces: `/api/records` POST 接受 `type ∈ {expense, income, weight}`,校验规则如下

- [ ] **Step 1: 修改类型校验**

替换 `functions/api/records.ts` 中这段:

```ts
  if (!['expense', 'weight', 'exercise'].includes(type)) {
    return jsonResponse({ message: '类型不合法' }, { status: 400 })
  }
```

为:

```ts
  if (!['expense', 'income', 'weight'].includes(type)) {
    return jsonResponse({ message: '类型不合法' }, { status: 400 })
  }
```

- [ ] **Step 2: 替换 expense/weight/exercise 校验块**

替换整段:

```ts
  if (type === 'expense' && (Number(body.amount ?? 0) <= 0 || !body.category)) {
    return jsonResponse({ message: '记账必须提供金额和分类' }, { status: 400 })
  }

  if (type === 'weight' && Number(body.weight ?? 0) <= 0) {
    return jsonResponse({ message: '体重必须大于 0' }, { status: 400 })
  }

  if (type === 'exercise' && (Number(body.duration ?? 0) <= 0 || !body.exerciseType)) {
    return jsonResponse({ message: '运动必须提供类型和时长' }, { status: 400 })
  }
```

为:

```ts
  if ((type === 'expense' || type === 'income') && Number(body.amount ?? 0) <= 0) {
    return jsonResponse({ message: '金额必须大于 0' }, { status: 400 })
  }

  if (type === 'weight' && Number(body.weight ?? 0) <= 0) {
    return jsonResponse({ message: '体重必须大于 0' }, { status: 400 })
  }
```

- [ ] **Step 3: 修改 INSERT bind**

替换 INSERT `.bind(...)` 中的:

```ts
      type === 'expense' ? Number(body.amount ?? 0) : null,
      type === 'expense' ? (body.category ?? '其他') : null,
      type === 'weight' ? Number(body.weight ?? 0) : null,
      type === 'exercise' ? (body.exerciseType ?? '其他') : null,
      type === 'exercise' ? Number(body.duration ?? 0) : null,
      type === 'exercise' ? Number(body.calories ?? 0) : null,
```

为:

```ts
      type === 'expense' || type === 'income' ? Number(body.amount ?? 0) : null,
      type === 'expense' || type === 'income' ? (body.category ?? '其他') : null,
      type === 'weight' ? Number(body.weight ?? 0) : null,
      null,
      null,
      null,
```

(保持占位符数量不变,共 11 个。)

- [ ] **Step 4: 验证**

Run:

```bash
cd /home/thens/Projects/jazz
npm run lint
```

Expected: 无错误。再手动验证(需另开终端 `npm run build && npm run pages:dev` 启动服务,或用现有运行中的服务):

```bash
# 1) 登录拿 cookie
curl -s -c /tmp/jazz-cookies.txt -H 'Content-Type: application/json' \
  -d '{"email":"admin@life.local","password":"ChangeMe123!"}' \
  http://localhost:3000/api/auth/login
# 2) 新增收入记录 → 期望 {"ok":true,...}
curl -s -b /tmp/jazz-cookies.txt -H 'Content-Type: application/json' \
  -d '{"type":"income","date":"2026-08-25","amount":100,"category":"工资","note":"测试"}' \
  http://localhost:3000/api/records
# 3) exercise 类型 → 期望 400 {"message":"类型不合法"}
curl -s -b /tmp/jazz-cookies.txt -H 'Content-Type: application/json' \
  -d '{"type":"exercise","duration":30}' \
  http://localhost:3000/api/records
```

- [ ] **Step 5: Commit**

```bash
git add functions/api/records.ts
git commit -m "feat: 后端支持 income 记录类型,移除 exercise 写入"
```

---

### Task 3: 类型扩展 + RecordList 收入支持

**Files:**
- Modify: `src/types.ts`
- Modify: `src/components/dashboard/RecordList.tsx`

**Interfaces:**
- Produces: `RecordType = 'expense' | 'income' | 'weight' | 'exercise'`(临时含 exercise,Task 10 移除);`RecordList` 支持 income 渲染

> 说明:RecordType 临时保留 `'exercise'`,避免改动 types 时破坏尚未重构的旧 App / RecordForm 编译;Task 9 重构后 Task 10 移除。

- [ ] **Step 1: 更新 types.ts**

将 `src/types.ts` 的 `RecordType` 改为:

```ts
export type RecordType = 'expense' | 'income' | 'weight' | 'exercise'
```

(`LifeRecord`、`RecordFormData` 保持不动,Task 10 再精简。)

- [ ] **Step 2: 更新 RecordList 支持收入**

整体替换 `src/components/dashboard/RecordList.tsx` 中 `records.map(...)` 内的三处派生逻辑:

```tsx
              const badgeMap = {
                expense: '支',
                income: '收',
                weight: '体',
                exercise: '运',
              }

              const valueText =
                record.type === 'expense'
                  ? `- ${currency.format(record.amount ?? 0)}`
                  : record.type === 'income'
                    ? `+ ${currency.format(record.amount ?? 0)}`
                    : record.type === 'weight'
                      ? `${record.weight?.toFixed(1)} kg`
                      : `${record.duration ?? 0} 分钟`

              const labelText =
                record.type === 'expense'
                  ? `${record.category ?? '其他'} · ${record.note || '消费记录'}`
                  : record.type === 'income'
                    ? `${record.category ?? '其他'} · ${record.note || '收入记录'}`
                    : record.type === 'weight'
                      ? `${record.weight?.toFixed(1)} kg · ${record.note || '体重记录'}`
                      : `${record.exerciseType ?? '运动'} · ${record.duration ?? 0} 分钟`
```

(其余 JSX 结构不变。)

- [ ] **Step 3: 验证**

Run:

```bash
cd /home/thens/Projects/jazz
npm run lint && npm run build
```

Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/components/dashboard/RecordList.tsx
git commit -m "feat: RecordType 加入 income,RecordList 支持收入展示"
```

---

### Task 4: 日期工具函数

**Files:**
- Create: `src/lib/date.ts`

**Interfaces:**
- Produces: 下方 6 个导出函数,供 WeightTab / FinanceTab / App 使用

- [ ] **Step 1: 创建 src/lib/date.ts**

```ts
export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayIso(): string {
  return toIsoDate(new Date())
}

// 本周五(以周一为一周起点)。周六/日返回本周已过去的周五。
export function getThisWeekFriday(): string {
  const now = new Date()
  const day = now.getDay() // 0=周日,1=周一…6=周六
  const diffToMonday = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diffToMonday)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  return toIsoDate(friday)
}

// dateStr 是否属于本周(周一为起点)
export function isInThisWeek(dateStr: string): boolean {
  const date = new Date(`${dateStr}T00:00:00`)
  const now = new Date()
  const day = now.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day
  const start = new Date(now)
  start.setDate(now.getDate() + diffToMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return date >= start && date <= end
}

// dateStr 是否属于本月
export function isInThisMonth(dateStr: string): boolean {
  const now = new Date()
  const date = new Date(`${dateStr}T00:00:00`)
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

// '2026-08' 月键(用于月度聚合)
export function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7)
}
```

- [ ] **Step 2: 验证**

Run:

```bash
cd /home/thens/Projects/jazz
npm run build
```

Expected: 通过(新文件无引用方,仅类型检查)。

- [ ] **Step 3: Commit**

```bash
git add src/lib/date.ts
git commit -m "feat: 添加日期工具函数(本周五/本周/本月/月键)"
```

---

### Task 5: 静态运动指导数据

**Files:**
- Create: `src/data/exercises.ts`

**Interfaces:**
- Produces: `ExerciseGuide` 类型与 `exercises` 数组,供 ExerciseTab 渲染

- [ ] **Step 1: 创建 src/data/exercises.ts**

```ts
export type ExerciseGuide = {
  id: string
  name: string
  target: string
  steps: string[]
  sets: string
  tips: string[]
}

export const exercises: ExerciseGuide[] = [
  {
    id: 'running',
    name: '跑步',
    target: '心肺、下肢耐力',
    sets: '每周 3-4 次,每次 30-45 分钟',
    steps: [
      '热身 5 分钟:快走或开合跳,活动踝膝髋关节',
      '前 5 分钟以慢速配速起步',
      '保持匀速,步频约 170-180 步/分钟',
      '结束前 5 分钟逐渐减速',
      '跑后静态拉伸大腿前后侧、小腿',
    ],
    tips: ['落地时前脚掌或全脚掌着地,避免脚后跟重砸', '躯干微前倾,摆臂自然前后摆动', '心率建议维持最大心率的 60%-75%'],
  },
  {
    id: 'strength',
    name: '健身(力量训练)',
    target: '全身肌群、基础代谢',
    sets: '每周 2-3 次,每次 45-60 分钟',
    steps: [
      '热身 5-10 分钟:慢跑加动态拉伸',
      '大肌群优先:深蹲、硬拉、卧推、划船',
      '每个动作 3-4 组,每组 8-12 次',
      '组间休息 60-90 秒',
      '训练后拉伸目标肌群',
    ],
    tips: ['动作全程保持核心收紧', '重量选择:最后一两次略显吃力为宜', '循序渐进,每周最多增加 5% 负重'],
  },
  {
    id: 'cycling',
    name: '骑行',
    target: '心肺、腿部耐力',
    sets: '每周 2-3 次,每次 45-60 分钟',
    steps: [
      '检查刹车、胎压、座椅高度',
      '低速热身 10 分钟',
      '保持 80-100 转/分钟踏频',
      '上坡减档保持踏频,不硬踩',
      '结束后慢骑放松 5 分钟',
    ],
    tips: ['座椅高度:踩到最低点时膝盖微屈为宜', '佩戴头盔,夜间开启前后灯', '路面湿滑减速慢行'],
  },
  {
    id: 'swimming',
    name: '游泳',
    target: '全身协调、心肺',
    sets: '每周 2 次,每次 30-40 分钟',
    steps: [
      '下水前热身 5 分钟',
      '先游 200-400 米慢速适应',
      '分组练习,如 10 组×50 米',
      '每组之间休息 30-60 秒',
      '出水后拉伸肩、背、大腿',
    ],
    tips: ['呼吸节奏:换气不憋气', '注意泳姿规范性,减少肩部损伤', '空腹或饱腹 1 小时内不宜下水'],
  },
  {
    id: 'yoga',
    name: '瑜伽',
    target: '柔韧、核心、放松',
    sets: '每周 2-4 次,每次 30-60 分钟',
    steps: [
      '呼吸热身:腹式呼吸 5 分钟',
      '基础体式:猫牛式、下犬式、婴儿式',
      '核心练习:平板支撑、船式',
      '平衡体式:树式、战士三式',
      '放松:摊尸式 5-10 分钟',
    ],
    tips: ['动作配合呼吸,不憋气', '拉伸有微酸即可,不追求剧痛', '经期或受伤时避免倒立体式'],
  },
  {
    id: 'walking',
    name: '散步/快走',
    target: '日常活动量、心肺',
    sets: '每周 5-7 次,每次 30-60 分钟',
    steps: [
      '穿舒适运动鞋',
      '快走前活动脚踝、膝关节',
      '保持抬头挺胸,自然摆臂',
      '步幅适中,每分钟 100-120 步',
      '结束时逐渐放缓',
    ],
    tips: ['保持微出汗、能交谈的强度', '饭后 30 分钟再走', '久坐办公者每小时起来走 5 分钟'],
  },
]
```

- [ ] **Step 2: 验证**

Run:

```bash
cd /home/thens/Projects/jazz
npm run build
```

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/data/exercises.ts
git commit -m "feat: 添加运动指导静态数据"
```

---

### Task 6: 安装 recharts + WeightTab

**Files:**
- Create: `src/components/tabs/WeightTab.tsx`
- Modify: `package.json` / `package-lock.json`(安装 recharts)

**Interfaces:**
- Consumes: `src/lib/date.ts`、`src/components/dashboard/StatCard`、`src/components/dashboard/RecordList`
- Produces: `export function WeightTab(props: { records: LifeRecord[]; error: string; onSave: (payload: Record<string, string | number | undefined>) => Promise<void>; onDelete: (recordId: string) => Promise<void> })`

- [ ] **Step 1: 安装 recharts**

Run:

```bash
cd /home/thens/Projects/jazz
npm install recharts@^3.10.1
```

Expected: package.json 新增 `"recharts": "^3.10.1"`。

- [ ] **Step 2: 创建 src/components/tabs/WeightTab.tsx**

```tsx
import { useMemo, useState, type FormEvent } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarClock, TrendingUp } from 'lucide-react'
import { RecordList } from '../dashboard/RecordList'
import { StatCard } from '../dashboard/StatCard'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { getThisWeekFriday, isInThisWeek, todayIso } from '../../lib/date'
import type { LifeRecord } from '../../types'

const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

type WeightTabProps = {
  records: LifeRecord[]
  error: string
  onSave: (payload: Record<string, string | number | undefined>) => Promise<void>
  onDelete: (recordId: string) => Promise<void>
}

export function WeightTab({ records, error, onSave, onDelete }: WeightTabProps) {
  const [date, setDate] = useState(getThisWeekFriday())
  const [weight, setWeight] = useState('')
  const [note, setNote] = useState('')

  const weightRecords = useMemo(
    () =>
      records
        .filter((record) => record.type === 'weight')
        .sort((left, right) => left.date.localeCompare(right.date)),
    [records],
  )

  const latest = weightRecords[weightRecords.length - 1] ?? null
  const change = useMemo(() => {
    if (weightRecords.length < 2) return null
    const last = weightRecords[weightRecords.length - 1]?.weight ?? 0
    const prev = weightRecords[weightRecords.length - 2]?.weight ?? 0
    return last - prev
  }, [weightRecords])
  const recordedThisWeek = weightRecords.some((record) => isInThisWeek(record.date))

  const chartData = weightRecords.map((record) => ({ date: record.date, weight: record.weight ?? 0 }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSave({ type: 'weight', date: date || todayIso(), note, weight: Number(weight || 0) })
    setWeight('')
    setNote('')
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="最新体重"
          value={latest ? `${latest.weight?.toFixed(1)} kg` : '--'}
          detail={latest ? `记录于 ${latest.date}` : '暂无体重记录'}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="violet"
        />
        <StatCard
          title="较上次变化"
          value={change === null ? '--' : `${change >= 0 ? '+' : ''}${change.toFixed(1)} kg`}
          detail="最近两次记录差值"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          title="本周状态"
          value={recordedThisWeek ? '已记录' : '待记录'}
          detail={`建议每周五记录 · 本周五 ${getThisWeekFriday()}`}
          icon={<CalendarClock className="h-5 w-5" />}
          tone="orange"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>记录体重</CardTitle>
            <CardDescription>每周五记录一次,追踪变化趋势。</CardDescription>
          </CardHeader>
          <CardContent>
            {recordedThisWeek ? (
              <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                本周已记录体重,如需更新可直接修改后保存。
              </div>
            ) : null}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="weight-date">日期</Label>
                  <Input id="weight-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight-value">体重（kg）</Label>
                  <Input id="weight-value" type="number" step="0.1" min="20" max="300" placeholder="68.5" value={weight} onChange={(event) => setWeight(event.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="weight-note">备注</Label>
                  <Input id="weight-note" value={note} placeholder="例如：晨间空腹、运动后" onChange={(event) => setNote(event.target.value)} />
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit">保存记录</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>体重趋势</CardTitle>
            <CardDescription>全部体重记录的变化曲线</CardDescription>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                暂无体重数据,记录后即可查看趋势。
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" name="体重 (kg)" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <RecordList records={weightRecords} onDelete={onDelete} currency={currency} />
    </div>
  )
}
```

- [ ] **Step 3: 验证**

Run:

```bash
cd /home/thens/Projects/jazz
npm run lint && npm run build
```

Expected: 通过(WeightTab 尚未被引用,不影响构建)。

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/tabs/WeightTab.tsx
git commit -m "feat: 新增体重 tab(表单/本周软提醒/趋势图)"
```

---

### Task 7: FinanceTab(收支记录 + 月度图表 + 分类分布)

**Files:**
- Create: `src/components/tabs/FinanceTab.tsx`

**Interfaces:**
- Consumes: `src/lib/date.ts`、`src/components/dashboard/ExpenseBreakdown`、`src/components/dashboard/RecordList`、`src/components/dashboard/StatCard`
- Produces: `export function FinanceTab(props: { records: LifeRecord[]; error: string; onSave: (payload: Record<string, string | number | undefined>) => Promise<void>; onDelete: (recordId: string) => Promise<void> })`

- [ ] **Step 1: 创建 src/components/tabs/FinanceTab.tsx**

```tsx
import { useMemo, useState, type FormEvent } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CircleDollarSign, PiggyBank, Wallet } from 'lucide-react'
import { ExpenseBreakdown } from '../dashboard/ExpenseBreakdown'
import { RecordList } from '../dashboard/RecordList'
import { StatCard } from '../dashboard/StatCard'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { getMonthKey, isInThisMonth, todayIso } from '../../lib/date'
import type { LifeRecord, RecordType } from '../../types'

const currency = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' })

const expenseCategories = ['餐饮', '购物', '交通', '娱乐', '生活', '医疗', '其他']
const incomeCategories = ['工资', '奖金', '副业', '理财', '其他']

type FinanceTabProps = {
  records: LifeRecord[]
  error: string
  onSave: (payload: Record<string, string | number | undefined>) => Promise<void>
  onDelete: (recordId: string) => Promise<void>
}

export function FinanceTab({ records, error, onSave, onDelete }: FinanceTabProps) {
  const [type, setType] = useState<RecordType>('expense')
  const [date, setDate] = useState(todayIso())
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('餐饮')
  const [note, setNote] = useState('')

  const financeRecords = useMemo(
    () => records.filter((record) => record.type === 'expense' || record.type === 'income'),
    [records],
  )

  const monthExpense = useMemo(
    () =>
      financeRecords
        .filter((record) => record.type === 'expense' && isInThisMonth(record.date))
        .reduce((total, record) => total + Number(record.amount ?? 0), 0),
    [financeRecords],
  )

  const monthIncome = useMemo(
    () =>
      financeRecords
        .filter((record) => record.type === 'income' && isInThisMonth(record.date))
        .reduce((total, record) => total + Number(record.amount ?? 0), 0),
    [financeRecords],
  )

  const monthCount = financeRecords.filter((record) => isInThisMonth(record.date)).length

  const expenseBreakdown = useMemo(() => {
    const totals = new Map<string, number>()
    financeRecords
      .filter((record) => record.type === 'expense')
      .forEach((record) => {
        const key = record.category ?? '其他'
        totals.set(key, (totals.get(key) ?? 0) + Number(record.amount ?? 0))
      })
    return Array.from(totals.entries()).sort((left, right) => right[1] - left[1])
  }, [financeRecords])

  const chartData = useMemo(() => {
    const months = new Map<string, { month: string; income: number; expense: number }>()
    financeRecords.forEach((record) => {
      const key = getMonthKey(record.date)
      const entry = months.get(key) ?? { month: key, income: 0, expense: 0 }
      if (record.type === 'income') entry.income += Number(record.amount ?? 0)
      else entry.expense += Number(record.amount ?? 0)
      months.set(key, entry)
    })
    return Array.from(months.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((entry) => ({ ...entry, net: entry.income - entry.expense }))
  }, [financeRecords])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSave({
      type,
      date: date || todayIso(),
      note,
      amount: Number(amount || 0),
      category,
    })
    setAmount('')
    setNote('')
  }

  const categories = type === 'expense' ? expenseCategories : incomeCategories

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="本月支出"
          value={currency.format(monthExpense)}
          detail="本月累计支出"
          icon={<CircleDollarSign className="h-5 w-5" />}
          tone="orange"
        />
        <StatCard
          title="本月收入"
          value={currency.format(monthIncome)}
          detail="本月累计收入"
          icon={<PiggyBank className="h-5 w-5" />}
          tone="emerald"
        />
        <StatCard
          title="本月结余"
          value={currency.format(monthIncome - monthExpense)}
          detail={monthCount > 0 ? `本月已记录 ${monthCount} 笔` : '本月暂无记录'}
          icon={<Wallet className="h-5 w-5" />}
          tone="violet"
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>记录收支</CardTitle>
            <CardDescription>收入与支出分开记录,月度自动汇总。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-5 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={type === 'expense' ? 'default' : 'secondary'}
                onClick={() => setType('expense')}
                className="rounded-full"
              >
                支出
              </Button>
              <Button
                type="button"
                variant={type === 'income' ? 'default' : 'secondary'}
                onClick={() => setType('income')}
                className="rounded-full"
              >
                收入
              </Button>
            </div>
            {monthCount > 0 ? (
              <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
                本月已记录 {monthCount} 笔收支,建议每月底盘点一次。
              </div>
            ) : null}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="finance-date">日期</Label>
                  <Input id="finance-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-amount">金额</Label>
                  <Input id="finance-amount" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-category">分类</Label>
                  <select
                    id="finance-category"
                    className="flex h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  >
                    {categories.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="finance-note">备注</Label>
                  <Input id="finance-note" value={note} placeholder="例如：日常采购、工资入账" onChange={(event) => setNote(event.target.value)} />
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
              ) : null}

              <div className="flex justify-end">
                <Button type="submit">保存记录</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <ExpenseBreakdown breakdown={expenseBreakdown} total={monthExpense} currency={currency} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>收支趋势</CardTitle>
          <CardDescription>按月汇总收入、支出与结余</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
              暂无收支数据,记录后即可查看月度趋势。
            </div>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="income" name="收入" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="支出" fill="#f97316" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="net" name="结余" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <RecordList records={financeRecords} onDelete={onDelete} currency={currency} />
    </div>
  )
}
```

- [ ] **Step 2: 验证**

Run:

```bash
cd /home/thens/Projects/jazz
npm run lint && npm run build
```

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/components/tabs/FinanceTab.tsx
git commit -m "feat: 新增财务 tab(收支记录/月度图表/分类分布)"
```

---

### Task 8: ExerciseTab(静态运动指导)

**Files:**
- Create: `src/components/tabs/ExerciseTab.tsx`

**Interfaces:**
- Consumes: `src/data/exercises.ts`
- Produces: `export function ExerciseTab()`(无 props)

- [ ] **Step 1: 创建 src/components/tabs/ExerciseTab.tsx**

```tsx
import { Dumbbell } from 'lucide-react'
import { exercises, type ExerciseGuide } from '../../data/exercises'
import { Badge } from '../ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

function ExerciseCard({ guide }: { guide: ExerciseGuide }) {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>{guide.name}</CardTitle>
          <Badge variant="secondary">{guide.sets}</Badge>
        </div>
        <CardDescription>目标: {guide.target}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">动作步骤</h4>
          <ol className="space-y-1.5 text-sm text-slate-600">
            {guide.steps.map((step, index) => (
              <li key={index} className="flex gap-2">
                <span className="font-medium text-slate-400">{index + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-slate-900">注意事项</h4>
          <ul className="space-y-1.5 text-sm text-slate-600">
            {guide.tips.map((tip, index) => (
              <li key={index} className="flex gap-2">
                <span className="text-emerald-500">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}

export function ExerciseTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>运动指导</CardTitle>
            <CardDescription>动作要领与建议,帮助你科学运动。运动数据不做记录。</CardDescription>
          </div>
          <Badge variant="secondary" className="inline-flex items-center gap-2">
            <Dumbbell className="h-3.5 w-3.5" />
            {exercises.length} 项
          </Badge>
        </CardHeader>
      </Card>
      <section className="grid gap-6 md:grid-cols-2">
        {exercises.map((guide) => (
          <ExerciseCard key={guide.id} guide={guide} />
        ))}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: 验证**

Run:

```bash
cd /home/thens/Projects/jazz
npm run lint && npm run build
```

Expected: 通过。

- [ ] **Step 3: Commit**

```bash
git add src/components/tabs/ExerciseTab.tsx
git commit -m "feat: 新增运动 tab(静态动作指导,无数据记录)"
```

---

### Task 9: App 三 tab 重构 + 删除旧表单

**Files:**
- Modify: `src/App.tsx`(整文件重写)
- Delete: `src/components/dashboard/RecordForm.tsx`

**Interfaces:**
- Consumes: `src/components/tabs/WeightTab`、`src/components/tabs/FinanceTab`、`src/components/tabs/ExerciseTab`、`src/components/auth/LoginCard`、`src/lib/date.ts`、`src/types.ts`
- Produces: 新的默认导出 `App`,持有 auth/records/loading/error 状态与 CRUD,按 `activeTab` 渲染三个 tab

- [ ] **Step 1: 整文件重写 src/App.tsx**

替换 `src/App.tsx` 全部内容为:

```tsx
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Dumbbell, Loader2, LockKeyhole, LogOut, Scale, ShieldCheck, Wallet } from 'lucide-react'
import { LoginCard } from './components/auth/LoginCard'
import { ExerciseTab } from './components/tabs/ExerciseTab'
import { FinanceTab } from './components/tabs/FinanceTab'
import { WeightTab } from './components/tabs/WeightTab'
import { Button } from './components/ui/button'
import { todayIso } from './lib/date'
import type { LifeRecord, RecordType, UserProfile } from './types'

const DEV_USER = {
  id: 'dev-user-1',
  email: 'admin@life.local',
  name: '私密用户',
} as const

const DEV_STORAGE_KEY = 'jazz-life-tracker-dev-user'
const DEV_RECORDS_KEY = 'jazz-life-tracker-dev-records'

type TabId = 'weight' | 'finance' | 'exercise'

const TABS: Array<{ id: TabId; label: string; icon: ReactNode }> = [
  { id: 'weight', label: '体重', icon: <Scale className="h-4 w-4" /> },
  { id: 'finance', label: '财务', icon: <Wallet className="h-4 w-4" /> },
  { id: 'exercise', label: '运动', icon: <Dumbbell className="h-4 w-4" /> },
]

function getDevRecords(): LifeRecord[] {
  try {
    const raw = window.localStorage.getItem(DEV_RECORDS_KEY)
    if (!raw) {
      const seed: LifeRecord[] = [
        { id: 'seed-1', type: 'expense', date: '2026-08-20', amount: 68.5, category: '餐饮', note: '午餐和咖啡' },
        { id: 'seed-2', type: 'weight', date: '2026-08-22', weight: 68.4, note: '晨间空腹' },
      ]
      window.localStorage.setItem(DEV_RECORDS_KEY, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw) as LifeRecord[]
  } catch {
    return []
  }
}

function setDevRecords(records: LifeRecord[]) {
  window.localStorage.setItem(DEV_RECORDS_KEY, JSON.stringify(records))
}

function isLocalDevFallback() {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
}

function getDevAuth(): { user: UserProfile | null; records: LifeRecord[] } {
  const storedUser = window.localStorage.getItem(DEV_STORAGE_KEY)
  if (!storedUser) return { user: null, records: getDevRecords() }
  try {
    const user = JSON.parse(storedUser) as UserProfile
    return { user, records: getDevRecords() }
  } catch {
    return { user: null, records: getDevRecords() }
  }
}

function App() {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [records, setRecords] = useState<LifeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('weight')
  const [error, setError] = useState('')
  const [email, setEmail] = useState('admin@life.local')
  const [password, setPassword] = useState('ChangeMe123!')

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true)
      try {
        const meResponse = await fetch('/api/me', { credentials: 'include' })
        if (!meResponse.ok) {
          if (isLocalDevFallback()) {
            const fallback = getDevAuth()
            setUser(fallback.user)
            setRecords(fallback.records)
            return
          }
          setUser(null)
          return
        }
        const profile = (await meResponse.json()) as { user: UserProfile }
        setUser(profile.user)
        const recordsResponse = await fetch('/api/records', { credentials: 'include' })
        if (recordsResponse.ok) {
          const data = (await recordsResponse.json()) as { records: LifeRecord[] }
          setRecords(data.records)
        }
      } catch {
        if (isLocalDevFallback()) {
          const fallback = getDevAuth()
          setUser(fallback.user)
          setRecords(fallback.records)
        } else {
          setUser(null)
        }
      } finally {
        setLoading(false)
      }
    }
    void bootstrap()
  }, [])

  async function fetchRecords() {
    if (isLocalDevFallback()) {
      const devRecords = getDevRecords()
      setRecords(devRecords)
      return devRecords
    }
    const response = await fetch('/api/records', { credentials: 'include' })
    if (!response.ok) throw new Error('无法获取记录')
    const payload = (await response.json()) as { records: LifeRecord[] }
    setRecords(payload.records)
    return payload.records
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    if (isLocalDevFallback()) {
      const credentialsOk = email.trim().toLowerCase() === DEV_USER.email && password === 'ChangeMe123!'
      if (!credentialsOk) {
        setError('登录失败')
        return
      }
      const devUser = { ...DEV_USER, email: email.trim().toLowerCase() }
      window.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(devUser))
      setUser(devUser)
      setRecords(getDevRecords())
      return
    }
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const payload = (await response.json().catch(() => ({ message: '登录失败' }))) as {
      message?: string
      user?: UserProfile
    }
    if (!response.ok) {
      setError(payload.message ?? '登录失败')
      return
    }
    if (payload.user) {
      setUser(payload.user)
      await fetchRecords()
    }
  }

  async function handleLogout() {
    if (isLocalDevFallback()) {
      window.localStorage.removeItem(DEV_STORAGE_KEY)
      window.localStorage.removeItem(DEV_RECORDS_KEY)
      setUser(null)
      setRecords([])
      return
    }
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    setUser(null)
    setRecords([])
  }

  async function saveRecord(payload: Record<string, string | number | undefined>) {
    if (isLocalDevFallback()) {
      const type = String(payload.type) as RecordType
      const next = [...getDevRecords()]
      next.unshift({
        id: `dev-${Date.now()}`,
        type,
        date: String(payload.date ?? todayIso()),
        note: String(payload.note ?? ''),
        amount: type === 'expense' || type === 'income' ? Number(payload.amount ?? 0) : undefined,
        category: type === 'expense' || type === 'income' ? String(payload.category ?? '其他') : undefined,
        weight: type === 'weight' ? Number(payload.weight ?? 0) : undefined,
      })
      setDevRecords(next)
      setRecords(next)
      setError('')
      return
    }
    const response = await fetch('/api/records', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await response.json().catch(() => ({ message: '保存失败' }))) as { message?: string }
    if (!response.ok) {
      setError(data.message ?? '保存失败')
      return
    }
    setError('')
    await fetchRecords()
  }

  async function deleteRecord(recordId: string) {
    if (isLocalDevFallback()) {
      const next = getDevRecords().filter((record) => record.id !== recordId)
      setDevRecords(next)
      setRecords(next)
      return
    }
    const response = await fetch(`/api/records?id=${recordId}`, { method: 'DELETE', credentials: 'include' })
    if (response.ok) {
      setRecords((current) => current.filter((record) => record.id !== recordId))
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在检查会话…</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <LoginCard
        email={email}
        password={password}
        error={error}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleLogin}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#edf2ff_35%,_#f8fafc)] p-4 text-slate-700 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              私密生活管理
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">生活记录仪</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
              {user.email}
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              退出
            </Button>
          </div>
        </header>

        <nav className="flex gap-2">
          {TABS.map((tab) => (
            <Button
              key={tab.id}
              type="button"
              variant={activeTab === tab.id ? 'default' : 'secondary'}
              onClick={() => setActiveTab(tab.id)}
              className="rounded-full"
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </Button>
          ))}
        </nav>

        {activeTab === 'weight' ? (
          <WeightTab records={records} error={error} onSave={saveRecord} onDelete={deleteRecord} />
        ) : activeTab === 'finance' ? (
          <FinanceTab records={records} error={error} onSave={saveRecord} onDelete={deleteRecord} />
        ) : (
          <ExerciseTab />
        )}

        <footer className="flex items-center justify-center gap-2 pb-4 text-sm text-slate-500">
          <LockKeyhole className="h-4 w-4" />
          通过安全会话和 D1 数据隔离保护你的隐私。
        </footer>
      </div>
    </div>
  )
}

export default App
```

- [ ] **Step 2: 删除旧表单组件**

Run:

```bash
rm /home/thens/Projects/jazz/src/components/dashboard/RecordForm.tsx
```

(RecordForm 现无任何引用,其 exercise 表单已被 tab 取代。)

- [ ] **Step 3: 验证**

Run:

```bash
cd /home/thens/Projects/jazz
npm run lint && npm run build
```

Expected: 通过,且无未使用变量/导入报错。

- [ ] **Step 4: Commit**

```bash
git add -A src/App.tsx src/components/dashboard/RecordForm.tsx
git commit -m "refactor: App 改为三 tab 布局,接入体重/财务/运动 tab"
```

---

### Task 10: 类型收尾(移除 exercise)

**Files:**
- Modify: `src/types.ts`
- Modify: `src/components/dashboard/RecordList.tsx`

**Interfaces:**
- Produces: 最终 `RecordType = 'expense' | 'income' | 'weight'`;`RecordFormData` 精简;`RecordList` 移除 exercise 分支

- [ ] **Step 1: 更新 types.ts**

将 `src/types.ts` 中 `RecordType` 与 `RecordFormData` 改为:

```ts
export type RecordType = 'expense' | 'income' | 'weight'

export type RecordFormData = {
  date: string
  amount: string
  category: string
  note: string
  weight: string
}
```

(`LifeRecord` 保持不变,exerciseType/duration/calories 保留为可选字段作读兼容。)

- [ ] **Step 2: 更新 RecordList 移除 exercise**

将 `src/components/dashboard/RecordList.tsx` 中 `badgeMap` 与两个派生文本改为(整体替换):

```tsx
              const badgeMap = {
                expense: '支',
                income: '收',
                weight: '体',
              }

              const valueText =
                record.type === 'expense'
                  ? `- ${currency.format(record.amount ?? 0)}`
                  : record.type === 'income'
                    ? `+ ${currency.format(record.amount ?? 0)}`
                    : `${record.weight?.toFixed(1)} kg`

              const labelText =
                record.type === 'expense'
                  ? `${record.category ?? '其他'} · ${record.note || '消费记录'}`
                  : record.type === 'income'
                    ? `${record.category ?? '其他'} · ${record.note || '收入记录'}`
                    : `${record.weight?.toFixed(1)} kg · ${record.note || '体重记录'}`
```

- [ ] **Step 3: 验证**

Run:

```bash
cd /home/thens/Projects/jazz
npm run lint && npm run build
```

Expected: 通过。

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/components/dashboard/RecordList.tsx
git commit -m "refactor: RecordType 移除 exercise,精简表单类型"
```

---

### Task 11: 文档更新 + 端到端验证

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:**
- Produces: 文档反映三 tab 架构、`db:migrate` 命令、recharts 依赖

- [ ] **Step 1: 更新 CLAUDE.md**

在 `CLAUDE.md` 中:

1. 命令区 `db:apply` 行后新增:
   ```bash
   npm run db:migrate        # 执行 migrations/ 下迁移(表重建加入 income)
   ```
2. 技术栈行 `Shadcn 风格组件` 后追加 `+ recharts 图表`
3. 「数据模型」小节改为:`records.type` ∈ `('expense','income','weight')`;支出/收入共用 `amount`/`category`,体重用 `weight`;exercise 列保留不写入
4. 「前端」小节改为:App 持有状态与 CRUD,三个受控 tab 组件(`src/components/tabs/`);体重/财务 tab 前端 `useMemo` 聚合图表数据;运动 tab 为静态指导(`src/data/exercises.ts`),无数据记录
5. 「本地开发回退」补充:迁移需按 `db:apply` → `db:migrate` 顺序

- [ ] **Step 2: 更新 README.md**

在「本地开发」节补一条:

```bash
npm run db:migrate
```

并在功能列表改为:

```
- 记账：收入 + 支出记录、分类统计、月度收支图表
- 体重：每周五记录、趋势图表
- 运动：运动动作指导（纯静态,不记录数据）
- 安全访问：登录后才可查看和编辑数据
- 私密存储：所有记录绑定当前用户,保存在 D1 中
```

- [ ] **Step 3: 端到端手动验证**

Run(本地全栈):

```bash
cd /home/thens/Projects/jazz
npm run lint
npm run build
npm run db:apply
npm run db:migrate
npm run pages:dev
```

浏览器打开 `http://localhost:3000`,逐项确认:

- [ ] 登录页正常,默认账户可登录
- [ ] 顶部三 tab(体重/财务/运动)可切换
- [ ] 体重 tab:日期默认为本周五;新增体重记录后「最新体重」卡更新、趋势图出现点与连线;再次记录时出现「本周已记录」banner;记录列表可删除
- [ ] 财务 tab:支出/收入切换正常;新增支出与收入各一条;「本月支出/收入/结余」统计正确;收支趋势图按月聚合;分类分布显示支出分类;列表收入显示 `+`、支出显示 `-`
- [ ] 运动 tab:显示 6 张运动指导卡片(名称/频率/步骤/注意事项),无表单
- [ ] 退出登录后回到登录页
- [ ] (若本地 DB 有旧运动记录)迁移后运动记录已清除,不再出现在任何列表

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: 更新三 tab 架构说明与迁移命令"
```
