let PASSWORD = localStorage.getItem('adminPassword') || '';
let STATE = null;

const $ = (id) => document.getElementById(id);

// Možnosti segmentových tlačítek. `value` = uložená hodnota, `label` = popisek.
const PENT_OPTS = [
  { value: 0, label: '–' },
  { value: 1, label: '1 b' },
  { value: 2, label: '2 b' },
  { value: 3, label: '3 b' },
];
// Kvíz: value = body dle umístění.
const QUIZ_OPTS = [
  { value: 0, label: '-' },
  { value: 15, label: '1. (15 b)' },
  { value: 10, label: '2. (10 b)' },
  { value: 5, label: '3. (5 b)' },
];

function segGroup(kind, teamId, current, options, extra = '') {
  const buttons = options
    .map(
      (o) =>
        `<button type="button" class="seg-btn${o.value === current ? ' active' : ''}" data-value="${o.value}">${o.label}</button>`,
    )
    .join('');
  return `<div class="seg" data-kind="${kind}" data-team="${teamId}" ${extra}>${buttons}</div>`;
}

// Stavový přepínač mise: nesplněno / částečně (½) / splněno.
function statusGroup(teamId, missionId, status) {
  const opts = [
    { v: 'active', label: '–' },
    { v: 'partial', label: '½ · 2,5 b' },
    { v: 'completed', label: '✓ · 5 b' },
  ];
  const buttons = opts
    .map(
      (o) =>
        `<button type="button" class="seg-btn${o.v === status ? ' active' : ''}" data-status="${o.v}">${o.label}</button>`,
    )
    .join('');
  return `<div class="seg" data-kind="mstatus" data-team="${teamId}" data-mission="${missionId}">${buttons}</div>`;
}

// Formátování bodů (celé číslo bez desetin, jinak s čárkou: 2,5).
function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

async function api(path, method = 'GET', body) {
  const res = await fetch(path, {
    method,
    headers: {
      'x-admin-password': PASSWORD,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    logout();
    throw new Error('unauthorized');
  }
  if (!res.ok) throw new Error('request failed');
  return res.json();
}

function logout() {
  PASSWORD = '';
  localStorage.removeItem('adminPassword');
  $('panel').classList.add('hidden');
  $('login-card').classList.remove('hidden');
  $('login-error').classList.remove('hidden');
}

async function tryLogin(pw) {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'x-admin-password': pw },
  });
  if (!res.ok) return false;
  PASSWORD = pw;
  localStorage.setItem('adminPassword', pw);
  return true;
}

$('login-btn').addEventListener('click', async () => {
  const pw = $('password').value;
  if (await tryLogin(pw)) {
    $('login-error').classList.add('hidden');
    showPanel();
  } else {
    $('login-error').classList.remove('hidden');
  }
});
$('password').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('login-btn').click();
});

async function showPanel() {
  $('login-card').classList.add('hidden');
  $('panel').classList.remove('hidden');
  await refresh();
}

async function refresh() {
  STATE = await api('/api/admin/state');
  $('event_title').value = STATE.settings.event_title;
  $('tiebreak_correct').value = STATE.settings.tiebreak_correct;
  renderDisciplineNames();
  renderStandings();
  renderPentathlon();
  renderQuiz();
  renderMissionsScoring();
  renderAdjustments();
  renderTeamsManage();
  renderCatalog();
}

function teamTotals(t) {
  const pent = STATE.disciplines.reduce(
    (s, d) => s + (t.discipline_points[d.id] || 0),
    0,
  );
  const missions = t.mission_points || 0;
  const adjustment = t.adjustment || 0;
  return {
    pent,
    missions,
    quiz: t.quiz_points,
    adjustment,
    total: pent + missions + t.quiz_points + adjustment,
  };
}

const noTeams = '<p class="hint" style="text-align:left">Nejdřív přidej týmy v záložce Týmy.</p>';

