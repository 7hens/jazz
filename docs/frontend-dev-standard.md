# 前端开发规范(shared / features / app)

> 适用范围:本仓库前端 `src/`。**最终强制 = `src/architecture.test.ts`**(3 层边界 + useService 位置 + 注册纪律,违反即红);事实清单 = `CLAUDE.md`「前端(3 层)」节;设计沿革与取舍 = `docs/superpowers/specs/2026-09-04-dev-architecture-refactor-design.md`。本文只记操作规则,不重复实现,冲突以测试与源码为准。原 `docs/ideas/2026-09-04-dev-architecture.md` 详案已删(不再用 `docs/ideas/`)。

## 1 三层结构与依赖方向

```text
src/app/       调度:启动 bootstrap + 页面状态路由 + 跨 feature 组装(零业务规则、零 Page)
src/features/  业务:自包含模块(组件/逻辑/数据/测试),公共面 = 该目录 index.ts
src/shared/    基础:契约/纯逻辑/中性基础件/注册机制,无上层依赖
```

| 层 | 可依赖 | 禁止依赖 |
| :-- | :-- | :-- |
| `shared/` | 无 | features、app |
| `features/<f>/` | shared + 自身目录 | 其它 feature、app |
| `app/` | shared + feature 公共入口(index) | — |

铁律(测试强制):

- feature 间**禁编译期 import**;feature 不 import app;shared 不 import 任何上层。
- 被跨 feature 消费的纯规则/词库 → `shared/words.ts`、`shared/progress-rules.ts`;运行时行为 → 服务;禁止留在单 feature 内。
- app 不含业务规则(答题/结算/奖励/持久化),Page 组件属 feature。
- 中性视觉基础件在 `shared/ui/`(button/card/input/label/badge/select/chart-tooltip,features 可引);业务 UI 归各自 feature。

## 2 Feature 类型

| 类型 | 结构 | 跨 feature 消费 | Entry |
| :-- | :-- | :-- | :-- |
| 服务型 | `<name>.ts` 工厂 `create<Name>Service` + shared 接口 | 走接口 | 无 |
| 页面型 | `<Name>Entry.tsx` + 纯 UI 子组件 | — | 必有 |
| 数据+逻辑 | 自含数据/规则,不跨 feature | 不暴露 | 可无 |
| 纯 UI | props 接收一切 | — | 无 |

规则:凡被其它 feature 消费的纯逻辑/数据,必须上升为 shared 纯规则或服务;只在单 feature 内用则留本地。

## 3 Entry 与组装

- 页面型 feature 的 `<Name>Entry.tsx` 是 feature 内**唯一** `useService()` 位置;`app/` 组装 hook 也可用(取用纪律唯一例外)。
- Entry 职责:取服务 → 取数据 → 组装本 feature 纯 UI 子组件;导航回调(onExit / onNextWord / onClose…)由 app 注入 props。
- 纯 UI 组件零 useService、零跨 feature import,一切靠 props/回调。
- app 级跨 feature 组装提取为 `app/use*.ts` hook(如 `useCompletedWords`);`App.tsx` 只表页面状态 + 组合关系,保持精简。

## 4 服务系统

- 接口:`shared/services/<name>.ts`,**一文件一接口**;key 与类型映射集中 `keys.ts` / `map.ts`。
- 实现:`features/<f>/`,工厂**构造函数注入依赖**,不自行查注册表。
- 注册:`app/bootstrap.ts` 是**唯一**生产注册点(`main.tsx` 调 `bootstrap()`),按依赖顺序分层;测试各自 register fake 并以 `registry.clear()` 清理。
- 取用:`useService(key)`(经 `registry` 订阅注册);响应式服务状态订阅用 `useServiceSnapshot(service)`(`getSnapshot` 须返稳定引用)。
- 测试:纯逻辑直调;服务直调工厂(注入 fake 依赖 / rng);Entry 用 fake 注册后渲染断言组装。

## 5 命名

