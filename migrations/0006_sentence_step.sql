-- 汉语句型步:每词多句、由易到难;加列记录已通过档数(0..3)。
-- additive,不改 0001 基线;ch1(0.3.0)从未上线,无存量存档需回填。
ALTER TABLE progress ADD COLUMN sentence_level INTEGER NOT NULL DEFAULT 0;