function renderCatalog() {
  const missions = STATE.allMissions || [];
  $('catalog-count').textContent = `${missions.length}`;
  $('catalog').innerHTML = missions
    .map((m) => {
      const assigned = m.teamName
        ? `<span class="cat-assign ${m.status === 'completed' ? 'ok' : 'active'}">${escapeHtml(m.teamName)} · ${m.status === 'completed' ? 'splněno' : 'aktivní'}</span>`
        : '<span class="cat-assign free">volná v balíčku</span>';
      const conds = m.conditions
        .map((c) => `<li>${escapeHtml(c)}</li>`)
        .join('');
      const warn = m.warning
        ? `<div class="mcard-warn"><span class="warn-ico">!</span><span><strong>Pozor:</strong> ${escapeHtml(m.warning)}</span></div>`
        : '';
      return `<div class="cat-item">
        <div class="cat-head">
          <span><span class="m-num">#${m.number}</span><strong>${escapeHtml(m.title)}</strong></span>
          ${assigned}
        </div>
        <p class="cat-intro">${escapeHtml(m.intro)}</p>
        <ul class="cat-conds">${conds}</ul>
        ${warn}
      </div>`;
    })
    .join('');
}

function renderDisciplineNames() {
  $('disciplines-grid').innerHTML = STATE.disciplines
    .map(
      (d) => `<div class="field-inline">
        <label>#${d.id}</label>
        <input type="text" data-disc="${d.id}" value="${escapeHtml(d.name)}" />
      </div>`,
    )
    .join('');
}

// --- Záložka Body: průběžné pořadí ---
function renderStandings() {
  if (!STATE.teams.length) {
    $('standings').innerHTML = noTeams;
    return;
  }
  const rows = STATE.teams
    .map((t) => ({ t, ...teamTotals(t) }))
    .sort((a, b) => b.total - a.total);
  $('standings').innerHTML = `<table class="mini-table">
    <thead><tr><th>#</th><th>Tým</th><th title="Pětiboj">🍺</th>
      <th title="Mise">🕵️</th><th title="Kvíz">🧠</th>
      <th title="Ruční úprava">±</th><th>Σ</th></tr></thead>
    <tbody>${rows
      .map(
        (r, i) => `<tr>
          <td>${i + 1}</td>
          <td class="mt-team">${escapeHtml(r.t.name)}</td>
          <td>${fmt(r.pent)}</td><td>${fmt(r.missions)}</td><td>${fmt(r.quiz)}</td>
          <td class="mt-adj">${r.adjustment ? (r.adjustment > 0 ? '+' : '') + fmt(r.adjustment) : ''}</td>
          <td class="mt-total">${fmt(r.total)}</td>
        </tr>`,
      )
      .join('')}</tbody></table>`;
}

// --- Záložka Body: pětiboj (po disciplínách, všechny týmy) ---
function renderPentathlon() {
  if (!STATE.teams.length) {
    $('pentathlon').innerHTML = noTeams;
    return;
  }
  $('pentathlon').innerHTML = STATE.disciplines
    .map(
      (d) => `<div class="disc-score">
        <div class="disc-score-title">${escapeHtml(d.name)}</div>
        ${STATE.teams
          .map(
            (t) => `<div class="score-row">
              <span class="score-team-name">${escapeHtml(t.name)}</span>
              ${segGroup('pent', t.id, t.discipline_points[d.id] || 0, PENT_OPTS, `data-disc="${d.id}"`)}
            </div>`,
          )
          .join('')}
      </div>`,
    )
    .join('');
}

// --- Záložka Body: pub kvíz ---
function renderQuiz() {
  if (!STATE.teams.length) {
    $('quiz').innerHTML = noTeams;
    return;
  }
  $('quiz').innerHTML = STATE.teams
    .map(
      (t) => `<div class="score-row quiz-row">
        <span class="score-team-name">${escapeHtml(t.name)}</span>
        ${segGroup('quiz', t.id, t.quiz_points, QUIZ_OPTS)}
        <input type="number" step="any" data-team="${t.id}" data-tiebreak
               value="${t.tiebreak_guess ?? ''}" placeholder="rozstřel" class="tiebreak-input" />
      </div>`,
    )
    .join('');
}