| 项 | 规范 | 例 |
| :-- | :-- | :-- |
| 目录 | kebab-case | `question-engine/` |
| 组件 / 类型 / 接口 | PascalCase | `WordLesson` / `WordUnit` / `ProgressService` |
| Entry | `<Name>Entry.tsx` | `LessonEntry.tsx` |
| 逻辑文件 | camelCase.ts | `engine.ts` / `progress-rules.ts` |
| 服务工厂 | `create<Name>Service` | `createWebSpeechService` |
| 服务 key 常量 | `keys.ts` 内 UPPER_SNAKE | `SERVICE_KEYS.PROGRESS` |
| 词库 / 全局常量 | UPPER_SNAKE | `WORDS` |
| 测试 | `<name>.test.ts` / `.test.tsx`,与被测同目录 | `engine.test.ts` |

## 6 Import 规范

允许:feature → shared;app → feature 公共入口(index)与 shared;同 feature 内部相对路径;一律别名 `@/`。
禁止:feature → 其它 feature;feature → app;深层相对路径(`../../features/…`);直 import 其它 feature 内部文件(不走 index);非 Entry 组件调 `useService`。

## 7 样式

- Tailwind 4;主题 token / 通用强调色在 `src/index.css`。
- 特殊动画用小 css 文件、与组件同目录;样式不跨 feature 引用。
- 中性基础件一律复用 `shared/ui`,业务侧不复刻。

## 8 客户端配置

客户端无自定义 `VITE_*`(无 mock / 无 base_url 分支),请求一律同源 `/api` + `credentials: 'include'`。未来若需配置,单点放 `app/bootstrap.ts` 读取注入,禁散落 feature。

## 9 测试

- 位置与源文件同目录。
- 覆盖:词库完整性 / 纯逻辑直调断言;服务(注入 fake,含加载 / 失败 / 乐观回滚);Entry 组装;`architecture.test.ts` 自动扫 3 层边界、useService 位置与注册纪律。
- 确定性:引擎等随机逻辑注入 rng;隔离用 `registry.clear()`。

## 10 新增 / 删除 feature

**新增服务型**:① `shared/services/<name>.ts` 写接口 → ② 登记 `keys.ts` / `map.ts` / `services/index.ts` → ③ `features/<name>/` 实现工厂 + `index.ts` → ④ `app/bootstrap.ts` 按依赖顺序注册。

**新增页面型**:① `features/<name>/` 建目录 + `<Name>Entry.tsx` + 纯 UI 子组件 + `index.ts` → ② app 接状态路由 / 组装。

**删除**:① grep 全仓引用 → ② 移除 app 路由 / 组装 → ③ 服务型同时移除接口、keys / map / index 登记与 bootstrap 注册 → ④ 删目录 → ⑤ `npm test && npx tsc -b && npm run lint` 全绿。

## 11 反模式速查

| 反模式 | 正确做法 |
| :-- | :-- |
| features/a import features/b | 服务接口 / shared 纯规则解耦 |
| 非 Entry 调 useService | props 注入 |
| app 存 Page / 写业务逻辑 | Page 归 feature,规则归 shared |
| 跨 feature 消费的逻辑不上升 | 升级服务或 shared |
| 多处 `registry.register` | 仅 bootstrap |
| 服务接口一文件多接口 | 一文件一接口 |
| 深相对 / 直 import feature 内部文件 | `@/` 别名 + 只走 index |
| 配置散落各 feature | bootstrap 单点 |

## 12 审查清单

- 命名合规;feature 有 `index.ts` 且只导公共 API;一律 `@/` 别名。
- 纯 UI 不 useService;Entry 是 feature 内唯一 useService;app 组装 hook 例外。
- 接口在 `shared/services/`;实现走工厂;注册仅在 bootstrap。
- feature 零跨引用;改词库只动 `shared/words.ts`,改规则先看对应纯逻辑与其测试。
- 纯逻辑有单测;`tsc -b` / `lint` / `test` 全绿。
