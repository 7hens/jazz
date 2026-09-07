-- 汉语领域并轨:settings 启用粒度 3 技能 → 2 领域(汉语=拼音+汉字 / 英语)。
-- additive:仅加列,不改 0001 基线;旧 enable_pinyin/enable_hanzi 保留不删、新代码停用。
ALTER TABLE user_settings ADD COLUMN enable_chinese INTEGER NOT NULL DEFAULT 1;
-- 旧行连续性:任一侧旧开过汉语技能 → 域开;纯英语/零汉语旧配置不静默塞回汉语。
UPDATE user_settings SET enable_chinese = (enable_pinyin | enable_hanzi);
