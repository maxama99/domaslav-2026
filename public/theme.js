(function () {
  const KEY = 'theme';
  const root = document.documentElement;
  const current = () => root.dataset.theme || 'dark';

  function apply(theme) {
    root.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch (e) {}
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.textContent = theme === 'dark' ? '☀️' : '🌙';
      btn.title =
        theme === 'dark' ? 'Přepnout na světlý motiv' : 'Přepnout na tmavý motiv';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    apply(current());
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () =>
        apply(current() === 'dark' ? 'light' : 'dark'),
      );
    }
  });
})();
