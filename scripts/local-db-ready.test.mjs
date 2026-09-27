// @vitest-environment node
// 前置闸的判定必须**永不误判为 skip**:误 skip 等于把「本地库落后 → worker 500」那个事故放回来。
// 这里逐条钉住「宁可回落 wrangler」的边界。

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { decide } from './local-db-ready.mjs'

let root
let d1Dir
let migrationsDir

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'db-ready-'))
  d1Dir = join(root, 'd1')
  migrationsDir = join(root, 'migrations')
  mkdirSync(d1Dir, { recursive: true })
  mkdirSync(migrationsDir, { recursive: true })
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function writeMigrations(...names) {
  for (const name of names) writeFileSync(join(migrationsDir, name), '-- noop\n')
}

function writeDatabase(file, applied, { tracked = true } = {}) {
  const db = new DatabaseSync(join(d1Dir, file))
  db.exec(
    tracked
      ? 'CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, applied_at TEXT)'
      : 'CREATE TABLE _cf_ALARM (id INTEGER PRIMARY KEY)',
  )
  if (tracked) {
    const insert = db.prepare('INSERT INTO d1_migrations (name) VALUES (?)')
    for (const name of applied) insert.run(name)
  }
  db.close()
}

const check = () => decide({ d1Dir, migrationsDir, DatabaseSync })

describe('local-db-ready 判定', () => {
  it('migrations/ 为空时回落 wrangler', () => {
    writeDatabase('a.sqlite', [])
    expect(check().action).toBe('wrangler')
  })

  it('本地 state 目录不存在(全新环境)时回落 wrangler', () => {
    writeMigrations('0001_init.sql')
    rmSync(d1Dir, { recursive: true, force: true })
    expect(check().action).toBe('wrangler')
  })

  it('库缺一个迁移时回落 wrangler —— 这正是当初 500 的现场', () => {
    writeMigrations('0001_init.sql', '0008_pinyin_progress.sql')
    writeDatabase('a.sqlite', ['0001_init.sql'])
    const result = check()
    expect(result.action).toBe('wrangler')
    expect(result.reason).toContain('0008_pinyin_progress.sql')
  })

  it('库已记录全部迁移时跳过 wrangler', () => {
    writeMigrations('0001_init.sql', '0002_fun.sql')
    writeDatabase('a.sqlite', ['0001_init.sql', '0002_fun.sql'])
    expect(check()).toMatchObject({ action: 'skip', migrations: 2, databases: 1 })
  })

  it('库记录多于磁盘(迁移文件被删)仍跳过', () => {
    writeMigrations('0001_init.sql')
    writeDatabase('a.sqlite', ['0001_init.sql', '0002_gone.sql'])
    expect(check().action).toBe('skip')
  })

  it('miniflare 自带的 metadata.sqlite 被忽略,不影响跳过', () => {
    writeMigrations('0001_init.sql')
    writeDatabase('a.sqlite', ['0001_init.sql'])
    writeDatabase('metadata.sqlite', [], { tracked: false })
    expect(check().action).toBe('skip')
  })

  it('出现不认识的 .sqlite(无 d1_migrations)时回落 wrangler', () => {
    writeMigrations('0001_init.sql')
    writeDatabase('a.sqlite', ['0001_init.sql'])
    writeDatabase('mystery.sqlite', [], { tracked: false })
    expect(check().action).toBe('wrangler')
  })

  it('多库时任一库落后即回落 wrangler', () => {
    writeMigrations('0001_init.sql', '0002_fun.sql')
    writeDatabase('a.sqlite', ['0001_init.sql', '0002_fun.sql'])
    writeDatabase('b.sqlite', ['0001_init.sql'])
    expect(check().action).toBe('wrangler')
  })

  it('库文件打不开(不是 sqlite)时回落 wrangler', () => {
    writeMigrations('0001_init.sql')
    writeFileSync(join(d1Dir, 'broken.sqlite'), 'not a database')
    expect(check().action).toBe('wrangler')
  })

  it('没有库文件时回落 wrangler', () => {
    writeMigrations('0001_init.sql')
    expect(check().action).toBe('wrangler')
  })
})
