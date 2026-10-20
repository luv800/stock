-- Run ONLY on a database created with the old schema.sql (no rack column). Not needed for a fresh database.
ALTER TABLE stock ADD COLUMN rack TEXT;
ALTER TABLE inward_items ADD COLUMN rack TEXT;
CREATE TABLE IF NOT EXISTS counters(name TEXT PRIMARY KEY, val INTEGER NOT NULL);
