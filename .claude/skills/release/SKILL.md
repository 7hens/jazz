---
name: release
description: Use when user says 发布 / release / deploy to production / bump version / npm version / 打 tag on this 词库学习岛 project. Also for rollback or release-troubleshooting. Executes the worker deploy pipeline with hard human smoke gates.
---

# Release（词库学习岛生产发布）

## 核心原则

- **顺序不可逆**:迁移先升 → deploy → **浏览器冒烟通过 → 才 `npm version` 打 tag**。部署/冒烟失败 → 修完重来,**严禁 `npm version`**(防孤儿 tag)。
- **Violating 顺序 = violating 原则**。跳过冒烟直接打 tag 是不允许的。

## Preflight（先查,不满足不许动）

1. `git status` 干净、`git log --oneline -1` 确认在 main。
2. `package.json` version == 最近 tag(查 `git tag | tail -1`)——发布才升号,不提前。
3. `CHANGELOG.md` 已按「新增/修复/变更 ≤1 行」更新**并 commit**(发版前提交,随 release commit 一起走)。
4. 有表结构变更:新数字前缀迁移文件已在 `migrations/`,且本地 `npm run db:local` 验过。

## 流水线

1. **升库(仅当有迁移)**:先 preview 后 prod,绝不回滚:
   ```bash
   npx wrangler d1 migrations apply --config wrangler.toml jazz-life-tracker-preview --env preview --remote
   npx wrangler d1 migrations apply --config wrangler.toml jazz-life-tracker --remote
   ```
2. `npm run build`
3. `npm run deploy:preview` → 出新 preview URL。**preview DB 若空、未设 token**,登录会 401「未配置访问令牌」:生成随机 token 写入并告知用户冒烟用:
   ```bash
   printf 'jazz-preview-%s\n' "$(openssl rand -hex 16)" | npx wrangler secret put ADMIN_TOKEN --config wrangler.toml --env preview
   ```
4. **闸门①(预览冒烟)**:给用户 preview URL,等其浏览器完成核心 5 步(登录 → 词1 三技能+结算 +110 → 解锁词2 → 关拼音词2 只 2 步 → 刷新持久)。**未明确「通过」前停在原地**。勿用 curl 冒烟替代——本机网络连不上 `.workers.dev`。
5. `npm run deploy`(生产,默认 env)→ 记录输出 version id。
6. **闸门②(生产冒烟)**:给用户生产 URL,确认核心读写正常。
7. 两闸门都过后:`npm version minor -m "chore(release): v%s"`(bug=patch / 新能力=minor / 破坏=1.0.0 起 major)。
8. `git push origin main --tags`。

## 铁律与坑（每步都命中）

| 坑 | 对策 |
| --- | --- |
| `dist/jazz_life_tracker/wrangler.json` 劫持配置 | 每个 wrangler 命令**必带 `--config wrangler.toml`**,否则 env 失效、DB 回落到生产库 |
| 误加 `[env.production]` | 禁止。wrangler env 派生独立 worker,脱现域名/数据。生产 = 顶层默认 env |
| Dashboard 手改 Variables | 禁止。rollback 不恢复变量 → 旧代码读新变量白屏。变更走 config/`--var`/`wrangler secret` 随代码固化 |
| 覆盖 prod `ADMIN_TOKEN` | prod secret **已存在**,勿 `secret put` 覆盖,除非故意换 token(会致所有已存 cookie 失效) |
| preview 无 token | preview 需独立 secret(见步骤 3),prod secret 值 CLI 读不出,不可复制 |
| `.workers.dev` 本机网络不通 | curl/DNS 正常但边缘 IP 超时=网络墙,非 worker 故障;冒烟只能靠用户浏览器(其他网络)或自定义域名 |
| 部署失败还打 tag | 严禁。孤儿 tag。修好重 deploy 直到成功 |

## 回滚/出错分支

- **代码/前端错**:`npx wrangler rollback --config wrangler.toml`(<10s,前后端同切)。
- **env 配错**:改配置重新 deploy 固化,禁止 Dashboard。
- **D1 数据坏**:绝不回滚迁移文件;hotfix 改代码适配或 SQL 修复。
- **冒烟发现问题**:停,报用户现象 → systematic-debugging 修 → 重跑步骤 3-6,不直接 npm version。
