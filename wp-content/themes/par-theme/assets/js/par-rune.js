/* Rune Cast (AI): стіл для кидання рун. Дані (голоси, руни) читаються з #rc-config на сторінці. */
(function () {
  'use strict';
  var root = document.getElementById('rc-app');
  var cfgEl = document.getElementById('rc-config');
  if (!root || !cfgEl) return;
  var cfg;
  try { cfg = JSON.parse(cfgEl.textContent); } catch (e) { return; }

  var ENDPOINT = cfg.api || '/api/rune-cast/';
  // Локальна перевірка: сторінка з нестандартним портом ходить на локальний Worker.
  if (location.port && /^(127\.0\.0\.1|localhost)$/.test(location.hostname)) {
    ENDPOINT = location.protocol + '//' + location.hostname + ':' + (cfg.localPort || 8836) + ENDPOINT;
  }
  var NS = 'http://www.w3.org/2000/svg';
  var POS = ['At the heart', 'Close by', 'At the edge'];
  var POS_LONG = ['The core of the question', 'What bears on it', 'What lies at the edge'];
  var THROWN = 9;
  var byName = {};
  cfg.runes.forEach(function (r) { byName[r.name] = r; });

  var state = { voice: cfg.voices[0].slug, cast: null, busy: false, reading: '' };

  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rnd() { var a = new Uint32Array(1); (window.crypto || window.msCrypto).getRandomValues(a); return a[0] / 4294967296; }

  function glyphSvg(rune, cls) {
    var s = '<svg' + (cls ? ' class="' + cls + '"' : '') + ' viewBox="0 0 60 100" aria-hidden="true" focusable="false">';
    rune.lines.forEach(function (l) { s += '<line x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '"/>'; });
    return s + '</svg>';
  }

  /* ---------- розмітка ---------- */
  root.innerHTML = '';
  var left = el('div', 'rc-panel');
  left.appendChild(el('p', 'rc-step', 'Step 1'));
  left.appendChild(el('h2', '', 'Choose an AI voice'));
  var voices = el('div', 'rc-voices');
  voices.setAttribute('role', 'radiogroup');
  voices.setAttribute('aria-label', 'AI voice');
  cfg.voices.forEach(function (v, i) {
    var b = el('button', 'rc-voice');
    b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.slug = v.slug;
    b.setAttribute('aria-checked', i === 0 ? 'true' : 'false');
    var g = byName[v.glyph];
    b.innerHTML = (g ? glyphSvg(g) : '<span></span>') + '<span><em>AI voice</em><b>' + esc(v.name) + ', ' + esc(v.role) + '</b><small>' + esc(v.blurb) + '</small></span>';
    b.addEventListener('click', function () {
      state.voice = v.slug;
      [].forEach.call(voices.children, function (c) { c.setAttribute('aria-checked', c === b ? 'true' : 'false'); });
    });
    voices.appendChild(b);
  });
  left.appendChild(voices);
  left.appendChild(el('p', 'rc-step', 'Step 2'));
  left.appendChild(el('h2', '', 'Hold a question in mind'));
  var q = el('textarea', 'rc-q');
  q.maxLength = 300; q.rows = 3; q.id = 'rc-question';
  q.placeholder = 'e.g. Should I stay in this job or look elsewhere?';
  q.setAttribute('aria-label', 'Your question');
  left.appendChild(q);
  var count = el('div', 'rc-count', '<span>Avoid names and private details.</span><span id="rc-n">0 / 300</span>');
  left.appendChild(count);
  var chips = el('div', 'rc-chips');
  (cfg.samples || []).forEach(function (s) {
    var c = el('button', 'rc-chip', esc(s)); c.type = 'button';
    c.addEventListener('click', function () { q.value = s; sync(); q.focus(); });
    chips.appendChild(c);
  });
  left.appendChild(chips);
  left.appendChild(el('p', 'rc-step', 'Step 3'));
  var castBtn = el('button', 'btn btn--gold btn--lg rc-btn', 'Cast the stones');
  castBtn.type = 'button'; castBtn.disabled = true;
  left.appendChild(castBtn);
  left.appendChild(el('p', 'rc-note', 'An AI-written reflection for entertainment and self-reflection. It is not a prediction, not a live reading and not professional advice.'));

  var stage = el('div', 'rc-stage');
  var cloth = el('div', 'rc-cloth');
  cloth.innerHTML = '<svg class="rc-rings" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="13"/><circle cx="50" cy="50" r="28"/><circle cx="50" cy="50" r="42"/><line x1="50" y1="4" x2="50" y2="96"/><line x1="4" y1="50" x2="96" y2="50"/></svg>';
  var empty = el('div', 'rc-empty', glyphSvg(byName[cfg.voices[0].glyph] || cfg.runes[0]) + '<span>Write your question, then cast. Stones that land face up and closest to the centre are read.</span>');
  cloth.appendChild(empty);
  var live = el('div', 'rc-sr'); live.setAttribute('aria-live', 'polite');
  stage.appendChild(cloth); stage.appendChild(live);
  var legend = el('div', 'rc-legend'); legend.hidden = true;
  stage.appendChild(legend);
  var actions = el('div', 'rc-actions'); actions.hidden = true;
  var readBtn = el('button', 'btn btn--gold btn--lg', 'Read this cast'); readBtn.type = 'button';
  var recastBtn = el('button', 'btn btn--ghost btn--lg', 'Cast again'); recastBtn.type = 'button';
  actions.appendChild(readBtn); actions.appendChild(recastBtn);
  stage.appendChild(actions);
  var out = el('div'); stage.appendChild(out);
  root.appendChild(left); root.appendChild(stage);

  function sync() {
    var n = q.value.trim().length;
    document.getElementById('rc-n').textContent = q.value.length + ' / 300';
    castBtn.disabled = state.busy || n < 3;
  }
  q.addEventListener('input', sync);

  /* ---------- кидок ---------- */
  function throwStones() {
    var pool = cfg.runes.map(function (r) { return r.name; });
    var picked = [];
    for (var i = 0; i < THROWN; i++) picked.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    var pts = [], guard = 0;
    while (pts.length < THROWN && guard++ < 4000) {
      var a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.8;
      var p = { x: Math.cos(a) * r, y: Math.sin(a) * r };
      if (pts.every(function (o) { return Math.hypot(o.x - p.x, o.y - p.y) > 0.3; })) pts.push(p);
    }
    while (pts.length < THROWN) pts.push({ x: (rnd() - 0.5) * 1.2, y: (rnd() - 0.5) * 1.2 });
    var stones = picked.map(function (name, i) {
      return { name: name, x: pts[i].x, y: pts[i].y, rot: Math.round((rnd() - 0.5) * 70), up: rnd() < 0.55 };
    });
    var up = stones.filter(function (s) { return s.up; }).length;
    var downs = stones.filter(function (s) { return !s.up; });
    while (up < 3 && downs.length) { downs.splice(Math.floor(rnd() * downs.length), 1)[0].up = true; up++; }
    var ups = stones.filter(function (s) { return s.up; }).sort(function (a, b) { return Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y); });
    ups.forEach(function (s, i) { s.rank = i < 3 ? i : -1; });
    return stones;
  }

  function doCast() {
    if (state.busy) return;
    var question = q.value.trim();
    if (question.length < 3) return;
    state.reading = ''; out.innerHTML = '';
    empty.classList.add('gone');
    [].slice.call(cloth.querySelectorAll('.rc-stone')).forEach(function (s) { s.remove(); });
    var stones = throwStones();
    state.cast = { question: question, stones: stones, runes: stones.filter(function (s) { return s.rank >= 0; }).sort(function (a, b) { return a.rank - b.rank; }).map(function (s) { return s.name; }), unread: stones.filter(function (s) { return !s.up; }).length };
    legend.hidden = true; actions.hidden = true;
    var nodes = stones.map(function (s, i) {
      var n = el('div', 'rc-stone' + (s.up ? '' : ' down'));
      n.style.left = (50 + s.x * 50) + '%'; n.style.top = (50 + s.y * 50) + '%';
      n.style.setProperty('--rot', s.rot + 'deg');
      n.style.transitionDelay = (i * 80) + 'ms';
      if (s.up) n.innerHTML = glyphSvg(byName[s.name]);
      cloth.appendChild(n);
      s.node = n;
      return n;
    });
    requestAnimationFrame(function () { requestAnimationFrame(function () { nodes.forEach(function (n) { n.classList.add('landed'); }); }); });
    var settle = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : THROWN * 80 + 1000;
    state.busy = true; castBtn.disabled = true;
    setTimeout(function () {
      stones.forEach(function (s) {
        if (!s.up) return;
        if (s.rank >= 0) {
          s.node.classList.add('pick');
          s.node.appendChild(el('span', 'rc-no', String(s.rank + 1)));
        } else s.node.classList.add('far');
      });
      stones.filter(function (s) { return !s.up; }).forEach(function (s) { s.node.classList.add('far'); });
      legend.innerHTML = '';
      state.cast.runes.forEach(function (name, i) {
        var r = byName[name];
        legend.appendChild(el('div', 'rc-leg', '<small>' + (i + 1) + ' · ' + POS[i] + '</small><b>' + esc(name) + '</b><span>' + esc(r.meaning) + '</span>'));
      });
      legend.hidden = false; actions.hidden = false;
      live.textContent = 'Cast complete. Runes read: ' + state.cast.runes.map(function (n, i) { return POS[i] + ', ' + n; }).join('; ') + '. ' + state.cast.unread + ' stones landed face down and were left unread.';
      state.busy = false; sync();
      readBtn.focus({ preventScroll: true });
    }, settle);
  }
  castBtn.addEventListener('click', doCast);
  recastBtn.addEventListener('click', doCast);

  /* ---------- читання (потік із автоповтором при обриві) ---------- */
  function md(text) {
    return text.split(/\n{2,}/).map(function (p) {
      return '<p>' + esc(p.trim()).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</p>';
    }).join('');
  }

  var panel = null, body = null, status = null;
  function ensurePanel() {
    out.innerHTML = '';
    var v = cfg.voices.filter(function (x) { return x.slug === state.voice; })[0];
    panel = el('div', 'rc-read');
    panel.appendChild(el('div', 'rc-by', 'AI reading in the voice of ' + esc(v.name) + ' · not a real person'));
    body = el('div'); status = el('div', 'rc-status', 'Reading the stones…');
    panel.appendChild(body); panel.appendChild(status);
    out.appendChild(panel);
  }

  function stream(attempt) {
    var c = state.cast;
    var payload = { voice: state.voice, question: c.question, runes: c.runes, unread: c.unread };
    var text = '', gotDone = false, cut = false, failedEarly = false, fatal = null;
    status.className = 'rc-status';
    status.textContent = attempt ? 'The line dropped, trying once more…' : 'Reading the stones…';
    return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(function (res) {
      if (!res.ok) {
        if (res.status === 429) fatal = 'Please wait a minute before asking again.';
        else if (res.status === 400 || res.status === 413) fatal = 'Please check your question and try casting again.';
        else failedEarly = true;
        return null;
      }
      var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          buf += dec.decode(r.value, { stream: true });
          var i;
          while ((i = buf.indexOf('\n')) >= 0) {
            var line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (line.indexOf('data:') !== 0) continue;
            var p = line.slice(5).trim();
            if (p === '[DONE]') { gotDone = true; continue; }
            try {
              var j = JSON.parse(p);
              if (j.cut) cut = true;
              if (j.t) { text += j.t; body.innerHTML = md(text); status.textContent = ''; }
            } catch (e) { /* неповний рядок */ }
          }
          return pump();
        });
      }
      return pump();
    }).catch(function () { if (!text) failedEarly = true; else cut = true; }).then(function () {
      if (fatal) { status.className = 'rc-status err'; status.textContent = fatal; return; }
      var ok = gotDone && !cut && text.trim().length > 40;
      if (ok) { state.reading = text; status.textContent = ''; finish(); return; }
      if (attempt < 2) { body.innerHTML = ''; return stream(attempt + 1); }
      if (text.trim().length > 40) { state.reading = text; status.className = 'rc-status err'; status.textContent = 'The reading was cut short. You can read it again.'; finish(true); return; }
      status.className = 'rc-status err'; status.textContent = 'The reading is unavailable right now. Please try again in a moment.';
      finish(true);
    });
  }

  function finish(retry) {
    readBtn.disabled = false; recastBtn.disabled = false; state.busy = false; sync();
    readBtn.textContent = 'Read this cast again';
    if (!retry) {
      var links = el('div', 'rc-links', '<a href="' + esc(cfg.links.match) + '">Find a reading style for this question &rarr;</a><a href="' + esc(cfg.links.ratings) + '">Compare advisor ratings &rarr;</a>');
      panel.appendChild(links);
      var cp = el('button', 'rc-chip', 'Copy reading'); cp.type = 'button';
      cp.addEventListener('click', function () {
        var t = body.innerText;
        (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { cp.textContent = 'Copied'; }, function () { cp.textContent = 'Copy not available'; });
      });
      links.appendChild(cp);
    }
  }

  readBtn.addEventListener('click', function () {
    if (!state.cast || state.busy) return;
    state.busy = true; readBtn.disabled = true; recastBtn.disabled = true; castBtn.disabled = true;
    ensurePanel();
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    stream(0);
  });
})();
