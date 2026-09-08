-- 千字谷章节态:每 user × 活动章节一行(断点续玩 + 恢复进度)。
-- additive,不改 0001 基线;restore_state 为 JSON 字符串,后端不解析语义。
CREATE TABLE IF NOT EXISTS qianzigu_progress (
  user_id        TEXT PRIMARY KEY,
  chapter_id     INTEGER NOT NULL DEFAULT 1,
  resume_scene_id TEXT,
  restore_state  TEXT NOT NULL DEFAULT '[]',
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
