-- v1 关卡制(game_state 整档)下线 → 词库行级 progress + user_settings。
-- 幂等:重复执行安全(DROP IF EXISTS + CREATE IF NOT EXISTS)。
DROP TABLE IF EXISTS game_state;
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
CREATE TABLE IF NOT EXISTS user_settings (
  user_id        TEXT PRIMARY KEY,
  enable_pinyin  INTEGER NOT NULL DEFAULT 1,
  enable_hanzi   INTEGER NOT NULL DEFAULT 1,
  enable_english INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
