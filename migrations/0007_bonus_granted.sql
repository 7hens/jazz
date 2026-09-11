-- 整词 +20 是「每词一次」的支付事件,无法从完成状态反推 → 持久化支付位。
-- additive,不改 0001 基线;ch1(0.3.0)从未上线,无存量存档需回填。
ALTER TABLE progress ADD COLUMN bonus_granted INTEGER NOT NULL DEFAULT 0;
