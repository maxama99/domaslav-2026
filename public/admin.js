let PASSWORD = localStorage.getItem('adminPassword') || '';
let STATE = null;

const $ = (id) => document.getElementById(id);

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
      const total = pentTotal + t.missions_done * 5 + t.quiz_points;
      const discInputs = STATE.disciplines
        .map(
          (d) => `<div class="field-inline">
            <label>${escapeHtml(d.name)}</label>
            <input type="number" min="0" max="3" data-team="${t.id}" data-disc="${d.id}"
                   value="${t.discipline_points[d.id] || 0}" />
          </div>`,
        )
        .join('');

      return `<div class="team-block">
        <div class="team-head">
          <strong>${escapeHtml(t.name)}</strong>
          <span><span class="pill">${total} b</span>
            <button class="danger" data-del="${t.id}">Smazat</button></span>
        </div>

        <label style="margin-top:0.8rem">Pětiboj (0–3 na disciplínu)</label>
        <div class="grid">${discInputs}</div>

        <div class="grid" style="margin-top:0.8rem">
          <div class="field-inline">
            <label>Splněné mise (0–3)</label>
            <input type="number" min="0" max="3" data-team="${t.id}" data-missions
                   value="${t.missions_done}" />
          </div>
          <div class="field-inline">
            <label>Kvíz (umístění)</label>
            <select data-team="${t.id}" data-quiz>
              <option value="0"  ${t.quiz_points === 0 ? 'selected' : ''}>—</option>
              <option value="15" ${t.quiz_points === 15 ? 'selected' : ''}>1. místo (15)</option>
              <option value="10" ${t.quiz_points === 10 ? 'selected' : ''}>2. místo (10)</option>
              <option value="5"  ${t.quiz_points === 5 ? 'selected' : ''}>3. místo (5)</option>
            </select>
          </div>
          <div class="field-inline">
            <label>Rozstřel (odhad)</label>
            <input type="number" step="any" data-team="${t.id}" data-tiebreak
                   value="${t.tiebreak_guess ?? ''}" style="width:6rem" />
          </div>
        </div>
      </div>`;
    })
    .join('');

  // Body pětiboje — uložení při změně.
  $('teams').querySelectorAll('input[data-disc]').forEach((inp) => {
    inp.addEventListener('change', async () => {
      await api(`/api/admin/teams/${inp.dataset.team}/pentathlon`, 'PUT', {
        discipline_id: Number(inp.dataset.disc),
        points: Number(inp.value),
      });
      toast('Uloženo');
      await refresh();
    });
  });

  $('teams').querySelectorAll('input[data-missions]').forEach((inp) => {
    inp.addEventListener('change', async () => {
      await api(`/api/admin/teams/${inp.dataset.team}/missions`, 'PUT', {
        missions_done: Number(inp.value),
      });
      toast('Uloženo');
      await refresh();
    });
  });

  // Kvíz + rozstřel spolu (oba jdou přes /quiz endpoint).
  const saveQuiz = async (teamId) => {
    const block = $('teams');
    const quiz = block.querySelector(`[data-quiz][data-team="${teamId}"]`).value;
    const tb = block.querySelector(`input[data-tiebreak][data-team="${teamId}"]`).value;
    await api(`/api/admin/teams/${teamId}/quiz`, 'PUT', {
      quiz_points: Number(quiz),
      tiebreak_guess: tb === '' ? null : Number(tb),
    });
    toast('Uloženo');
    await refresh();
  };
  $('teams').querySelectorAll('[data-quiz], input[data-tiebreak]').forEach((inp) => {
    inp.addEventListener('change', () => saveQuiz(inp.dataset.team));
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
  if (!name) return;
  await api('/api/admin/teams', 'POST', { name });
  $('new-team').value = '';
  toast('Tým přidán');
  await refresh();
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
