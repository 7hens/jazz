-- 拼音积木正式版:每 user 一行(每关星级 + 星尘累计)。
-- additive:仅新增表,不改 0001 基线;旧代码回滚无视本表。
-- stars 是 JSON 对象 { "<levelId>": 1|2|3 },未通关的关不出现 ——
-- 用对象而非定长串:以后加关卡不用动 worker 里的常量。
CREATE TABLE IF NOT EXISTS pinyin_progress (
  user_id     TEXT    PRIMARY KEY,
  stars       TEXT    NOT NULL DEFAULT '{}',
  total_stars INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
