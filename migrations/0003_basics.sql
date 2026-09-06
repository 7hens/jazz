-- 基础引导:每 user × 每基础单元一行(声母/韵母/声调/英文字母熟度)。
-- additive:仅新增表,不改动 0001 基线与现有表,旧代码回滚无视本表。
CREATE TABLE IF NOT EXISTS basics_progress (
  user_id        INTEGER NOT NULL,
  unit_key       TEXT    NOT NULL,
  state          TEXT    NOT NULL,
  correct_streak INTEGER NOT NULL DEFAULT 0,
  taught_count   INTEGER NOT NULL DEFAULT 0,
  updated_at     TEXT    NOT NULL,
  PRIMARY KEY (user_id, unit_key)
);
