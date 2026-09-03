-- 趣味性系统:user_settings 扩展列(纯增量,不改 0001 基线)
ALTER TABLE user_settings ADD COLUMN earned_achievements TEXT    NOT NULL DEFAULT '[]';
ALTER TABLE user_settings ADD COLUMN consecutive_days    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN last_active_date     TEXT    NOT NULL DEFAULT '';