// --- Záložka Body: tajné mise (potvrzování) ---
function renderMissionsScoring() {
  if (!STATE.teams.length) {
    $('missions-scoring').innerHTML = noTeams;
    return;
  }
  $('missions-scoring').innerHTML = STATE.teams
    .map((t) => {
      const list = (t.missions || []).length
        ? (t.missions || [])
            .map(
              (m) => `<div class="admin-mission-row">
                <span class="m-label"><span class="m-num">#${m.number}</span>${escapeHtml(m.title)}</span>
                ${statusGroup(t.id, m.mission_id, m.status)}
              </div>`,
            )
            .join('')
        : '<p class="hint" style="text-align:left">Žádné nalosované mise.</p>';
      return `<div class="score-team-block">
        <div class="score-team-head"><strong>${escapeHtml(t.name)}</strong>
          <span class="subscore">${fmt(t.mission_points || 0)} / 15 b</span></div>
        <div class="admin-missions">${list}</div>
      </div>`;
    })
    .join('');
}

// --- Záložka Body: ruční úprava bodů ---
function renderAdjustments() {
  if (!STATE.teams.length) {
    $('adjustments').innerHTML = noTeams;
    return;
  }
  $('adjustments').innerHTML = STATE.teams
    .map(
      (t) => `<div class="score-row adj-row">
        <span class="score-team-name">${escapeHtml(t.name)}</span>
        <div class="adj-controls">
          <button class="adj-btn" data-adj-team="${t.id}" data-adj-step="-1">−1</button>
          <button class="adj-btn" data-adj-team="${t.id}" data-adj-step="-0.5">−½</button>
          <input type="number" step="0.5" class="adj-input" data-adj-team="${t.id}"
                 data-adjustment value="${t.adjustment || 0}" />
          <button class="adj-btn" data-adj-team="${t.id}" data-adj-step="0.5">+½</button>
          <button class="adj-btn" data-adj-team="${t.id}" data-adj-step="1">+1</button>
        </div>
      </div>`,
    )
    .join('');
}

// --- Záložka Týmy: správa ---
function renderTeamsManage() {
  if (!STATE.teams.length) {
    $('teams-manage').innerHTML = '<p class="hint" style="text-align:left">Zatím žádné týmy.</p>';
    return;
  }
  $('teams-manage').innerHTML = STATE.teams
    .map(
      (t) => `<div class="team-manage">
        <div class="team-head">
          <strong>${escapeHtml(t.name)}</strong>
          <button class="danger" data-del="${t.id}">Smazat</button>
        </div>
        <p class="secret-tag">Tajné slovo: <code>${escapeHtml(t.secret_word || '—')}</code></p>
        <div class="seg-field" style="margin-top:0.4rem">
          <label>👥 Účastníci (oddělené čárkou)</label>
          <input type="text" data-team="${t.id}" data-members
                 value="${escapeHtml(t.members || '')}" placeholder="Anna, Petr, Katka" />
        </div>
      </div>`,
    )
    .join('');
}

