// Keyboard navigation between slide files. Targets come from the nav links on each page.
document.addEventListener('keydown', function (e) {
  var next = document.querySelector('.nav a[rel="next"]:not(.disabled)');
  var prev = document.querySelector('.nav a[rel="prev"]:not(.disabled)');
  if (['ArrowRight', 'PageDown', ' '].indexOf(e.key) !== -1 && next) { e.preventDefault(); location.href = next.href; }
  if (['ArrowLeft', 'PageUp', 'Escape'].indexOf(e.key) !== -1 && prev) { e.preventDefault(); location.href = prev.href; }
});

// Card navigation: WASD moves focus between cards, Enter opens the focused card (native link
// activation), Backspace returns to the page you came from. The last focused card is remembered
// per page, so coming back lands on the card you opened.
(function () {
  var cards = Array.prototype.slice.call(document.querySelectorAll('a.card'));
  var KEY = 'bob-slideshow-card:' + location.pathname;
  var DIRS = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0] };

  function focusCard(card) {
    card.focus();
    try { sessionStorage.setItem(KEY, String(cards.indexOf(card))); } catch (err) { /* storage unavailable */ }
  }

  function center(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Nearest card in the given direction; movement off the main axis costs double.
  function neighbour(from, dir) {
    var c = center(from), best = null, bestScore = Infinity;
    cards.forEach(function (card) {
      if (card === from) return;
      var p = center(card), dx = p.x - c.x, dy = p.y - c.y;
      var main = dir[0] ? dx * dir[0] : dy * dir[1];
      var cross = Math.abs(dir[0] ? dy : dx);
      if (main <= 1) return;
      var score = main + cross * 2;
      if (score < bestScore) { best = card; bestScore = score; }
    });
    return best;
  }

  // Reset: forget the remembered card on every page, deselect the current card, scroll to the top.
  function resetValues() {
    try {
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf('bob-slideshow-card:') === 0) sessionStorage.removeItem(k);
      });
    } catch (err) { /* storage unavailable */ }
    if (cards.indexOf(document.activeElement) !== -1) document.activeElement.blur();
    var scroller = document.querySelector('.slide.scroll, .slide.detail');
    if (scroller) scroller.scrollTop = 0;
  }

  if (cards.length) {
    var legend = document.createElement('div');
    legend.className = 'legend';
    legend.setAttribute('aria-hidden', 'true');
    legend.innerHTML =
      '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><span>Move</span>' +
      '<kbd>&#8629;</kbd><span>Open</span>' +
      '<kbd>&#9003;</kbd><span>Back</span>' +
      '<kbd>R</kbd><span>Reset</span>';
    document.body.appendChild(legend);

    try {
      var saved = cards[parseInt(sessionStorage.getItem(KEY), 10)];
      if (saved) saved.focus();
    } catch (err) { /* storage unavailable */ }
    cards.forEach(function (card) {
      card.addEventListener('focus', function () {
        try { sessionStorage.setItem(KEY, String(cards.indexOf(card))); } catch (err) { /* ignore */ }
      });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    var key = e.key.toLowerCase();

    if (DIRS[key] && cards.length) {
      e.preventDefault();
      var current = cards.indexOf(document.activeElement) !== -1 ? document.activeElement : null;
      if (!current) { focusCard(cards[0]); return; }
      var target = neighbour(current, DIRS[key]);
      if (target) focusCard(target);
    } else if (key === 'r') {
      e.preventDefault();
      resetValues();
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      var prev = document.querySelector('.nav a[rel="prev"]:not(.disabled)');
      if (history.length > 1) history.back();
      else if (prev) location.href = prev.href;
    }
  });
})();

// Light/dark theme toggle. The choice is stored in localStorage and shared by all slide pages.
(function () {
  var KEY = 'bob-slideshow-theme';
  var root = document.documentElement;

  function read() {
    try { return localStorage.getItem(KEY); } catch (err) { return null; }
  }
  function write(value) {
    try { localStorage.setItem(KEY, value); } catch (err) { /* storage unavailable: theme applies to this page only */ }
  }

  var theme = read() === 'light' ? 'light' : 'dark';
  root.setAttribute('data-theme', theme);

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'theme-toggle';
  btn.innerHTML =
    '<svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>' +
    '<svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/>' +
    '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function label() {
    var t = root.getAttribute('data-theme');
    btn.setAttribute('aria-label', t === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
    btn.title = btn.getAttribute('aria-label');
  }
  btn.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    write(next);
    label();
  });
  btn.addEventListener('keydown', function (e) { if (e.key === ' ') e.stopPropagation(); });

  label();
  document.body.appendChild(btn);
})();
