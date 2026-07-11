import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  ADMIN_PASSWORD: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const MISSION_POINTS = 5;
const MAX_MISSIONS = 3;

// ---- Pomocné funkce ---------------------------------------------------------

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

// Vylosuje týmu `count` misí, které ještě nejsou v žádném týmu (sdílený unikátní
// balíček). Vrátí počet skutečně přidaných karet.
async function drawMissions(
  db: D1Database,
  teamId: number,
  count: number,
): Promise<number> {
  const available = await db
    .prepare(
      `SELECT id FROM missions
       WHERE id NOT IN (SELECT mission_id FROM team_missions)
       ORDER BY RANDOM() LIMIT ?`,
    )
    .bind(count)
    .all<{ id: number }>();

  const picked = available.results ?? [];
  for (const m of picked) {
    await db
      .prepare('INSERT INTO team_missions (team_id, mission_id) VALUES (?, ?)')
      .bind(teamId, m.id)
      .run();
  }
  return picked.length;
}

// ---- Veřejné API ------------------------------------------------------------

app.get('/api/leaderboard', async (c) => {
  const db = c.env.DB;

  const settings = await db.prepare('SELECT key, value FROM settings').all<{
    key: string;
    value: string;
  }>();
  const settingsMap = Object.fromEntries(
    (settings.results ?? []).map((r) => [r.key, r.value]),
  );
  const correctRaw = settingsMap['tiebreak_correct'];
  const correct = correctRaw !== '' && correctRaw != null ? Number(correctRaw) : null;

  const disciplines = await db
    .prepare('SELECT id, name FROM disciplines ORDER BY id')
    .all<{ id: number; name: string }>();

  const teams = await db
    .prepare(
      `SELECT t.id, t.name, t.members, t.tiebreak_guess,
              (SELECT COUNT(*) FROM team_missions tm
                 WHERE tm.team_id = t.id AND tm.status = 'completed') AS missions_done,
              COALESCE(s.quiz_points, 0)   AS quiz_points,
              COALESCE(SUM(td.points), 0)  AS pentathlon
       FROM teams t
       LEFT JOIN team_scores s ON s.team_id = t.id
       LEFT JOIN team_discipline td ON td.team_id = t.id
       GROUP BY t.id`,
    )
    .all<{
      id: number;
      name: string;
      members: string | null;
      tiebreak_guess: number | null;
      missions_done: number;
      quiz_points: number;
      pentathlon: number;
    }>();

  const rows = (teams.results ?? []).map((t) => {
    const missions = t.missions_done * MISSION_POINTS;
    const total = t.pentathlon + missions + t.quiz_points;
    const tiebreakDiff =
      correct != null && t.tiebreak_guess != null
        ? Math.abs(t.tiebreak_guess - correct)
        : null;
    return {
      id: t.id,
      name: t.name,
      members: (t.members ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      pentathlon: t.pentathlon,
      missions,
      missionsDone: t.missions_done,
      quiz: t.quiz_points,
      total,
      tiebreakGuess: t.tiebreak_guess,
      tiebreakDiff,
    };
  });

  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    // Rozstřel: menší odchylka od správné hodnoty vyhrává; bez odhadu jde dozadu.
    const da = a.tiebreakDiff ?? Number.POSITIVE_INFINITY;
    const db2 = b.tiebreakDiff ?? Number.POSITIVE_INFINITY;
    if (da !== db2) return da - db2;
    return a.name.localeCompare(b.name, 'cs');
  });

  return c.json({
    title: settingsMap['event_title'] ?? 'Hospodská olympiáda',
    disciplines: disciplines.results ?? [],
    teams: rows,
  });
});

// ---- Admin auth middleware --------------------------------------------------

app.use('/api/admin/*', async (c, next) => {
  const provided = c.req.header('x-admin-password') ?? '';
  const expected = c.env.ADMIN_PASSWORD ?? '';
  if (!expected || provided !== expected) {
    return c.json({ error: 'Neplatné heslo' }, 401);
  }
  await next();
});

app.post('/api/admin/login', (c) => c.json({ ok: true }));

