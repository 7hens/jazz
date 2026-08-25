-- Atomicity: `wrangler d1 execute --file` wraps the whole file in one implicit transaction,
-- and rejects explicit BEGIN/COMMIT (SQLITE_ERROR: "use the state.storage.transaction() APIs").
DELETE FROM records WHERE type = 'exercise';
DROP TABLE IF EXISTS records_new;
CREATE TABLE records_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('expense', 'income', 'weight')),
  date TEXT NOT NULL,
  note TEXT,
  amount REAL,
  category TEXT,
  weight REAL,
  exercise_type TEXT,
  duration INTEGER,
  calories INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

INSERT INTO records_new (id, user_id, type, date, note, amount, category, weight, exercise_type, duration, calories, created_at)
  SELECT id, user_id, type, date, note, amount, category, weight, exercise_type, duration, calories, created_at FROM records;

DROP TABLE records;
ALTER TABLE records_new RENAME TO records;
