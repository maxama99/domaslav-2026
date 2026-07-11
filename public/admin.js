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
  renderTeams();
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

function renderTeams() {
  if (!STATE.teams.length) {
    $('teams').innerHTML = '<p class="hint">Zatím žádné týmy.</p>';
    return;
  }
  $('teams').innerHTML = STATE.teams
    .map((t) => {
      const pentTotal = STATE.disciplines.reduce(
        (sum, d) => sum + (t.discipline_points[d.id] || 0),
        0,
      );
      const missionPts = t.missions_done * 5;
      const total = pentTotal + missionPts + t.quiz_points;
      const discSegs = STATE.disciplines
        .map(
          (d) => `<div class="seg-field">
            <label>${escapeHtml(d.name)}</label>
            ${segGroup('pent', t.id, t.discipline_points[d.id] || 0, PENT_OPTS, `data-disc="${d.id}"`)}
          </div>`,
        )
        .join('');

      const missionList = (t.missions || []).length
        ? (t.missions || [])
            .map((m) => {
              const done = m.status === 'completed';
              return `<div class="admin-mission${done ? ' done' : ''}">
                <span><span class="m-num">#${m.number}</span><span class="m-title">${escapeHtml(m.title)}</span></span>
                <button class="${done ? 'ghost' : ''}" data-mission-team="${t.id}"
                        data-mission="${m.mission_id}" data-next="${done ? 'active' : 'completed'}">
                  ${done ? '↩ Vrátit' : '✓ Splněno'}
                </button>
              </div>`;
            })
            .join('')
        : '<p class="hint" style="text-align:left">Žádné nalosované mise.</p>';

      return `<div class="team-block">
        <div class="team-head">
          <strong>${escapeHtml(t.name)}</strong>
          <span><span class="pill">${total} / 45 b</span>
            <button class="danger" data-del="${t.id}">Smazat</button></span>
        </div>
        <p class="secret-tag">Tajné slovo: <code>${escapeHtml(t.secret_word || '—')}</code></p>
        <div class="seg-field" style="margin-top:0.4rem">
          <label>👥 Účastníci (oddělené čárkou)</label>
          <input type="text" data-team="${t.id}" data-members
                 value="${escapeHtml(t.members || '')}" placeholder="Anna, Petr, Katka" />
        </div>

        <div class="team-section">
          <div class="section-head">
            <span>🍺 Hospodský pětiboj</span><span class="subscore">${pentTotal} / 15 b</span>
          </div>
          <div class="disc-segs">${discSegs}</div>
        </div>

        <div class="team-section">
          <div class="section-head">
            <span>🕵️ Tajné mise</span><span class="subscore">${missionPts} / 15 b</span>
          </div>
          <div class="admin-missions">${missionList}</div>
        </div>

        <div class="team-section">
          <div class="section-head">
            <span>🧠 Pub kvíz</span><span class="subscore">${t.quiz_points} / 15 b</span>
          </div>
          <div class="seg-field">
            <label>Umístění (body)</label>
            ${segGroup('quiz', t.id, t.quiz_points, QUIZ_OPTS)}
          </div>
          <div class="seg-field" style="margin-top:0.7rem">
            <label>🎯 Rozstřel (číselný odhad)</label>
            <input type="number" step="any" data-team="${t.id}" data-tiebreak
                   value="${t.tiebreak_guess ?? ''}" style="width:8rem" />
          </div>
        </div>
      </div>`;
    })
    .join('');

  // Klik na segmentové tlačítko → uložení.
  $('teams').querySelectorAll('.seg-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const seg = btn.closest('.seg');
      const team = seg.dataset.team;
      const value = Number(btn.dataset.value);
      if (seg.dataset.kind === 'pent') {
        await api(`/api/admin/teams/${team}/pentathlon`, 'PUT', {
          discipline_id: Number(seg.dataset.disc),
          points: value,
        });
      } else if (seg.dataset.kind === 'quiz') {
        const tb = $('teams').querySelector(`input[data-tiebreak][data-team="${team}"]`).value;
        await api(`/api/admin/teams/${team}/quiz`, 'PUT', {
          quiz_points: value,
          tiebreak_guess: tb === '' ? null : Number(tb),
        });
      }
      toast('Uloženo');
      await refresh();
    });
  });

  // Rozstřel - uloží se spolu s aktuálním kvízovým skóre.
  $('teams').querySelectorAll('input[data-tiebreak]').forEach((inp) => {
    inp.addEventListener('change', async () => {
      const team = inp.dataset.team;
      const active = $('teams').querySelector(
        `.seg[data-kind="quiz"][data-team="${team}"] .seg-btn.active`,
      );
      await api(`/api/admin/teams/${team}/quiz`, 'PUT', {
        quiz_points: active ? Number(active.dataset.value) : 0,
        tiebreak_guess: inp.value === '' ? null : Number(inp.value),
      });
      toast('Uloženo');
      await refresh();
    });
  });

  // Účastníci týmu.
  $('teams').querySelectorAll('input[data-members]').forEach((inp) => {
    inp.addEventListener('change', async () => {
      await api(`/api/admin/teams/${inp.dataset.team}/members`, 'PUT', {
        members: inp.value,
      });
      toast('Uloženo');
      await refresh();
    });
  });

  // Potvrzení / vrácení splnění mise.
  $('teams').querySelectorAll('button[data-mission]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api(
        `/api/admin/teams/${btn.dataset.missionTeam}/missions/${btn.dataset.mission}`,
        'PUT',
        { status: btn.dataset.next },
      );
      toast('Uloženo');
      await refresh();
    });
  });

  $('teams').querySelectorAll('button[data-del]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Opravdu smazat tým?')) return;
      await api(`/api/admin/teams/${btn.dataset.del}`, 'DELETE');
      toast('Smazáno');
      await refresh();
    });
  });
}

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
