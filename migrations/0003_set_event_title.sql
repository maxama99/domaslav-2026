-- Přejmenování akce (přepíše i výchozí "Hospodská olympiáda" v existující DB).
UPDATE settings SET value = 'Domaslavská olympiáda 2026' WHERE key = 'event_title';
