// The pause menu (see app/pausemenu.js). Moves with the controller or keyboard through events from EchoForge,
// and with the mouse directly.
(function () {
  const $ = id => document.getElementById(id);
  let items = [], sel = 0, busy = false;
  const fmt = s => { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h ? `${h} h ${m} min` : `${Math.max(1, m)} min`; };

  function draw() {
    $('items').innerHTML = '';
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'item' + (i === sel ? ' sel' : '') + (it.off ? ' off' : '') + (it.danger ? ' danger' : '');
      b.setAttribute('role', 'menuitem'); if (it.off) b.setAttribute('aria-disabled', 'true');
      b.textContent = it.label;
      if (it.note) { const s = document.createElement('small'); s.textContent = it.note; b.appendChild(s); }
      b.addEventListener('mouseenter', () => { if (!it.off) { sel = i; mark(); } });
      b.addEventListener('click', () => { sel = i; choose(); });
      $('items').appendChild(b);
    });
  }
  function mark() { [...$('items').children].forEach((b, i) => b.classList.toggle('sel', i === sel)); }
  function move(d) {
    for (let n = 0; n < items.length; n++) { sel = (sel + d + items.length) % items.length; if (!items[sel].off) break; }
    mark();
  }
  async function choose() {
    const it = items[sel]; if (!it || it.off || busy) return;
    busy = true; $('msg').textContent = '';
    try { const r = await window.menu.act(it.id); if (r && r.msg) $('msg').textContent = r.msg; } finally { busy = false; }
  }

  window.menu.onOpen(p => {
    for (const [k, v] of Object.entries(p.theme || {})) if (v) document.documentElement.style.setProperty(k, v);
    items = p.items || []; sel = 0;
    $('kicker').textContent = p.paused ? 'Paused' : 'Menu';
    $('title').textContent = p.title || '';
    $('sub').textContent = `Playing for ${fmt(p.seconds || 0)}${p.paused ? ' · the game is paused' : ''}`;
    $('msg').textContent = '';
    draw(); requestAnimationFrame(() => $('scrim').classList.add('on'));
  });
  window.menu.onClose(() => { $('scrim').classList.remove('on'); });
  window.menu.onNav(dir => {
    if (dir === 'up' || dir === 'left') move(-1);
    else if (dir === 'down' || dir === 'right') move(1);
    else if (dir === 'ok') choose();
    else if (dir === 'back') window.menu.act('resume');
  });
  // When the menu window does have focus, plain keys work too.
  document.addEventListener('keydown', e => {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Escape: 'back' };
    if (map[e.key]) { e.preventDefault(); }
  });
})();