// --- Delegované ovládání (funguje napříč záložkami i po překreslení) ---
document.addEventListener('click', async (e) => {
  const seg = e.target.closest('.seg-btn');
  if (seg) {
    const g = seg.closest('.seg');
    if (!g) return;
    const team = g.dataset.team;
    if (g.dataset.kind === 'pent') {
      await api(`/api/admin/teams/${team}/pentathlon`, 'PUT', {
        discipline_id: Number(g.dataset.disc),
        points: Number(seg.dataset.value),
      });
    } else if (g.dataset.kind === 'quiz') {
      const tb = document.querySelector(`input[data-tiebreak][data-team="${team}"]`);
      await api(`/api/admin/teams/${team}/quiz`, 'PUT', {
        quiz_points: Number(seg.dataset.value),
        tiebreak_guess: tb && tb.value !== '' ? Number(tb.value) : null,
      });
    } else if (g.dataset.kind === 'mstatus') {
      await api(`/api/admin/teams/${team}/missions/${g.dataset.mission}`, 'PUT', {
        status: seg.dataset.status,
      });
    }
    toast('Uloženo');
    return refresh();
  }

  const adjBtn = e.target.closest('button[data-adj-step]');
  if (adjBtn) {
    const team = adjBtn.dataset.adjTeam;
    const input = document.querySelector(`input[data-adjustment][data-adj-team="${team}"]`);
    const next = (Number(input.value) || 0) + Number(adjBtn.dataset.adjStep);
    await api(`/api/admin/teams/${team}/adjustment`, 'PUT', { adjustment: next });
    toast('Uloženo');
    return refresh();
  }

  const del = e.target.closest('button[data-del]');
  if (del) {
    if (!confirm('Opravdu smazat tým?')) return;
    await api(`/api/admin/teams/${del.dataset.del}`, 'DELETE');
    toast('Smazáno');
    return refresh();
  }
});

document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.matches('input[data-tiebreak]')) {
    const team = el.dataset.team;
    const active = document.querySelector(
      `.seg[data-kind="quiz"][data-team="${team}"] .seg-btn.active`,
    );
    await api(`/api/admin/teams/${team}/quiz`, 'PUT', {
      quiz_points: active ? Number(active.dataset.value) : 0,
      tiebreak_guess: el.value === '' ? null : Number(el.value),
    });
    toast('Uloženo');
    return refresh();
  }
  if (el.matches('input[data-members]')) {
    await api(`/api/admin/teams/${el.dataset.team}/members`, 'PUT', {
      members: el.value,
    });
    toast('Uloženo');
    return refresh();
  }
  if (el.matches('input[data-adjustment]')) {
    await api(`/api/admin/teams/${el.dataset.adjTeam}/adjustment`, 'PUT', {
      adjustment: Number(el.value) || 0,
    });
    toast('Uloženo');
    return refresh();
  }
});

// Přepínání záložek.
$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document
    .querySelectorAll('.tab')
    .forEach((t) => t.classList.toggle('active', t === btn));
  document
    .querySelectorAll('.tab-panel')
    .forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== btn.dataset.tab));
});

$('add-team').addEventListener('click', async () => {
  const name = $('new-team').value.trim();
  const secret = $('new-secret').value.trim();
  if (!name) return toast('Vyplň název týmu.');
  if (!secret) return toast('Vyplň tajné slovo.');
  const res = await fetch('/api/admin/teams', {
    method: 'POST',
    headers: { 'x-admin-password': PASSWORD, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, secret_word: secret }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return toast(data.error || 'Tým se nepodařilo přidat.');
  $('new-team').value = '';
  $('new-secret').value = '';
  toast('Tým přidán, vylosovány 2 mise');
  await refresh();
});
$('new-secret').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('add-team').click();
});
$('new-team').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('add-team').click();
});

$('save-settings').addEventListener('click', async () => {
  const disciplines = [...$('disciplines-grid').querySelectorAll('input[data-disc]')].map(
    (inp) => ({ id: Number(inp.dataset.disc), name: inp.value }),
  );
  await api('/api/admin/settings', 'PUT', {
    event_title: $('event_title').value,
    tiebreak_correct: $('tiebreak_correct').value,
    disciplines,
  });
  toast('Nastavení uloženo');
  await refresh();
});

// Auto-přihlášení, pokud je heslo uložené.
(async () => {
  if (PASSWORD && (await tryLogin(PASSWORD))) {
    showPanel();
  }
})();
