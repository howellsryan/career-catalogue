// Light / dark theme toggle.
// The initial theme is applied inline in <head> (see _includes/head.html) to
// avoid a flash; this only wires up the toggle button and persists the choice.
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  if (!btn) return;

  var media = window.matchMedia('(prefers-color-scheme: dark)');

  function current() {
    return root.getAttribute('data-theme') || (media.matches ? 'dark' : 'light');
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('cc-theme', theme); } catch (e) {}
    btn.setAttribute('aria-pressed', theme === 'dark');
  }

  btn.addEventListener('click', function () {
    apply(current() === 'dark' ? 'light' : 'dark');
  });

  // Follow the OS setting until the user makes an explicit choice.
  media.addEventListener('change', function (e) {
    try {
      if (!localStorage.getItem('cc-theme')) {
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    } catch (err) {}
  });
})();
