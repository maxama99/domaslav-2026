(function () {
  const KEY = 'theme';
  const root = document.documentElement;
  const current = () => root.dataset.theme || 'dark';

  const ICON_SUN =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const ICON_MOON =
    '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>';

  function apply(theme) {
    root.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch (e) {}
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.innerHTML = theme === 'dark' ? ICON_SUN : ICON_MOON;
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
