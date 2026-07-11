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
        const rank = i < 3 ? `<span class="medal">${MEDALS[i]}</span>` : i + 1;
        const cls = i < 3 ? `top-${i + 1}` : '';
        return `<tr class="${cls}">
          <td class="col-rank">${rank}</td>
          <td class="col-team">${escapeHtml(t.name)}</td>
          <td>${t.pentathlon}</td>
          <td>${t.missions}</td>
          <td>${t.quiz}</td>
          <td class="col-total">${t.total}</td>
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

load();
setInterval(load, 5000);
