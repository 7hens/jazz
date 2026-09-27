#!/usr/bin/env node
// `npm run dev` 的本地 D1 前置闸:没有挂起迁移时直接放行,省掉 wrangler CLI 的一次冷启动(实测 ~2.3s)。
//
// 安全论证:判定依据是 d1_migrations 表本身 —— 与 wrangler 自己读的是**同一张表、同一个文件**,
// 所以「误判为无挂起」不可达。唯一真实风险是**认错库文件**,故一律取保守侧:任何不确定都回落
// 到 wrangler。回落走 `npm run db:local`(不自己拼命令),`--config wrangler.toml` 红线仍只有一处。
//
// 回落到 wrangler 的情形(全部只损失速度,不损失正确性):
//   找不到 state 目录 / migrations 目录为空 / 库文件打不开 / 出现不认识的 .sqlite /
//   任一本库缺迁移 / node:sqlite 不可用 / 前置检查自身抛错。
//
// 迁移失败必须阻断 dev:回落时透传 `npm run db:local` 的退出码。

import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const D1_DIR = join(ROOT, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject')
const MIGRATIONS_DIR = join(ROOT, 'migrations')

/** miniflare 在 D1 对象目录里自带的簿记库,不是用户库;按名排除。 */
const MINIFLARE_BOOKKEEPING = 'metadata.sqlite'

/** `migrations/` 下的迁移文件名(与 d1_migrations.name 同一套写法)。 */
export function diskMigrations(migrationsDir) {
  return readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
}

/**
 * 纯判定:该跳过 wrangler,还是交给它?
 * 只看两处输入的状态,不做任何副作用,便于测试。
 */
export function decide({ d1Dir, migrationsDir, DatabaseSync }) {
  const disk = diskMigrations(migrationsDir)
  if (disk.length === 0) return { action: 'wrangler', reason: 'migrations/ 下没有迁移文件' }
  if (!existsSync(d1Dir)) return { action: 'wrangler', reason: '本地 D1 state 不存在(全新环境)' }

  const files = readdirSync(d1Dir).filter((f) => f.endsWith('.sqlite'))
  if (files.length === 0) return { action: 'wrangler', reason: '本地 D1 目录下没有库文件' }

  const tracked = []
  for (const file of files) {
    if (file === MINIFLARE_BOOKKEEPING) continue

    let db
    try {
      db = new DatabaseSync(join(d1Dir, file), { readOnly: true })
    } catch (err) {
      // 打不开 = 说不清它是什么,不敢当作「不需要迁移」。
      return { action: 'wrangler', reason: `打不开 ${file}(${err.message})` }
    }

    try {
      const names = db.prepare('SELECT name FROM d1_migrations').all().map((r) => r.name)
      tracked.push({ file, names })
    } catch {
      // 能打开但没有 d1_migrations:不是被迁移跟踪的库,不能当作「已最新」。
      return { action: 'wrangler', reason: `${file} 没有被迁移跟踪过` }
    } finally {
      db.close()
    }
  }

  if (tracked.length === 0) return { action: 'wrangler', reason: '未找到任何被迁移跟踪的本地库' }

  for (const { file, names } of tracked) {
    const missing = disk.filter((name) => !names.includes(name))
    if (missing.length > 0) {
      return { action: 'wrangler', reason: `${file} 缺 ${missing.length} 个迁移(${missing[0]}…)` }
    }
  }

  return { action: 'skip', migrations: disk.length, databases: tracked.length }
}

async function main() {
  let decision
  try {
    const { DatabaseSync } = await import('node:sqlite')
    decision = decide({ d1Dir: D1_DIR, migrationsDir: MIGRATIONS_DIR, DatabaseSync })
  } catch (err) {
    decision = { action: 'wrangler', reason: `前置检查不可用(${err.message})` }
  }

  if (decision.action === 'skip') {
    console.log(
      `✅ 本地 D1 已是最新(${decision.migrations} 个迁移,${decision.databases} 个库),跳过 wrangler CLI`,
    )
    return 0
  }

  console.log(`ℹ️  本地 D1 前置检查交由 wrangler:${decision.reason}`)
  const result = spawnSync('npm', ['run', 'db:local'], { stdio: 'inherit', shell: true })
  return result.status ?? 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(await main())
}