// Plný stav pro editaci v adminu.
app.get('/api/admin/state', async (c) => {
  const db = c.env.DB;

  const settings = await db.prepare('SELECT key, value FROM settings').all<{
    key: string;
    value: string;
  }>();
  const settingsMap = Object.fromEntries(
    (settings.results ?? []).map((r) => [r.key, r.value]),
  );

  const disciplines = await db
    .prepare('SELECT id, name FROM disciplines ORDER BY id')
    .all<{ id: number; name: string }>();

  const teams = await db
    .prepare(
      `SELECT t.id, t.name, t.members, t.secret_word, t.tiebreak_guess,
              COALESCE(s.quiz_points, 0) AS quiz_points
       FROM teams t
       LEFT JOIN team_scores s ON s.team_id = t.id
       ORDER BY t.id`,
    )
    .all<{
      id: number;
      name: string;
      members: string | null;
      secret_word: string | null;
      tiebreak_guess: number | null;
      quiz_points: number;
    }>();

  const disc = await db
    .prepare('SELECT team_id, discipline_id, points FROM team_discipline')
    .all<{ team_id: number; discipline_id: number; points: number }>();

  const discByTeam: Record<number, Record<number, number>> = {};
  for (const row of disc.results ?? []) {
    (discByTeam[row.team_id] ??= {})[row.discipline_id] = row.points;
  }

  type AdminMissionRow = {
    team_id: number;
    mission_id: number;
    status: string;
    number: number;
    title: string;
  };
  const tm = await db
    .prepare(
      `SELECT tm.team_id, tm.mission_id, tm.status, m.number, m.title
       FROM team_missions tm JOIN missions m ON m.id = tm.mission_id
       ORDER BY m.number`,
    )
    .all<AdminMissionRow>();

  const missionsByTeam: Record<number, AdminMissionRow[]> = {};
  for (const row of tm.results ?? []) {
    (missionsByTeam[row.team_id] ??= []).push(row);
  }

  return c.json({
    settings: {
      event_title: settingsMap['event_title'] ?? 'Hospodská olympiáda',
      tiebreak_correct: settingsMap['tiebreak_correct'] ?? '',
    },
    disciplines: disciplines.results ?? [],
    teams: (teams.results ?? []).map((t) => {
      const missions = missionsByTeam[t.id] ?? [];
      return {
        ...t,
        discipline_points: discByTeam[t.id] ?? {},
        missions,
        missions_done: missions.filter((m) => m.status === 'completed').length,
      };
    }),
  });
});

// Vytvoření týmu (+ tajné slovo, automaticky vylosuje 2 mise).
app.post('/api/admin/teams', async (c) => {
  const body = await c.req
    .json<{ name?: string; secret_word?: string }>()
    .catch(() => ({}) as { name?: string; secret_word?: string });
  const name = (body.name ?? '').trim();
  const secret = (body.secret_word ?? '').trim();
  if (!name) return c.json({ error: 'Chybí název týmu' }, 400);
  if (!secret) return c.json({ error: 'Chybí tajné slovo' }, 400);

  const dup = await c.env.DB.prepare(
    'SELECT id FROM teams WHERE lower(secret_word) = lower(?)',
  )
    .bind(secret)
    .first<{ id: number }>();
  if (dup) return c.json({ error: 'Tajné slovo už používá jiný tým' }, 400);

  const res = await c.env.DB.prepare(
    'INSERT INTO teams (name, secret_word) VALUES (?, ?)',
  )
    .bind(name, secret)
    .run();
  const teamId = Number(res.meta.last_row_id);
  await c.env.DB.prepare('INSERT OR IGNORE INTO team_scores (team_id) VALUES (?)')
    .bind(teamId)
    .run();

  await drawMissions(c.env.DB, teamId, 2);

  return c.json({ id: teamId, name });
});

