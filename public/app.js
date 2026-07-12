const MEDALS = ['🥇', '🥈', '🥉'];

async function load() {
  try {
    const res = await fetch('/api/leaderboard');
    if (!res.ok) throw new Error('fetch failed');
    const data = await res.json();
    render(data);
  } catch (e) {
    document.getElementById('board-body').innerHTML =
      '<tr><td colspan="6" class="empty">Nepodařilo se načíst data.</td></tr>';
  }
}

function render(data) {
  document.getElementById('title').textContent = data.title;
  document.title = data.title;

  const body = document.getElementById('board-body');
  if (!data.teams.length) {
    body.innerHTML = '<tr><td colspan="6" class="empty">Zatím žádné týmy.</td></tr>';
  } else {
    body.innerHTML = data.teams
      .map((t, i) => {
        const rank =
          i < 3
            ? `<span class="medal">${MEDALS[i]}</span>`
            : `<span class="rank-num">${i + 1}</span>`;
        const cls = i < 3 ? `top-${i + 1}` : '';
        const members =
          t.members && t.members.length
            ? `<div class="team-members">${t.members.map(escapeHtml).join(', ')}</div>`
            : '';
        return `<tr class="${cls}">
          <td class="col-rank">${rank}</td>
          <td class="col-team">${escapeHtml(t.name)}${members}</td>
          <td>${fmt(t.pentathlon)}</td>
          <td>${fmt(t.missions)}</td>
          <td>${fmt(t.quiz)}</td>
          <td class="col-total">${fmt(t.total)}</td>
        </tr>`;
      })
      .join('');
  }

  const now = new Date();
  document.getElementById('updated').textContent =
    'Aktualizováno ' + now.toLocaleTimeString('cs-CZ');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

load();
setInterval(load, 30000);
