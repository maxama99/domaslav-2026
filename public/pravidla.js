function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  );
}

async function loadDisciplines() {
  const el = document.getElementById('disciplines');
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    const list = data.disciplines || [];
    if (!list.length) {
      el.innerHTML = '<li class="empty">Disciplíny zatím nejsou nastavené.</li>';
      return;
    }
    el.innerHTML = list.map((d) => `<li>${escapeHtml(d.name)}</li>`).join('');
  } catch (e) {
    el.innerHTML = '<li class="empty">Nepodařilo se načíst disciplíny.</li>';
  }
}

loadDisciplines();
