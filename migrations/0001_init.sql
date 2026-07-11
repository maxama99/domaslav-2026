-- Hospodská olympiáda - schéma D1 (SQLite)

CREATE TABLE IF NOT EXISTS teams (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  tiebreak_guess REAL,                 -- číselný odhad pro rozstřelovou otázku
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Disciplíny hospodského pětiboje (5 kusů, názvy lze měnit v adminu).
CREATE TABLE IF NOT EXISTS disciplines (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL
);

-- Body týmu za disciplínu pětiboje: 3/2/1/0 podle umístění.
CREATE TABLE IF NOT EXISTS team_discipline (
  team_id       INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  discipline_id INTEGER NOT NULL REFERENCES disciplines(id) ON DELETE CASCADE,
  points        INTEGER NOT NULL DEFAULT 0 CHECK (points BETWEEN 0 AND 3),
  PRIMARY KEY (team_id, discipline_id)
);

-- Souhrnné skóre za mise a kvíz.
CREATE TABLE IF NOT EXISTS team_scores (
  team_id      INTEGER PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  missions_done INTEGER NOT NULL DEFAULT 0 CHECK (missions_done BETWEEN 0 AND 3),
  quiz_points   INTEGER NOT NULL DEFAULT 0 CHECK (quiz_points BETWEEN 0 AND 15)
);

-- Globální nastavení (klíč/hodnota).
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Výchozí data
INSERT OR IGNORE INTO disciplines (id, name) VALUES
  (1, 'Disciplína 1'),
  (2, 'Disciplína 2'),
  (3, 'Disciplína 3'),
  (4, 'Disciplína 4'),
  (5, 'Disciplína 5');

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('event_title', 'Domaslavská olympiáda 2026'),
  ('tiebreak_correct', '');
