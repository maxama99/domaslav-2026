-- Ruční úprava bodů týmu (může být i záporná).
-- Částečně splněná mise se ukládá jako team_missions.status = 'partial' (bez změny schématu).
ALTER TABLE teams ADD COLUMN adjustment REAL NOT NULL DEFAULT 0;