// Smazání týmu (uvolní jeho karty zpět do balíčku).
app.delete('/api/admin/teams/:id', async (c) => {
  const id = Number(c.req.param('id'));
  await c.env.DB.prepare('DELETE FROM team_missions WHERE team_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM team_discipline WHERE team_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM team_scores WHERE team_id = ?').bind(id).run();
  await c.env.DB.prepare('DELETE FROM teams WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

// Body pětiboje: { discipline_id, points }
app.put('/api/admin/teams/:id/pentathlon', async (c) => {
  const teamId = Number(c.req.param('id'));
  const body = await c.req
    .json<{ discipline_id?: number; points?: number }>()
    .catch(() => ({}) as { discipline_id?: number; points?: number });
  const disciplineId = Number(body.discipline_id);
  if (!Number.isFinite(disciplineId)) {
    return c.json({ error: 'Chybí disciplína' }, 400);
  }
  const points = clampInt(body.points, 0, 3);

  await c.env.DB.prepare(
    `INSERT INTO team_discipline (team_id, discipline_id, points)
     VALUES (?, ?, ?)
     ON CONFLICT(team_id, discipline_id) DO UPDATE SET points = excluded.points`,
  )
    .bind(teamId, disciplineId, points)
    .run();

  return c.json({ ok: true, points });
});

// Účastníci týmu: { members }
app.put('/api/admin/teams/:id/members', async (c) => {
  const teamId = Number(c.req.param('id'));
  const body = await c.req
    .json<{ members?: string }>()
    .catch(() => ({}) as { members?: string });
  const members = (body.members ?? '').trim();

  await c.env.DB.prepare('UPDATE teams SET members = ? WHERE id = ?')
    .bind(members || null, teamId)
    .run();

  return c.json({ ok: true });
});

// Potvrzení / vrácení splnění mise: { status: 'completed' | 'active' }
app.put('/api/admin/teams/:id/missions/:missionId', async (c) => {
  const teamId = Number(c.req.param('id'));
  const missionId = Number(c.req.param('missionId'));
  const body = await c.req
    .json<{ status?: string }>()
    .catch(() => ({}) as { status?: string });
  const status = body.status === 'completed' ? 'completed' : 'active';
  const completedAt = status === 'completed' ? "datetime('now')" : 'NULL';

  await c.env.DB.prepare(
    `UPDATE team_missions SET status = ?, completed_at = ${completedAt}
     WHERE team_id = ? AND mission_id = ?`,
  )
    .bind(status, teamId, missionId)
    .run();

  return c.json({ ok: true, status });
});

// Kvíz + rozstřel: { quiz_points, tiebreak_guess }
app.put('/api/admin/teams/:id/quiz', async (c) => {
  const teamId = Number(c.req.param('id'));
  const body = await c.req
    .json<{ quiz_points?: number; tiebreak_guess?: number | string | null }>()
    .catch(() => ({}) as { quiz_points?: number; tiebreak_guess?: number | string | null });
  const quiz = clampInt(body.quiz_points, 0, 15);

  let guess: number | null = null;
  if (body.tiebreak_guess !== null && body.tiebreak_guess !== undefined && body.tiebreak_guess !== '') {
    const g = Number(body.tiebreak_guess);
    guess = Number.isFinite(g) ? g : null;
  }

  await c.env.DB.prepare(
    `INSERT INTO team_scores (team_id, quiz_points) VALUES (?, ?)
     ON CONFLICT(team_id) DO UPDATE SET quiz_points = excluded.quiz_points`,
  )
    .bind(teamId, quiz)
    .run();

  await c.env.DB.prepare('UPDATE teams SET tiebreak_guess = ? WHERE id = ?')
    .bind(guess, teamId)
    .run();

  return c.json({ ok: true, quiz_points: quiz, tiebreak_guess: guess });
});

// Nastavení: { event_title, tiebreak_correct, disciplines: [{id, name}] }
app.put('/api/admin/settings', async (c) => {
  type SettingsBody = {
    event_title?: string;
    tiebreak_correct?: string | number;
    disciplines?: { id: number; name: string }[];
  };
  const body = await c.req.json<SettingsBody>().catch(() => ({}) as SettingsBody);

  if (typeof body.event_title === 'string') {
    await c.env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('event_title', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
      .bind(body.event_title.trim() || 'Hospodská olympiáda')
      .run();
  }

  if (body.tiebreak_correct !== undefined) {
    const val = body.tiebreak_correct === '' ? '' : String(body.tiebreak_correct);
    await c.env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES ('tiebreak_correct', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
      .bind(val)
      .run();
  }

  if (Array.isArray(body.disciplines)) {
    for (const d of body.disciplines) {
      const name = (d.name ?? '').trim();
      if (name) {
        await c.env.DB.prepare('UPDATE disciplines SET name = ? WHERE id = ?')
          .bind(name, d.id)
          .run();
      }
    }
  }

  return c.json({ ok: true });
});

// ---- Týmové API (self-service tajné mise) -----------------------------------

type MissionRow = {
  mission_id: number;
  number: number;
  title: string;
  intro: string;
  conditions: string;
  warning: string | null;
  points: number;
  status: string;
};

async function findTeamBySecret(db: D1Database, secret: string) {
  if (!secret.trim()) return null;
  return db
    .prepare('SELECT id, name FROM teams WHERE lower(secret_word) = lower(?)')
    .bind(secret.trim())
    .first<{ id: number; name: string }>();
}

async function teamState(db: D1Database, teamId: number, name: string) {
  const rows = await db
    .prepare(
      `SELECT tm.mission_id, tm.status, m.number, m.title, m.intro,
              m.conditions, m.warning, m.points
       FROM team_missions tm JOIN missions m ON m.id = tm.mission_id
       WHERE tm.team_id = ? ORDER BY tm.drawn_at`,
    )
    .bind(teamId)
    .all<MissionRow>();

  const missions = (rows.results ?? []).map((m) => ({
    id: m.mission_id,
    number: m.number,
    title: m.title,
    intro: m.intro,
    conditions: JSON.parse(m.conditions) as string[],
    warning: m.warning,
    points: m.points,
    status: m.status,
  }));

  const completed = missions.filter((m) => m.status === 'completed').length;
  const drawn = missions.length;
  const deck = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM missions
       WHERE id NOT IN (SELECT mission_id FROM team_missions)`,
    )
    .first<{ n: number }>();
  const deckLeft = deck?.n ?? 0;

  return {
    name,
    missions,
    drawn,
    completed,
    deckLeft,
    canDraw: completed >= 1 && drawn < MAX_MISSIONS && deckLeft > 0,
  };
}

app.post('/api/team/login', async (c) => {
  const body = await c.req
    .json<{ secret_word?: string }>()
    .catch(() => ({}) as { secret_word?: string });
  const team = await findTeamBySecret(c.env.DB, body.secret_word ?? '');
  if (!team) return c.json({ error: 'Neplatné tajné slovo' }, 401);
  return c.json({ ok: true, name: team.name });
});

// Auth middleware pro /api/team/* (kromě loginu).
app.use('/api/team/*', async (c, next) => {
  if (c.req.path === '/api/team/login') return next();
  const team = await findTeamBySecret(c.env.DB, c.req.header('x-team-secret') ?? '');
  if (!team) return c.json({ error: 'Neplatné tajné slovo' }, 401);
  c.set('teamId' as never, team.id as never);
  c.set('teamName' as never, team.name as never);
  await next();
});

app.get('/api/team/state', async (c) => {
  const teamId = c.get('teamId' as never) as number;
  const name = c.get('teamName' as never) as string;
  return c.json(await teamState(c.env.DB, teamId, name));
});

app.post('/api/team/draw', async (c) => {
  const teamId = c.get('teamId' as never) as number;
  const name = c.get('teamName' as never) as string;
  const state = await teamState(c.env.DB, teamId, name);
  if (!state.canDraw) {
    const reason =
      state.completed < 1
        ? 'Nejdřív musíš mít potvrzenou aspoň jednu splněnou misi.'
        : state.drawn >= MAX_MISSIONS
          ? 'Už máš maximální počet karet.'
          : 'V balíčku už nezbývá žádná volná mise.';
    return c.json({ error: reason }, 409);
  }
  await drawMissions(c.env.DB, teamId, 1);
  return c.json(await teamState(c.env.DB, teamId, name));
});

export default app;
