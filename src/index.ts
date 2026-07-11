import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  ADMIN_PASSWORD: string;
};

const app = new Hono<{ Bindings: Bindings }>();

const MISSION_POINTS = 5;

// ---- Pomocné funkce ---------------------------------------------------------

function clampInt(value: unknown, min: number, max: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
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
      `SELECT t.id, t.name, t.tiebreak_guess,
              COALESCE(s.missions_done, 0) AS missions_done,
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
      `SELECT t.id, t.name, t.tiebreak_guess,
              COALESCE(s.missions_done, 0) AS missions_done,
              COALESCE(s.quiz_points, 0)   AS quiz_points
       FROM teams t
       LEFT JOIN team_scores s ON s.team_id = t.id
       ORDER BY t.id`,
    )
    .all<{
      id: number;
      name: string;
      tiebreak_guess: number | null;
      missions_done: number;
      quiz_points: number;
    }>();

  const disc = await db
    .prepare('SELECT team_id, discipline_id, points FROM team_discipline')
    .all<{ team_id: number; discipline_id: number; points: number }>();

  const discByTeam: Record<number, Record<number, number>> = {};
  for (const row of disc.results ?? []) {
    (discByTeam[row.team_id] ??= {})[row.discipline_id] = row.points;
  }

  return c.json({
    settings: {
      event_title: settingsMap['event_title'] ?? 'Hospodská olympiáda',
      tiebreak_correct: settingsMap['tiebreak_correct'] ?? '',
    },
    disciplines: disciplines.results ?? [],
    teams: (teams.results ?? []).map((t) => ({
      ...t,
      discipline_points: discByTeam[t.id] ?? {},
    })),
  });
});

// Vytvoření týmu.
app.post('/api/admin/teams', async (c) => {
  const body = await c.req.json<{ name?: string }>().catch(() => ({}) as { name?: string });
  const name = (body.name ?? '').trim();
  if (!name) return c.json({ error: 'Chybí název týmu' }, 400);

  const res = await c.env.DB.prepare('INSERT INTO teams (name) VALUES (?)')
    .bind(name)
    .run();
  const teamId = res.meta.last_row_id;
  await c.env.DB.prepare(
    'INSERT OR IGNORE INTO team_scores (team_id) VALUES (?)',
  )
    .bind(teamId)
    .run();

  return c.json({ id: teamId, name });
});

// Smazání týmu.
app.delete('/api/admin/teams/:id', async (c) => {
  const id = Number(c.req.param('id'));
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

// Splněné mise: { missions_done }
app.put('/api/admin/teams/:id/missions', async (c) => {
  const teamId = Number(c.req.param('id'));
  const body = await c.req
    .json<{ missions_done?: number }>()
    .catch(() => ({}) as { missions_done?: number });
  const missions = clampInt(body.missions_done, 0, 3);

  await c.env.DB.prepare(
    `INSERT INTO team_scores (team_id, missions_done) VALUES (?, ?)
     ON CONFLICT(team_id) DO UPDATE SET missions_done = excluded.missions_done`,
  )
    .bind(teamId, missions)
    .run();

  return c.json({ ok: true, missions_done: missions });
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

export default app;
