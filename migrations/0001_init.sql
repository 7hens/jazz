-- 词库学习岛 v2 基线快照(2026-09-04 迁移规范化)。
-- 职责:从零建出当前全量结构 users + progress + user_settings(含 game_state 下线后的终态),
--       也作为旧库(由历史 schema.sql/date 迁移建成)的幂等对齐点。
-- 语义:全部 CREATE IF NOT EXISTS、无 DROP,重复执行安全;由 `wrangler d1 migrations apply` 记录到 d1_migrations。
-- 此后表结构变更一律新增数字前缀迁移文件(0002_xxx.sql ...),**不再改动本基线文件**。
-- 历史:更早的 date 前缀迁移(game_state 建/拆、生活记录)已下线,移入 migrations/archive/(不参与 apply)。

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '私密用户',
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 词库学习进度:每词一行,按 user_id 隔离
CREATE TABLE IF NOT EXISTS progress (
  user_id   TEXT NOT NULL,
  word_id   INTEGER NOT NULL,
  pinyin_completed  INTEGER NOT NULL DEFAULT 0,
  hanzi_completed   INTEGER NOT NULL DEFAULT 0,
  english_completed INTEGER NOT NULL DEFAULT 0,
  stars_earned      INTEGER NOT NULL DEFAULT 0,
  updated_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, word_id)
);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);

-- 家长可配置的模块开关(单档案一行)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id        TEXT PRIMARY KEY,
  enable_pinyin  INTEGER NOT NULL DEFAULT 1,
  enable_hanzi   INTEGER NOT NULL DEFAULT 1,
  enable_english INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
