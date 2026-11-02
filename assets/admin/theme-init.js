// Runs before first paint: stored choice, else the system preference, else dark.
(() => {
  let theme = null;
  try { theme = localStorage.getItem('pb-theme'); } catch (e) { /* storage blocked */ }
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.dataset.theme = theme;
})();
