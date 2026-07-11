-- Aktualizace znění misí 1-10 a přidání nových misí 11-13.

UPDATE missions SET
  intro = 'Přilepte někomu z jiného týmu na záda papírek s nápisem: „Zeptejte se mě, kolik mám doma slepic.“',
  conditions = '["Papírek zůstane na zádech alespoň 20 minut.","Podle instrukce se zachovají alespoň jeden člověk.","Nositel si papírku během stanovené doby nevšimne."]',
  warning = 'Papírek připevněte tak, aby nepoškodil oblečení.'
WHERE id = 1;

UPDATE missions SET
  intro = 'Zařiďte, aby si někdo z jiného týmu dobrovolně dal brčko do svého piva a dopil přes něj alespoň 0,2 litru nebo celý zbývající obsah, pokud je ho méně.',
  conditions = '["Brčko během pití neodloží.","Přes brčko vypije celý zbývající obsah nápoje.","Před dokončením neví, že jde o tajnou misi."]',
  warning = 'Lze použít také nealkoholické pivo. Do pití nikdy nic nepřidávejte bez vědomí jeho majitele.'
WHERE id = 2;

UPDATE missions SET
  intro = 'Přimějte někoho z jiného týmu, aby před publikem předvedl svou nejlepší taneční figuru.',
  conditions = '["Figuru předvede před alespoň třemi lidmi.","Alespoň jeden další člověk se ji následně pokusí napodobit.","Tanečník předem neví, že jde o tajnou misi."]',
  warning = 'Výzva nesmí být nebezpečná, ponižující ani vynucená.'
WHERE id = 3;

UPDATE missions SET
  intro = 'Zařiďte, aby někdo začal zpívat známou píseň, aniž byste ho přímo požádali, aby zazpíval. Můžete použít narážku, pustit část písně nebo sami začít recitovat její text.',
  conditions = '["Zpěvák zazpívá většinu písničky.","Přidá se k němu alespoň jeden další člověk.","Zpěvák předem neví, že jde o tajnou misi."]',
  warning = NULL
WHERE id = 4;

UPDATE missions SET
  intro = 'Vymyslete smyšlený svátek a vyvolejte na jeho počest společný přípitek. Příklad: Den evropského tupláku – tuplákům zdar!',
  conditions = '["Alespoň čtyři lidé mimo váš tým současně pozvednou svůj nápoj.","Účastníci nahlas zopakují vámi vymyšlené sváteční heslo.","Nikomu předem neřeknete, že jde o soutěžní úkol."]',
  warning = 'Přípitek může proběhnout s jakýmkoliv nápojem.'
WHERE id = 5;

UPDATE missions SET
  intro = 'Přimějte většinu účastníků, aby se společně vyfotili s nějakým předmětem nebo pokrývkou na hlavě.',
  conditions = '["Na fotografii je alespoň 75 % všech účastníků akce.","Každý fotografovaný má na hlavě nějakou pokrývku nebo předmět.","Alespoň polovina použitých pokrývek nejsou běžné čepice ani klobouky.","Fotografie vznikne pod jinou záminkou než splnění tajné mise."]',
  warning = 'Používejte pouze bezpečné a čisté předměty, například tácky, utěrky, krabice nebo lehké kuchyňské náčiní.'
WHERE id = 6;

UPDATE missions SET
  intro = 'Zařiďte, aby si někdo z jiného týmu dobrovolně přilil panáka alkoholického nápoje do vlastního piva.',
  conditions = '["Předem ví, co se v panáku nachází.","Vzniklému nápoji vymyslí originální název."]',
  warning = 'Dotyčný se musí rozhodnout dobrovolně. Lze použít také nealkoholické pivo a nealkoholickou přísadu.'
WHERE id = 7;

UPDATE missions SET
  intro = 'Přesvědčte člověka z jiného týmu, že právě začíná nová soutěžní disciplína, a vysvětlete mu její smyšlená pravidla.',
  conditions = '["Absolvuje alespoň jeden celý pokus.","Před svým pokusem neví, že jde o tajnou misi."]',
  warning = 'Disciplína nesmí být nebezpečná, ponižující ani založená na nadměrném pití alkoholu.'
WHERE id = 8;

UPDATE missions SET
  intro = 'Přimějte alespoň jednoho člověka z jiného týmu, aby s vámi natočil improvizovaný reklamní spot na gril. Spot musí trvat alespoň 15 sekund.',
  conditions = '["Gril dostane originální název.","Reklama obsahuje vlastní slogan.","Předvedete alespoň jednu smyšlenou „převratnou funkci“ grilu.","Účinkující před začátkem nevědí, že jde o tajnou misi."]',
  warning = 'Účinkující mohou vědět, že natáčíte reklamní spot, ale nesmí znát jeho soutěžní účel. Natáčejte pouze se souhlasem všech účinkujících.'
WHERE id = 9;

UPDATE missions SET
  intro = 'Vytvořte petici za smyšlenou věc a získejte pro ni podpisy účastníků z ostatních týmů. Například za povinnou druhou večeři, zákaz kulatých tácků nebo přestávku na šipky během pracovní doby.',
  conditions = '["Petici podepíší alespoň čtyři lidé.","Podepsaní pocházejí alespoň ze dvou jiných týmů.","Každý kromě podpisu uvede krátký důvod podpory.","Podepisující předem nevědí, že jde o tajnou misi."]',
  warning = 'Petice musí být zjevně neškodná a nesmí obsahovat citlivé osobní údaje.'
WHERE id = 10;

INSERT OR IGNORE INTO missions (id, number, title, intro, conditions, warning) VALUES
  (11, 11, 'Nová tradice',
   'Vymyslete krátký rituál, který se údajně na této akci provádí před určitou běžnou činností, například před hodem šipkou, otevřením piva nebo položením jídla na gril.',
   '["Rituál provedou alespoň tři lidé mimo váš tým.","Stejný rituál se během akce uskuteční alespoň dvakrát.","Při druhém provedení jej alespoň jeden člověk začne dělat bez přímého připomenutí.","Účastníci předem nevědí, že jde o tajnou misi."]',
   'Rituál musí být krátký, bezpečný a nesmí zdržovat ostatní soutěže.'),

  (12, 12, 'Řetězový přípitek',
   'Zařiďte, aby jeden člověk z jiného týmu zahájil přípitek, po kterém všichni účastníci postupně dopijí své nápoje.',
   '["Přípitek zahájí člověk mimo váš tým.","Zapojí se alespoň pět dalších lidí.","Každý účastník se napije až poté, co se napije člověk před ním.","Iniciátor předem neví, že jde o tajnou misi."]',
   'Počítá se jakýkoliv alkoholický i nealkoholický nápoj.'),

  (13, 13, 'Bratrství u výčepu',
   'Přimějte dva lidi z jiného než vašeho týmu, aby si dobrovolně připili a vypili svůj nápoj se vzájemně propletenými pažemi.',
   '["Oba účastníci jsou z jiného týmu.","Během pití zůstanou jejich paže propletené.","Předem nevědí, že jde o tajnou misi."]',
   'Použijte bezpečné nádoby a libovolné nápoje.');
