let SECRET = localStorage.getItem('teamSecret') || '';

const $ = (id) => document.getElementById(id);

function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
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
      'x-team-secret': SECRET,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) {
    logout();
    throw new Error('unauthorized');
  }
  return res;
}

function logout() {
  SECRET = '';
  localStorage.removeItem('teamSecret');
  $('panel').classList.add('hidden');
  $('login-card').classList.remove('hidden');
}

async function tryLogin(secret) {
  const res = await fetch('/api/team/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret_word: secret }),
  });
  if (!res.ok) return false;
  SECRET = secret;
  localStorage.setItem('teamSecret', secret);
  return true;
}

$('login-btn').addEventListener('click', async () => {
  const secret = $('secret').value.trim();
  if (!secret) return;
  if (await tryLogin(secret)) {
    $('login-error').classList.add('hidden');
    showPanel();
  } else {
    $('login-error').classList.remove('hidden');
  }
});
$('secret').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('login-btn').click();
});
$('logout-btn').addEventListener('click', logout);

async function showPanel() {
  $('login-card').classList.add('hidden');
  $('panel').classList.remove('hidden');
  await refresh();
}

async function refresh() {
  const res = await api('/api/team/state');
  const data = await res.json();
  render(data);
}

function render(data) {
  $('team-name').textContent = data.name;
  $('mission-score').textContent = `${data.completed * 5} / 15 b`;

  $('missions').innerHTML = data.missions
    .map((m) => {
      const done = m.status === 'completed';
      const conds = m.conditions
        .map(
          (c) =>
            `<li class="mcard-cond${done ? ' done' : ''}">${escapeHtml(c)}</li>`,
        )
        .join('');
      const warn = m.warning
        ? `<div class="mcard-warn"><strong>POZOR:</strong> ${escapeHtml(m.warning)}</div>`
        : '';
      return `<div class="card mcard${done ? ' completed' : ''}">
        <div class="mcard-head">
          <span class="mcard-tag">TAJNÁ MISE ${m.number}</span>
          <span class="mcard-badge ${done ? 'ok' : 'active'}">${done ? '✓ Splněno' : 'Aktivní'}</span>
        </div>
        <h3 class="mcard-title">${escapeHtml(m.title)}</h3>
        <p class="mcard-intro">${escapeHtml(m.intro)}</p>
        <div class="mcard-label">Podmínky splnění</div>
        <ul class="mcard-conds">${conds}</ul>
        ${warn}
      </div>`;
    })
    .join('');

  // Losování
  const btn = $('draw-btn');
  const hint = $('draw-hint');
  btn.disabled = !data.canDraw;
  if (data.drawn >= 3) {
    hint.textContent = 'Máš už všechny tři karty.';
  } else if (data.completed < 1) {
    hint.textContent = 'Odemkne se po potvrzení první splněné mise.';
  } else if (data.deckLeft < 1) {
    hint.textContent = 'V balíčku už není žádná volná mise.';
  } else {
    hint.textContent = 'Máš splněnou misi - můžeš si vylosovat další kartu!';
  }
}

$('draw-btn').addEventListener('click', async () => {
  const res = await api('/api/team/draw', 'POST');
  const data = await res.json();
  if (!res.ok) {
    toast(data.error || 'Losování se nezdařilo.');
    return;
  }
  toast('Vylosována nová mise!');
  render(data);
});

// Auto-přihlášení, pokud je slovo uložené.
(async () => {
  if (SECRET && (await tryLogin(SECRET))) {
    showPanel();
  }
})();
