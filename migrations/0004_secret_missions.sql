-- Self-service tajné mise: tajné slovo týmu + balíček misí + nalosované karty.

ALTER TABLE teams ADD COLUMN secret_word TEXT;

CREATE TABLE IF NOT EXISTS missions (
  id         INTEGER PRIMARY KEY,
  number     INTEGER NOT NULL,
  title      TEXT NOT NULL,
  intro      TEXT NOT NULL,
  conditions TEXT NOT NULL,          -- JSON pole řetězců
  warning    TEXT,                   -- volitelné varování
  points     INTEGER NOT NULL DEFAULT 5
);

CREATE TABLE IF NOT EXISTS team_missions (
  team_id      INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  mission_id   INTEGER NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'active',   -- active | completed
  drawn_at     TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  PRIMARY KEY (team_id, mission_id)
);

-- Seed 10 misí (zrcadlí Typst kartičky).
INSERT OR IGNORE INTO missions (id, number, title, intro, conditions, warning) VALUES
  (1, 1, 'Slepičí poselství',
   'Přilepte někomu z jiného týmu na záda papírek s nápisem: „Zeptejte se mě, kolik mám doma slepic.“',
   '["Papírek zůstane na zádech alespoň 60 minut.","Podle instrukce se zachovají alespoň dva lidé.","Nositel si papírku během stanovené doby nevšimne."]',
   'Papírek připevněte tak, aby nepoškodil oblečení.'),

  (2, 2, 'Brčko jako životní styl',
   'Zařiďte, aby si někdo z jiného týmu dobrovolně dal brčko do svého piva a dopil přes něj celý zbývající obsah.',
   '["Brčko během pití neodloží.","Dopije přes brčko celé své zbývající pivo.","Před dokončením neví, že jde o tajnou misi."]',
   'Lze použít také nealkoholické pivo. Do pití nikdy nic nepřidávejte bez vědomí jeho majitele.'),

  (3, 3, 'Taneční mistr',
   'Přimějte někoho z jiného týmu, aby před publikem předvedl svou nejlepší taneční figuru.',
   '["Figuru předvede před alespoň čtyřmi lidmi.","Alespoň jeden další člověk se ji následně pokusí napodobit.","Tanečník předem neví, že jde o tajnou misi."]',
   'Výzva nesmí být nebezpečná, ponižující ani vynucená.'),

  (4, 4, 'Nečekaný koncert',
   'Zařiďte, aby někdo spontánně začal zpívat známou píseň. Nesmíte ho přímo požádat, aby zpíval.',
   '["Zazpívá alespoň část refrénu.","Do konce refrénu se přidají alespoň dva další lidé.","Zpěvák předem neví, že jde o tajnou misi."]',
   NULL),

  (5, 5, 'Nový státní svátek',
   'Vymyslete smyšlený svátek a vyvolejte na jeho počest společný přípitek. Příklad: Den evropského tupláku – tuplákům zdar!',
   '["Alespoň pět lidí (mimo tým) současně pozvedne svůj nápoj.","Všichni nahlas zopakují vámi vymyšlené sváteční heslo.","Nikomu předem neřeknete, že jde o soutěžní úkol."]',
   'Přípitek může proběhnout s jakýmkoliv nápojem.'),

  (6, 6, 'Pokrývková fotografie',
   'Přimějte všechny právě přítomné účastníky, aby se společně vyfotili s něčím na hlavě.',
   '["Na fotografii jsou všichni právě přítomní účastníci (minimálně 75 % účastníků dne).","Každý má na hlavě nějakou pokrývku nebo předmět.","Alespoň polovina použitých pokrývek nejsou běžné čepice ani klobouky.","Počítají se například hrnce, tácky, utěrky, krabice nebo grilovací náčiní."]',
   NULL),

  (7, 7, 'Autorský pivní koktejl',
   'Zařiďte, aby si někdo z jiného týmu dobrovolně přilil panáka do vlastního piva.',
   '["Předem ví, co se v panáku nachází.","Vzniklému nápoji vymyslí originální název.","Představí jej alespoň třem dalším lidem jako svůj vlastní pivní koktejl."]',
   'Dotyčný se musí rozhodnout dobrovolně. Vhodná je také nealkoholická varianta.'),

  (8, 8, 'Neexistující disciplína',
   'Přesvědčte člověka z jiného týmu, že právě začíná nová soutěžní disciplína. Vysvětlete mu její smyšlená pravidla.',
   '["Absolvuje alespoň jeden celý pokus.","Po dokončení přivolá nebo nominuje dalšího soutěžícího.","Před pokusem neví, že jde o tajnou misi."]',
   'Disciplína nesmí být nebezpečná, ponižující ani založená na nadměrném pití alkoholu.'),

  (9, 9, 'Reklama na gril',
   'Přimějte dva lidi z jiných týmů, aby s vámi natočili improvizovaný reklamní spot na gril. Spot musí trvat alespoň 20 sekund.',
   '["Gril dostane originální název.","Reklama obsahuje vlastní slogan.","Předvedete alespoň jednu „převratnou funkci“ grilu.","Spot zakončíte společnou pózou všech účinkujících.","Ostatní účinkující před začátkem nevědí, že jde o tajnou misi."]',
   'Natáčejte pouze se souhlasem všech účinkujících.'),

  (10, 10, 'Petice za lepší svět',
   'Vytvořte petici za smyšlenou věc a získejte pro ni podpisy účastníků z ostatních týmů. Například za povinnou druhou večeři, zákaz kulatých tácků nebo přestávku na šipky během pracovní doby.',
   '["Petici podepíše alespoň šest lidí.","Podepsaní pocházejí alespoň ze dvou jiných týmů.","Každý kromě podpisu uvede krátký důvod podpory.","Podepisující předem nevědí, že jde o tajnou misi."]',
   'Petice musí být zjevně neškodná a nesmí obsahovat citlivé osobní údaje.');
