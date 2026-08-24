# 隐私生活记录仪 三 Tab 重构设计

日期: 2026-08-25

## 背景与目标

将现有单页记录应用重构为三个独立 tab:体重 / 财务 / 运动。

- **体重 tab**: 每周五记录一次(软提醒),图表展示体重动态变化
- **财务 tab**: 记录收入与支出,月度收支图表,每月记录软提醒
- **运动 tab**: 仅提供运动动作指导(静态内容),不记录数据

## 决策记录

| 决策点 | 选择 |
|--------|------|
| tab 切换 | useState 状态切换,不引入路由库 |
| 图表库 | recharts ^3.10.1(支持 React 19) |
| 收入表示 | 新增 `type='income'`,与 expense 共用 amount/category/note 列 |
| 记录节奏约束 | 软提醒:表单默认日期 + 已记录 banner,不强制拦截 |
| 旧运动数据 | 迁移时删除 DB 中 `type='exercise'` 记录 |

## 数据模型改动 (schema.sql)

`records.type` 的 CHECK 约束改为 `('expense','income','weight')`。

- expense: `amount` + `category` + `note`
- income: `amount` + `category`(可选)+ `note`
- weight: `weight` + `note`

现有 DB 的 CHECK 不含 `income`,直接插入会被 SQLite 拒绝,因此必须重建表。

### 迁移 `migrations/2026-08-25-finance-types.sql`

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

(保留 exercise_type/duration/calories 列为兼容,新写入不会使用。)

### schema.sql

`schema.sql` 中 `records` 表定义改为新 CHECK(`('expense','income','weight')`),供全新环境 `db:apply` 使用。

### npm 脚本

新增 `db:migrate`: `wrangler d1 execute jazz-life-tracker --local --file=./migrations/2026-08-25-finance-types.sql`

本地迁移顺序: `db:apply`(新建)→ `db:migrate`(重建)。远程首次部署:手动执行迁移 SQL。

## 后端改动 (`functions/api/records.ts`)

POST 校验逻辑:

- expense: 需 `amount > 0` 且 `category` 非空(保持现行为)
- income: 需 `amount > 0`,`category` 可选,缺省存 `'其他'`
- weight: 需 `weight > 0`
- 删除 exercise 分支与相关校验

GET / DELETE 不变。`me.ts` / `auth/*` 不变。

## 前端改动

### `src/types.ts`

```ts
export type RecordType = 'expense' | 'income' | 'weight'
```

- `RecordFormData`: 移除 exerciseType/duration/calories,新增收入表单所需字段(复用 amount/category)
- `LifeRecord`: 保留 exerciseType/duration/calories 为可选字段(读兼容,不再写入)

### `src/App.tsx`

- 保留:登录门槛、header、登出、`/api/me` + `/api/records` 引导、本地 localStorage 回退
- 改为:登录后主体渲染 3 tab 导航 + 当前 tab 组件
- 删除:recordType 三态表单、exercise 相关 UI、`renderMiniForm`、weeklyMinutes 统计、最新体重卡(移入 tab)
- 保留:monthExpense、expenseBreakdown(移入 FinanceTab)

### 新增 tab 组件

`src/components/tabs/`:

- **WeightTab.tsx**
  - 表单:日期(默认本周五)+ 体重 + 备注
  - 软提醒:本周(周一~周日)已有 weight 记录 → banner「本周已记录」
  - 图表:recharts LineChart,日期×体重
  - 数据:该用户全部 weight 记录
- **FinanceTab.tsx**
  - 表单:类型切换(收入/支出)+ 金额 + 分类 + 备注 + 日期(默认今天)
  - 软提醒:本月已有 expense/income 记录 → banner「本月已记录 X 笔」
  - 图表:recharts BarChart,按月聚合收入/支出 + 结余 Line
  - 分类分布:迁移现有 expenseBreakdown(仅支出分类)
  - 数据:该用户全部 expense/income 记录
- **ExerciseTab.tsx**
  - 纯静态指导卡片,无数据记录、无表单
  - 数据源 `src/data/exercises.ts`

### `src/data/exercises.ts`

静态运动指导内容,每条含:名称、目标部位、动作步骤、每组次数/组数、注意事项。覆盖:跑步、健身、骑行、游泳、瑜伽、散步等。

### 图表

- WeightChart: LineChart, `date`(x)×`weight`(y),按日期升序
- FinanceChart: recharts ComposedChart — Bar(收入/支出,按月聚合)+ Line(结余=收入-支出)

### 软提醒工具函数

- `getThisWeekFriday()`:本周五日期(若今天为周五则返回今天)
- `hasWeightRecordThisWeek(records)`:周一~周日范围内是否存在 weight 记录
- `hasFinanceRecordThisMonth(records)`:本月是否存在 expense/income 记录

### 统计计算

全部前端 `useMemo` 计算,不新增后端 API。图表数据同样由前端从已拉取记录聚合。

## 数据流

登录后 `App.tsx` 拉取 `/api/me` + `/api/records`(现有逻辑)。**App 持有 records 状态与 CRUD 函数(handleSave/handleDelete/fetchRecords),各 tab 作为受控组件接收 `records` + 回调 props。** 不新增后端 API。

## 本地开发回退

`isLocalDevFallback()` 逻辑保留。localStorage 回退需支持 income 类型;种子数据保留 expense/weight。exercise 相关回退逻辑删除。

## 错误处理

沿用现有模式:后端校验失败返回中文 message + 4xx;前端表单展示 error;未授权 401 由现有逻辑处理。

## 验证

无测试框架。验证方式:

1. `npm run lint` + `npm run build` 通过
2. `npm run db:apply` + `npm run db:migrate` 本地迁移成功
3. `npm run pages:dev` 手动验证:三 tab 切换、体重本周五默认值 + 软提醒、财务收入/支出记录 + 图表、运动静态指导、登录/登出、删除记录
