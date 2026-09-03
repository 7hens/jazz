-- 魔法语言岛:移除已无用的生活记录表,新增单档案游戏进度
DROP TABLE IF EXISTS records;

CREATE TABLE IF NOT EXISTS game_state (
  user_id    TEXT PRIMARY KEY,
  state      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
