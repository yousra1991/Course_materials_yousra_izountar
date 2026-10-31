/* Annotation tools for the HCI tutorials: highlight, pen, notes, eraser.
   Everything is saved in the browser of the student (localStorage), per page.
   Nothing is sent anywhere. Created by Yousra Izountar. */
(function () {
  'use strict';
  var KEY = 'ann1:' + location.pathname.replace(/[^\w]/g, '_');
  var HL = { y: '#fde047', g: '#86efac', b: '#93c5fd', p: '#f9a8d4' };
  var HLN = { y: 'Yellow', g: 'Green', b: 'Blue', p: 'Pink' };
  var PEN = { k: '#111827', r: '#dc2626', b: '#1d4ed8' };
  var PENN = { k: 'Black', r: 'Red', b: 'Blue' };
  var S = { hl: [], notes: [], strokes: [], log: [] };
  var tool = null, penC = 'r', uid = 0;

  function load() {
    try { var r = localStorage.getItem(KEY); if (r) { var o = JSON.parse(r); S.hl = o.hl || []; S.notes = o.notes || []; S.strokes = o.strokes || []; S.log = o.log || []; } } catch (e) {}
    S.hl.concat(S.notes, S.strokes).forEach(function (x) { uid = Math.max(uid, +x.id.slice(1) || 0); });
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  function nid(p) { uid++; return p + uid; }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ---------- styles ---------- */
  var css = '' +
    '.an-ui,.an-ui *{box-sizing:border-box;font-family:"Segoe UI",Arial,sans-serif}' +
    '#an-dock{position:fixed;right:12px;bottom:12px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;gap:8px;max-width:calc(100vw - 24px)}' +
    '#an-toggle{background:#1d4ed8;color:#fff;border:0;border-radius:999px;padding:11px 18px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3)}' +
    '#an-toggle:focus-visible,#an-bar button:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}' +
    '#an-bar{background:#fff;border:1.5px solid #1d4ed8;border-radius:12px;padding:8px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;box-shadow:0 6px 20px rgba(0,0,0,.28);max-width:100%}' +
    '#an-bar[hidden]{display:none}' +
    '#an-bar button{min-height:38px;min-width:38px;border:1.5px solid #cbd5e1;background:#f8fafc;color:#111827;border-radius:8px;padding:4px 10px;font-size:13px;cursor:pointer}' +
    '#an-bar button[aria-pressed=true]{border-color:#1d4ed8;background:#dbeafe;box-shadow:0 0 0 2px #1d4ed8 inset;font-weight:700}' +
    '#an-bar .sw{padding:0;width:38px;border-width:2px}' +
    '#an-bar .sep{width:1px;align-self:stretch;background:#cbd5e1;margin:0 2px}' +
    '#an-bar .lab{font-size:11px;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-right:2px}' +
    '#an-pens[hidden]{display:none}#an-pens{display:flex;gap:6px;align-items:center}' +
    '#an-tip{font-size:12px;color:#334155;flex-basis:100%;margin:2px 2px 0}' +
    'mark.an-hl{color:inherit;border-radius:2px;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    'body.an-erase mark.an-hl{cursor:crosshair;outline:1px dashed #dc2626}' +
    '.an-layer{position:absolute;left:0;top:0;width:100%;height:100%;z-index:50;pointer-events:none}' +
    '.an-svg{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible}' +
    '.an-svg path.s{fill:none;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}' +
    '.an-svg path.h{fill:none;stroke:transparent;stroke-width:16;pointer-events:none}' +
    'body.an-erase .an-svg path.h{pointer-events:stroke;cursor:crosshair}' +
    'body.an-pen,body.an-pen *{user-select:none!important;-webkit-user-select:none!important;cursor:crosshair}' +
    '.an-note{position:absolute;width:190px;background:#fef9c3;border:1px solid #ca8a04;border-radius:6px;box-shadow:0 3px 10px rgba(0,0,0,.25);pointer-events:auto;font-size:13px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '.an-note .nh{display:flex;justify-content:space-between;align-items:center;background:#fde047;border-radius:5px 5px 0 0;cursor:grab;touch-action:none;padding:2px 4px;color:#713f12;font-size:11px;font-weight:700;user-select:none}' +
    '.an-note .nx{border:0;background:transparent;font-size:16px;line-height:1;cursor:pointer;color:#713f12;min-width:28px;min-height:28px}' +
    '.an-note textarea{display:block;width:100%;min-height:70px;border:0;background:transparent;resize:vertical;padding:6px;font-size:13px;color:#1f2937;font-family:"Segoe UI",Arial,sans-serif}' +
    'body.an-note-mode{cursor:cell}' +
    '@media print{.an-ui{display:none!important}.an-note .nx{display:none}}';
  var st = el('style'); st.textContent = css; document.head.appendChild(st);

  /* ---------- text index ---------- */
  function skip(n) {
    for (var p = n.parentNode; p; p = p.parentNode) {
      if (p.nodeType !== 1) continue;
      var t = p.tagName;
      if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT' || t === 'TEXTAREA' || t === 'SVG' || t === 'svg') return true;
      if (p.classList && (p.classList.contains('an-ui') || p.classList.contains('an-layer'))) return true;
    }
    return false;
  }
  function nodes() {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), a = [], n, acc = 0;
    while ((n = w.nextNode())) { if (skip(n)) continue; a.push({ n: n, o: acc }); acc += n.nodeValue.length; }
    return { list: a, full: a.map(function (x) { return x.n.nodeValue; }).join('') };
  }
  function wrap(list, s, e, id, c) {
    var segs = [];
    list.forEach(function (x) {
      var a = Math.max(s, x.o), b = Math.min(e, x.o + x.n.nodeValue.length);
      if (b > a) segs.push({ n: x.n, a: a - x.o, b: b - x.o });
    });
    segs.forEach(function (g) {
      var n = g.n;
      if (g.b < n.nodeValue.length) n.splitText(g.b);
      if (g.a > 0) n = n.splitText(g.a);
      if (!/\S/.test(n.nodeValue) && n.nodeValue.length < 2) return;
      var m = el('mark', 'an-hl'); m.dataset.id = id; m.style.background = HL[c] || HL.y;
      n.parentNode.insertBefore(m, n); m.appendChild(n);
    });
  }
  function unwrap(id) {
    var ms = document.querySelectorAll('mark.an-hl[data-id="' + id + '"]');
    Array.prototype.forEach.call(ms, function (m) {
      var p = m.parentNode; while (m.firstChild) p.insertBefore(m.firstChild, m); p.removeChild(m); p.normalize();
    });
  }
  function applyAll() {
    var ix = nodes();
    S.hl.forEach(function (h) {
      if (document.querySelector('mark.an-hl[data-id="' + h.id + '"]')) return;
      var pos = [], i = -1;
      while ((i = ix.full.indexOf(h.t, i + 1)) !== -1) pos.push(i);
      if (!pos.length) return;
      var best = pos.filter(function (p) { return ix.full.substr(Math.max(0, p - h.p.length), h.p.length) === h.p; });
      var at = best.length ? best[0] : pos.reduce(function (a, b) { return Math.abs(b - h.o) < Math.abs(a - h.o) ? b : a; });
      wrap(ix.list, at, at + h.t.length, h.id, h.c);
      ix = nodes();
    });
  }
  function highlightSelection(c) {
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
    var r = sel.getRangeAt(0);
    if (skip(r.commonAncestorContainer.nodeType === 3 ? r.commonAncestorContainer : r.commonAncestorContainer)) return false;
    var ix = nodes(), s = -1, e = -1;
    ix.list.forEach(function (x) {
      if (!r.intersectsNode(x.n)) return;
      var a = x.n === r.startContainer ? r.startOffset : 0;
      var b = x.n === r.endContainer ? r.endOffset : x.n.nodeValue.length;
      if (b <= a) return;
      if (s < 0) s = x.o + a;
      e = x.o + b;
    });
    if (s < 0 || e <= s) return false;
    var t = ix.full.slice(s, e);
    if (!/\S/.test(t)) return false;
    var h = { id: nid('h'), c: c, t: t, o: s, p: ix.full.substr(Math.max(0, s - 24), Math.min(24, s)) };
    S.hl.push(h); S.log.push(h.id);
    wrap(ix.list, s, e, h.id, c);
    sel.removeAllRanges(); save();
    return true;
  }

  /* ---------- layers: notes + pen, attached to the slide / step / section under them ---------- */
  var NS = 'http://www.w3.org/2000/svg';
  var ANCH = '.slide, details, section[id]';
  function anchorId(a) { if (a === document.body) return ''; return a.id || a.getAttribute('data-an-id') || ''; }
  function anchorEl(id) { if (!id) return document.body; return document.getElementById(id) || document.querySelector('[data-an-id="' + id + '"]'); }
  function labelAnchors() {
    var i = 0; Array.prototype.forEach.call(document.querySelectorAll(ANCH), function (a) { i++; if (!a.id && !a.getAttribute('data-an-id')) a.setAttribute('data-an-id', 'an' + i); });
  }
  function layerFor(a) {
    var L = null; for (var i = 0; i < a.children.length; i++) if (a.children[i].classList && a.children[i].classList.contains('an-layer')) { L = a.children[i]; break; }
    if (L) return L;
    if (getComputedStyle(a).position === 'static') a.style.position = 'relative';
    L = el('div', 'an-layer'); var sv = document.createElementNS(NS, 'svg'); sv.setAttribute('class', 'an-svg'); L.appendChild(sv); a.appendChild(L); return L;
  }
  function svgOf(a) { return layerFor(a).querySelector('svg'); }
  function anchorAt(ev) {
    var list = document.elementsFromPoint ? document.elementsFromPoint(ev.clientX, ev.clientY) : [ev.target];
    for (var i = 0; i < list.length; i++) { var e = list[i]; if (e.matches && e.matches(ANCH) && !e.closest('.an-ui')) return e; }
    return document.body;
  }
  function pt(ev, a) { var b = a.getBoundingClientRect(); return { x: Math.round(ev.clientX - b.left), y: Math.round(ev.clientY - b.top) }; }
  function pathD(a) { return a.map(function (p, i) { return (i ? 'L' : 'M') + p[0] + ' ' + p[1]; }).join(' '); }
  function drawStroke(s) {
    var a = anchorEl(s.a); if (!a) return null; var sv = svgOf(a);
    var g = document.createElementNS(NS, 'g'); g.setAttribute('data-id', s.id);
    var h = document.createElementNS(NS, 'path'); h.setAttribute('class', 'h'); h.setAttribute('d', pathD(s.d));
    var p = document.createElementNS(NS, 'path'); p.setAttribute('class', 's'); p.setAttribute('d', pathD(s.d));
    p.setAttribute('stroke', PEN[s.c] || PEN.r); p.setAttribute('stroke-width', '3');
    g.appendChild(h); g.appendChild(p); sv.appendChild(g); return g;
  }
  function addNoteEl(n, focus) {
    var a = anchorEl(n.a); if (!a) return;
    var d = el('div', 'an-note'); d.setAttribute('data-id', n.id); d.style.left = n.x + 'px'; d.style.top = n.y + 'px';
    var hd = el('div', 'nh', '<span>Note</span>'); var x = el('button', 'nx', '&times;'); x.type = 'button'; x.setAttribute('aria-label', 'Delete this note');
    hd.appendChild(x);
    var ta = el('textarea'); ta.value = n.t || ''; ta.setAttribute('aria-label', 'Your note'); ta.placeholder = 'Write here...';
    d.appendChild(hd); d.appendChild(ta); layerFor(a).appendChild(d);
    var tm; ta.addEventListener('input', function () { n.t = ta.value; clearTimeout(tm); tm = setTimeout(save, 300); });
    x.addEventListener('click', function () { removeItem(n.id); });
    hd.addEventListener('pointerdown', function (ev) {
      if (ev.target === x) return; ev.preventDefault();
      var sx = ev.clientX, sy = ev.clientY, ox = n.x, oy = n.y; hd.setPointerCapture(ev.pointerId);
      function mv(e) { n.x = Math.max(0, ox + e.clientX - sx); n.y = Math.max(0, oy + e.clientY - sy); d.style.left = n.x + 'px'; d.style.top = n.y + 'px'; }
      function up() { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); save(); }
      hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up);
    });
    if (focus) ta.focus();
  }
  function removeItem(id) {
    if (id[0] === 'h') { S.hl = S.hl.filter(function (x) { return x.id !== id; }); unwrap(id); }
    else if (id[0] === 'n') { S.notes = S.notes.filter(function (x) { return x.id !== id; }); var d = document.querySelector('.an-note[data-id="' + id + '"]'); if (d) d.remove(); }
    else { S.strokes = S.strokes.filter(function (x) { return x.id !== id; }); var g = document.querySelector('.an-svg g[data-id="' + id + '"]'); if (g) g.remove(); }
    S.log = S.log.filter(function (x) { return x !== id; }); save();
  }

  /* ---------- interactions ---------- */
  var cur = null;
  function bindPen() {
    document.addEventListener('pointerdown', function (ev) {
      if (tool !== 'pen' || (ev.pointerType === 'mouse' && ev.button !== 0)) return;
      if (ev.target.closest && ev.target.closest('.an-ui, .an-note')) return;
      ev.preventDefault();
      var a = anchorAt(ev), p = pt(ev, a);
      cur = { id: nid('s'), c: penC, a: anchorId(a), d: [[p.x, p.y]], A: a };
      cur.g = drawStroke(cur);
    }, true);
    document.addEventListener('pointermove', function (ev) {
      if (!cur) return; var p = pt(ev, cur.A), l = cur.d[cur.d.length - 1];
      if (Math.abs(p.x - l[0]) + Math.abs(p.y - l[1]) < 2) return;
      cur.d.push([p.x, p.y]);
      var ps = cur.g.querySelectorAll('path'); ps[0].setAttribute('d', pathD(cur.d)); ps[1].setAttribute('d', pathD(cur.d));
    });
    function end() {
      if (!cur) return;
      if (cur.d.length < 2) cur.d.push([cur.d[0][0] + 1, cur.d[0][1] + 1]);
      var s = { id: cur.id, c: cur.c, a: cur.a, d: cur.d }; S.strokes.push(s); S.log.push(s.id);
      cur.g.remove(); drawStroke(s); cur = null; save();
    }
    document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  }

  var selT = null;
  document.addEventListener('selectionchange', function () {
    if (!tool || !HL[tool]) return;
    clearTimeout(selT);
    selT = setTimeout(function () { highlightSelection(tool); }, 450);
  });
  document.addEventListener('click', function (ev) {
    var t = ev.target;
    if (t.closest && t.closest('.an-ui, .an-note')) return;
    if (tool === 'erase') {
      var g = t.closest && t.closest('.an-svg g[data-id]');
      if (g) { ev.preventDefault(); ev.stopPropagation(); removeItem(g.getAttribute('data-id')); return; }
      var m = t.closest && t.closest('mark.an-hl');
      if (m) { ev.preventDefault(); ev.stopPropagation(); removeItem(m.dataset.id); }
      return;
    }
    if (tool === 'note') {
      ev.preventDefault(); ev.stopPropagation();
      var a = anchorAt(ev), p = pt(ev, a), n = { id: nid('n'), a: anchorId(a), x: Math.max(0, p.x - 20), y: Math.max(0, p.y - 10), t: '' };
      S.notes.push(n); S.log.push(n.id); addNoteEl(n, true); save();
    }
  }, true);

  /* ---------- toolbar ---------- */
  var tips = {
    y: 'Select text with your finger or mouse: it is highlighted.', g: 'Select text with your finger or mouse: it is highlighted.',
    b: 'Select text with your finger or mouse: it is highlighted.', p: 'Select text with your finger or mouse: it is highlighted.',
    pen: 'Draw on the page with your finger, pen or mouse.', note: 'Tap or click where you want to write a note.',
    erase: 'Tap a highlight, a drawing or use the cross of a note to delete it.'
  };
  function build() {
    var dock = el('div', 'an-ui'); dock.id = 'an-dock';
    var tg = el('button', null, '&#9998; Annotate'); tg.id = 'an-toggle'; tg.type = 'button'; tg.setAttribute('aria-expanded', 'false'); tg.setAttribute('aria-controls', 'an-bar');
    var bar = el('div'); bar.id = 'an-bar'; bar.hidden = true; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Annotation tools');
    var h = '<span class="lab">Highlight</span>';
    Object.keys(HL).forEach(function (k) { h += '<button type="button" class="sw" data-t="' + k + '" aria-pressed="false" aria-label="Highlight ' + HLN[k] + '" title="Highlight ' + HLN[k] + '" style="background:' + HL[k] + '"></button>'; });
    h += '<span class="sep"></span><button type="button" data-t="pen" aria-pressed="false">&#9999;&#65039; Pen</button>' +
      '<span id="an-pens" hidden>';
    Object.keys(PEN).forEach(function (k) { h += '<button type="button" class="sw" data-p="' + k + '" aria-pressed="' + (k === penC) + '" aria-label="Pen ' + PENN[k] + '" title="Pen ' + PENN[k] + '" style="background:' + PEN[k] + '"></button>'; });
    h += '</span><button type="button" data-t="note" aria-pressed="false">&#128221; Note</button>' +
      '<button type="button" data-t="erase" aria-pressed="false">&#129529; Erase</button><span class="sep"></span>' +
      '<button type="button" id="an-undo">&#8630; Undo</button><button type="button" id="an-clear">Clear all</button><button type="button" id="an-print">Print / PDF</button>' +
      '<div id="an-tip" aria-live="polite">Choose a tool. Your notes stay in this browser only.</div>';
    bar.innerHTML = h; dock.appendChild(bar); dock.appendChild(tg); document.body.appendChild(dock);

    function setTool(t) {
      tool = (tool === t) ? null : t;
      Array.prototype.forEach.call(bar.querySelectorAll('[data-t]'), function (b) { b.setAttribute('aria-pressed', String(b.dataset.t === tool)); });
      bar.querySelector('#an-pens').hidden = tool !== 'pen';
      document.documentElement.style.touchAction = tool === 'pen' ? 'none' : '';
      document.body.classList.toggle('an-pen', tool === 'pen');
      document.body.classList.toggle('an-erase', tool === 'erase');
      document.body.classList.toggle('an-note-mode', tool === 'note');
      bar.querySelector('#an-tip').textContent = tool ? tips[tool] : 'Choose a tool. Your notes stay in this browser only.';
    }
    tg.addEventListener('click', function () {
      var open = bar.hidden; bar.hidden = !open; tg.setAttribute('aria-expanded', String(open));
      tg.innerHTML = open ? '&times; Close' : '&#9998; Annotate'; if (!open) setTool(null);
    });
    bar.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.t) setTool(b.dataset.t);
      else if (b.dataset.p) { penC = b.dataset.p; Array.prototype.forEach.call(bar.querySelectorAll('[data-p]'), function (x) { x.setAttribute('aria-pressed', String(x.dataset.p === penC)); }); }
      else if (b.id === 'an-undo') { var id = S.log[S.log.length - 1]; if (id) removeItem(id); }
      else if (b.id === 'an-clear') {
        if (!S.log.length && !S.hl.length && !S.notes.length && !S.strokes.length) return;
        if (confirm('Delete all your highlights, drawings and notes on this page?')) {
          S.hl.slice().forEach(function (x) { unwrap(x.id); });
          S.hl = []; S.notes = []; S.strokes = []; S.log = [];
          Array.prototype.forEach.call(document.querySelectorAll('.an-note'), function (n) { n.remove(); }); Array.prototype.forEach.call(document.querySelectorAll('.an-svg'), function (v) { v.innerHTML = ''; }); save();
        }
      }
      else if (b.id === 'an-print') window.print();
    });
  }

  function init() {
    load(); labelAnchors();
    S.strokes.forEach(drawStroke); S.notes.forEach(function (n) { addNoteEl(n, false); });
    applyAll(); bindPen(); build();
    if (document.getElementById('deckbar')) document.getElementById('an-dock').style.bottom = '76px';
    /* solutions decrypted later by teachers: re-apply highlights that sit inside them */
    if (window.MutationObserver) {
      var t, busy = false;
      new MutationObserver(function (ml) {
        if (busy) return;
        if (!ml.some(function (m) { return Array.prototype.some.call(m.addedNodes, function (n) { return n.nodeType === 1 && !(n.matches && n.matches('.an-ui,.an-layer,mark.an-hl')) && !(n.closest && n.closest('.an-layer')); }); })) return;
        clearTimeout(t); t = setTimeout(function () { busy = true; applyAll(); setTimeout(function () { busy = false; }, 50); }, 300);
      }).observe(document.body, { childList: true, subtree: true });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
