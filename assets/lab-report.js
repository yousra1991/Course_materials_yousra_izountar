/* Lab report generator: the student fills in a few fields, adds observations and
   screenshots for each step, then prints/saves the report as PDF or downloads it as HTML.
   Everything stays in the browser (localStorage); nothing is sent anywhere.
   Created by Yousra Izountar. */
(function () {
  'use strict';
  var KEY = 'labreport1:' + location.pathname.replace(/[^\w]/g, '_');
  var LANG = (/nosql/i.test(location.pathname) && (function () { try { return localStorage.getItem('nosqllang'); } catch (e) { return ''; } })() === 'fr') ? 'fr' : 'en';
  var TXT = {
    en: { btn: 'Generate report', title: 'Lab report', intro: 'Fill in your details, add your observations and screenshots for each step, then create your report. It is saved in this browser only.',
      name: 'Full name', mat: 'Student ID', grp: 'Group', work: 'Your work, step by step', obs: 'What you did, what you observed, problems met',
      add: 'Add screenshots', paste: 'You can also paste an image (Ctrl+V) in this box.', rm: 'Remove', done: 'Completed', todo: 'Not marked as completed',
      pdf: 'Open report (print / save as PDF)', dl: 'Download report (HTML)', close: 'Close', empty: 'No step found on this page.',
      uni: 'University of Algiers 1 – Benyoucef Benkhedda', dept: 'Department of Computer Science', date: 'Date', prog: 'Progress', steps: 'steps completed',
      hl: 'My highlights', nt: 'My notes', fig: 'Figure', ans: 'My answers', st: 'Status', part: 'Part', foot: 'Report generated from the lab page. The observations and screenshots are the student’s own work.',
      pr: 'Print / save as PDF', need: 'Please enter your name and student ID first.', quota: 'Browser storage is full: this screenshot will not be kept after you close the page.' },
    fr: { btn: 'Générer le rapport', title: 'Rapport de TP', intro: 'Renseignez vos informations, ajoutez vos observations et captures d’écran pour chaque étape, puis créez votre rapport. Il est enregistré uniquement dans ce navigateur.',
      name: 'Nom et prénom', mat: 'Matricule', grp: 'Groupe', work: 'Votre travail, étape par étape', obs: 'Ce que vous avez fait, observé, problèmes rencontrés',
      add: 'Ajouter des captures', paste: 'Vous pouvez aussi coller une image (Ctrl+V) dans ce cadre.', rm: 'Supprimer', done: 'Terminée', todo: 'Non marquée comme terminée',
      pdf: 'Ouvrir le rapport (imprimer / PDF)', dl: 'Télécharger le rapport (HTML)', close: 'Fermer', empty: 'Aucune étape trouvée sur cette page.',
      uni: 'Université d’Alger 1 – Benyoucef Benkhedda', dept: 'Département d’Informatique', date: 'Date', prog: 'Avancement', steps: 'étapes terminées',
      hl: 'Mes surlignages', nt: 'Mes notes', fig: 'Figure', ans: 'Mes réponses', st: 'Statut', part: 'Partie', foot: 'Rapport généré depuis la page du TP. Les observations et captures sont le travail personnel de l’étudiant.',
      pr: 'Imprimer / enregistrer en PDF', need: 'Saisissez d’abord votre nom et votre matricule.', quota: 'Le stockage du navigateur est plein : cette capture ne sera pas conservée après fermeture.' }
  }[LANG];
  var R = { name: '', mat: '', grp: '', obs: {}, img: {} };
  try { var r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r) R = Object.assign(R, r); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(R)); return true; } catch (e) { return false; } }
  function esc(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  /* ---------- read the lab page ---------- */
  function clean(node) { var c = node.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll('.tm,.bd,.an-layer'), function (x) { x.remove(); }); return c.textContent.replace(/\s+/g, ' ').trim(); }
  function steps() {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('details.qs'), function (d, i) {
      if (!d.querySelector('.act button')) return; /* help-guide blocks are not steps */
      var sec = d.closest('section'); var h = sec && sec.querySelector('h2');
      var sm = d.querySelector('summary');
      var done = !!d.querySelector('.bd .ok') || !!d.querySelector('.act button.on');
      out.push({ id: d.id || ('step' + i), el: d, title: sm ? clean(sm) : ('Step ' + (i + 1)), part: h ? clean(h) : '', done: done });
    });
    return out;
  }
  function answersHTML(d) {
    var tabs = d.querySelectorAll('table.aud, table');
    var html = '';
    Array.prototype.forEach.call(tabs, function (t) {
      if (!t.querySelector('textarea,select,input')) return;
      var c = t.cloneNode(true);
      var src = t.querySelectorAll('textarea,select,input'), dst = c.querySelectorAll('textarea,select,input');
      Array.prototype.forEach.call(dst, function (x, i) {
        var v = src[i].value; if (src[i].tagName === 'SELECT' && !src[i].selectedIndex) v = '';
        var s = document.createElement('span'); s.textContent = v; x.parentNode.replaceChild(s, x);
      });
      var kept = 0;
      Array.prototype.forEach.call(c.querySelectorAll('tr'), function (tr) {
        var sp = tr.querySelectorAll('span'); if (!sp.length) return;
        var any = Array.prototype.some.call(sp, function (x) { return x.textContent.trim(); });
        if (any) kept++; else tr.remove();
      });
      if (kept) html += '<table class="ans">' + c.innerHTML + '</table>';
    });
    return html;
  }
  function marks(d) {
    var seen = {}, a = [];
    Array.prototype.forEach.call(d.querySelectorAll('mark.an-hl'), function (m) { var id = m.getAttribute('data-id'); seen[id] = (seen[id] || '') + m.textContent; });
    Object.keys(seen).forEach(function (k) { a.push(seen[k].replace(/\s+/g, ' ').trim()); }); return a;
  }
  function notes(d) { return Array.prototype.map.call(d.querySelectorAll('.an-note textarea'), function (t) { return t.value.trim(); }).filter(Boolean); }

  /* ---------- report html ---------- */
  function today() { var n = new Date(); return ('0' + n.getDate()).slice(-2) + '/' + ('0' + (n.getMonth() + 1)).slice(-2) + '/' + n.getFullYear(); }
  function reportHTML() {
    var S = steps(), nd = S.filter(function (s) { return s.done; }).length, fig = 0;
    var title = (document.title || TXT.title).replace(/\s+/g, ' ');
    var css = '@page{size:A4;margin:12mm}*{box-sizing:border-box}body{font:13px/1.5 "Segoe UI",Arial,sans-serif;color:#1f2937;max-width:820px;margin:0 auto;padding:16px}' +
      '.h{background:linear-gradient(135deg,#1e40af,#2563eb);color:#fff;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;gap:12px;font-size:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      'h1{font-size:18px;color:#1d4ed8;margin:14px 0 6px;text-align:center}h2{font-size:15px;color:#1d4ed8;border-bottom:2px solid #bfdbfe;padding-bottom:3px;margin:20px 0 8px}h3{font-size:13.5px;margin:12px 0 4px}' +
      '.id{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:8px 0}.id div{border:1px solid #cbd5e1;border-radius:6px;padding:5px 8px}.id b{display:block;font-size:10px;color:#64748b;text-transform:uppercase}' +
      '.st{display:inline-block;border-radius:999px;padding:1px 9px;font-size:11px;font-weight:700}.ok{background:#dcfce7;color:#15803d}.no{background:#fef3c7;color:#92400e}' +
      '.step{border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px;margin:8px 0;break-inside:avoid-page}.obs{white-space:pre-wrap;margin:4px 0}' +
      'figure{margin:8px 0;break-inside:avoid}figure img{max-width:100%;border:1px solid #cbd5e1;border-radius:4px}figcaption{font-size:11px;color:#475569}' +
      'table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #cbd5e1;padding:4px 6px;vertical-align:top;font-size:12px}th{background:#eff6ff}.ans span{white-space:pre-wrap}' +
      '.hl{background:#fde047;padding:0 2px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.nt{background:#fef9c3;border-left:3px solid #ca8a04;padding:3px 8px;margin:3px 0}' +
      '.ft{margin-top:22px;font-size:11px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:6px}.pb{position:fixed;right:12px;top:12px;background:#1d4ed8;color:#fff;border:0;border-radius:8px;padding:9px 14px;font-weight:700;cursor:pointer}@media print{.pb{display:none}}';
    var h = '<!DOCTYPE html><html lang="' + LANG + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(TXT.title + ' - ' + title) + '</title><style>' + css + '</style></head><body>';
    h += '<button class="pb" onclick="window.print()">' + esc(TXT.pr) + '</button>';
    h += '<div class="h"><div><b>' + esc(TXT.uni) + '</b><br>' + esc(TXT.dept) + '</div><div style="text-align:right"><b>' + esc(title) + '</b><br>' + esc(TXT.date) + ': ' + today() + '</div></div>';
    h += '<h1>' + esc(TXT.title) + '</h1><div class="id"><div style="grid-column:span 2"><b>' + esc(TXT.name) + '</b>' + esc(R.name) + '</div><div><b>' + esc(TXT.mat) + '</b>' + esc(R.mat) + '</div><div><b>' + esc(TXT.grp) + '</b>' + esc(R.grp) + '</div></div>';
    h += '<p><b>' + esc(TXT.prog) + ':</b> ' + nd + ' / ' + S.length + ' ' + esc(TXT.steps) + '</p>';
    var part = null;
    S.forEach(function (s) {
      if (s.part !== part) { part = s.part; h += '<h2>' + esc(part) + '</h2>'; }
      h += '<div class="step"><h3>' + esc(s.title) + ' <span class="st ' + (s.done ? 'ok' : 'no') + '">' + esc(s.done ? TXT.done : TXT.todo) + '</span></h3>';
      var o = (R.obs[s.id] || '').trim(); if (o) h += '<div class="obs">' + esc(o) + '</div>';
      var a = answersHTML(s.el); if (a) h += '<h3>' + esc(TXT.ans) + '</h3>' + a;
      (R.img[s.id] || []).forEach(function (src) { fig++; h += '<figure><img alt="' + esc(TXT.fig + ' ' + fig) + '" src="' + src + '"><figcaption>' + esc(TXT.fig) + ' ' + fig + '</figcaption></figure>'; });
      var m = marks(s.el); if (m.length) h += '<h3>' + esc(TXT.hl) + '</h3>' + m.map(function (x) { return '<div><span class="hl">' + esc(x) + '</span></div>'; }).join('');
      var n = notes(s.el); if (n.length) h += '<h3>' + esc(TXT.nt) + '</h3>' + n.map(function (x) { return '<div class="nt">' + esc(x) + '</div>'; }).join('');
      h += '</div>';
    });
    h += '<div class="ft">' + esc(TXT.foot) + '</div></body></html>';
    return h;
  }

  /* ---------- images ---------- */
  function shrink(file, cb) {
    var fr = new FileReader();
    fr.onload = function () {
      var im = new Image();
      im.onload = function () {
        var m = 1000, k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
        cb(c.toDataURL('image/jpeg', 0.62));
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  }

  /* ---------- modal ---------- */
  var css = '' +
    '#lr-btn{position:fixed;left:12px;bottom:12px;z-index:9998;background:#0f766e;color:#fff;border:0;border-radius:999px;padding:11px 18px;font:700 14px "Segoe UI",Arial,sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3)}' +
    '#lr-btn:focus-visible,#lr-modal button:focus-visible{outline:3px solid #f59e0b;outline-offset:2px}' +
    '#lr-modal{position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.6);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:16px}' +
    '#lr-modal[hidden]{display:none}#lr-modal *{box-sizing:border-box;font-family:"Segoe UI",Arial,sans-serif}' +
    '#lr-box{background:#fff;color:#1f2937;border-radius:12px;max-width:760px;width:100%;padding:16px 18px;box-shadow:0 10px 40px rgba(0,0,0,.4)}' +
    '#lr-box h2{margin:0 0 4px;color:#0f766e;font-size:20px}#lr-box p{margin:4px 0 10px;font-size:13px;color:#475569}' +
    '#lr-box label{display:block;font-size:12px;font-weight:700;color:#334155;margin:6px 0 2px}' +
    '#lr-box input[type=text],#lr-box textarea{width:100%;border:1.5px solid #94a3b8;border-radius:8px;padding:8px;font-size:14px;color:#111827;background:#fff}' +
    '#lr-box textarea{min-height:64px;resize:vertical}.lr-id{display:grid;grid-template-columns:2fr 1fr 1fr;gap:8px}@media(max-width:560px){.lr-id{grid-template-columns:1fr}}' +
    '.lr-step{border:1.5px solid #cbd5e1;border-radius:10px;padding:8px 10px;margin:8px 0}.lr-step h3{margin:0;font-size:14px;color:#0f172a}.lr-step small{color:#64748b}' +
    '.lr-pt{margin:12px 0 2px;font-size:12px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:.03em}' +
    '.lr-st{font-size:11px;font-weight:700;border-radius:999px;padding:1px 8px;margin-left:6px}.lr-st.ok{background:#dcfce7;color:#15803d}.lr-st.no{background:#fef3c7;color:#92400e}' +
    '.lr-th{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.lr-th div{position:relative}.lr-th img{height:70px;border:1px solid #94a3b8;border-radius:4px;display:block}.lr-th button{position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:0;background:#b91c1c;color:#fff;cursor:pointer;line-height:1}' +
    '.lr-bt{border:1.5px solid #94a3b8;background:#f1f5f9;border-radius:8px;padding:7px 12px;font-size:13px;cursor:pointer;color:#0f172a}.lr-bt.p{background:#0f766e;border-color:#0f766e;color:#fff;font-weight:700}' +
    '.lr-act{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;position:sticky;bottom:0;background:#fff;padding:8px 0}#lr-msg{color:#b91c1c;font-size:13px;margin-top:6px;width:100%}' +
    '@media print{#lr-btn,#lr-modal{display:none!important}}';
  var modal, listEl;

  function thumbs(box, id) {
    box.innerHTML = '';
    (R.img[id] || []).forEach(function (src, i) {
      var w = el('div'); var im = new Image(); im.src = src; im.alt = 'Screenshot ' + (i + 1);
      var b = el('button', null, '&times;'); b.type = 'button'; b.setAttribute('aria-label', TXT.rm);
      b.onclick = function () { R.img[id].splice(i, 1); save(); thumbs(box, id); };
      w.appendChild(im); w.appendChild(b); box.appendChild(w);
    });
  }
  function addFiles(files, id, box) {
    Array.prototype.forEach.call(files, function (f) {
      if (!/^image\//.test(f.type)) return;
      shrink(f, function (data) {
        (R.img[id] = R.img[id] || []).push(data);
        if (!save()) { document.getElementById('lr-msg').textContent = TXT.quota; }
        thumbs(box, id);
      });
    });
  }
  function fill() {
    listEl.innerHTML = '';
    var S = steps(), part = null;
    if (!S.length) { listEl.appendChild(el('p', null, esc(TXT.empty))); return; }
    S.forEach(function (s, n) {
      if (s.part !== part) { part = s.part; listEl.appendChild(el('div', 'lr-pt', esc(part))); }
      var d = el('div', 'lr-step');
      d.appendChild(el('h3', null, esc(s.title) + '<span class="lr-st ' + (s.done ? 'ok' : 'no') + '">' + esc(s.done ? TXT.done : TXT.todo) + '</span>'));
      var tid = 'lr-o' + n;
      var lab = el('label', null, esc(TXT.obs)); lab.setAttribute('for', tid);
      var ta = el('textarea'); ta.id = tid; ta.value = R.obs[s.id] || '';
      ta.addEventListener('input', function () { R.obs[s.id] = ta.value; save(); });
      var th = el('div', 'lr-th');
      var inp = el('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true; inp.style.display = 'none';
      var add = el('button', 'lr-bt', '&#128247; ' + esc(TXT.add)); add.type = 'button'; add.onclick = function () { inp.click(); };
      inp.onchange = function () { addFiles(inp.files, s.id, th); inp.value = ''; };
      d.addEventListener('paste', function (e) { var f = e.clipboardData && e.clipboardData.files; if (f && f.length) { e.preventDefault(); addFiles(f, s.id, th); } });
      d.appendChild(lab); d.appendChild(ta);
      var row = el('div'); row.style.marginTop = '6px'; row.appendChild(add); row.appendChild(inp); row.appendChild(el('small', null, ' ' + esc(TXT.paste)));
      d.appendChild(row); d.appendChild(th); listEl.appendChild(d); thumbs(th, s.id);
    });
  }
  function ident() {
    var ok = R.name.trim() && R.mat.trim();
    if (!ok) { var m = document.getElementById('lr-msg'); m.textContent = TXT.need; document.getElementById('lr-name').focus(); }
    return !!ok;
  }
  function build() {
    var st = el('style'); st.textContent = css; document.head.appendChild(st);
    var btn = el('button', null, '&#128196; ' + esc(TXT.btn)); btn.id = 'lr-btn'; btn.type = 'button'; btn.setAttribute('aria-haspopup', 'dialog'); document.body.appendChild(btn);
    modal = el('div'); modal.id = 'lr-modal'; modal.hidden = true; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-labelledby', 'lr-t');
    modal.innerHTML = '<div id="lr-box"><h2 id="lr-t">' + esc(TXT.title) + '</h2><p>' + esc(TXT.intro) + '</p>' +
      '<div class="lr-id"><div><label for="lr-name">' + esc(TXT.name) + '</label><input type="text" id="lr-name" autocomplete="name"></div>' +
      '<div><label for="lr-mat">' + esc(TXT.mat) + '</label><input type="text" id="lr-mat" inputmode="numeric"></div>' +
      '<div><label for="lr-grp">' + esc(TXT.grp) + '</label><input type="text" id="lr-grp"></div></div>' +
      '<div class="lr-pt" style="margin-top:14px">' + esc(TXT.work) + '</div><div id="lr-list"></div>' +
      '<div class="lr-act"><button type="button" class="lr-bt p" id="lr-pdf">' + esc(TXT.pdf) + '</button><button type="button" class="lr-bt" id="lr-dl">' + esc(TXT.dl) + '</button><button type="button" class="lr-bt" id="lr-x">' + esc(TXT.close) + '</button><div id="lr-msg" role="alert"></div></div></div>';
    document.body.appendChild(modal); listEl = modal.querySelector('#lr-list');
    ['name', 'mat', 'grp'].forEach(function (k) { var i = modal.querySelector('#lr-' + (k === 'name' ? 'name' : k)); i.value = R[k] || ''; i.addEventListener('input', function () { R[k] = i.value; save(); }); });
    function open() { fill(); modal.hidden = false; document.getElementById('lr-msg').textContent = ''; document.getElementById('lr-name').focus(); document.body.style.overflow = 'hidden'; }
    function close() { modal.hidden = true; document.body.style.overflow = ''; btn.focus(); }
    btn.onclick = open; modal.querySelector('#lr-x').onclick = close;
    modal.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    modal.addEventListener('mousedown', function (e) { if (e.target === modal) close(); });
    modal.querySelector('#lr-pdf').onclick = function () {
      if (!ident()) return;
      var w = window.open('', '_blank');
      if (!w) { document.getElementById('lr-msg').textContent = 'Pop-ups are blocked: allow pop-ups, or use the download button.'; return; }
      w.document.open(); w.document.write(reportHTML()); w.document.close();
    };
    modal.querySelector('#lr-dl').onclick = function () {
      if (!ident()) return;
      var b = new Blob([reportHTML()], { type: 'text/html' }), a = document.createElement('a');
      var slug = (document.title.match(/(?:Lab|TP)\s*[\d.]+/i) || ['lab'])[0].replace(/\s+/g, '').toLowerCase();
      a.href = URL.createObjectURL(b); a.download = 'report-' + slug + '-' + (R.mat || 'student').replace(/[^\w-]/g, '') + '.html';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
