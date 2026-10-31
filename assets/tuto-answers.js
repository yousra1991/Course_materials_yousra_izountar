/* Answer fields for the tutorials: students type their answers directly in the empty
   cells of the tables and in a box under each question. Saved in the browser only.
   Created by Yousra Izountar. */
(function () {
  'use strict';
  var KEY = 'tutans1:' + location.pathname.replace(/[^\w]/g, '_');
  var A = {};
  try { A = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
  var tm;
  function save() { clearTimeout(tm); tm = setTimeout(function () { try { localStorage.setItem(KEY, JSON.stringify(A)); } catch (e) {} }, 250); }
  function grow(t) { t.style.height = 'auto'; if (t.scrollHeight) t.style.height = (t.scrollHeight + 2) + 'px'; }
  function inSolution(n) { return !!(n.closest && n.closest('.locked, .sol, .solution, [data-sol]')); }

  var css = '' +
    '.ta-ans{display:block;width:100%;border:0;background:transparent;resize:none;overflow:hidden;font:inherit;color:#1e3a8a;padding:3px 4px;margin:0;min-height:30px;line-height:1.4}' +
    'td.blank .ta-ans:focus,.ta-box .ta-ans:focus{outline:2px solid #2563eb;outline-offset:-2px;background:#eff6ff}' +
    '.ta-box{margin:4px 0 12px}.ta-box label{display:block;font-size:11px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.03em;margin-bottom:2px}' +
    '.ta-box .ta-ans{border:1.5px solid #93c5fd;border-radius:8px;background:#fff;min-height:64px;padding:8px 10px;font-size:14px}' +
    '.ta-note{background:#ecfdf5;border:1px solid #6ee7b7;border-radius:8px;padding:7px 12px;margin:0 0 12px;font-size:13px;color:#065f46}' +
    '@media print{.ta-ans{overflow:visible;border:0;resize:none}.ta-box .ta-ans{border:1px solid #94a3b8}.ta-note{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function mk(id, label) {
    var t = document.createElement('textarea'); t.className = 'ta-ans'; t.rows = 1; t.value = A[id] || '';
    t.setAttribute('aria-label', label); t.spellcheck = false;
    t.addEventListener('input', function () { A[id] = t.value; if (!t.value) delete A[id]; grow(t); save(); });
    return t;
  }

  function init() {
    var all = [];
    /* 1. empty table cells */
    Array.prototype.forEach.call(document.querySelectorAll('td.blank'), function (td, i) {
      if (inSolution(td)) return;
      var row = td.parentNode, col = Array.prototype.indexOf.call(row.children, td) + 1;
      var t = mk('b' + i, 'Your answer, row ' + (row.rowIndex + 1) + ', column ' + col);
      td.appendChild(t); all.push(t);
    });
    /* 1b. tables without the 'blank' class (Tuto 2): empty cells become fillable, "[ ] Yes [ ] No" becomes real choices */
    var ei = 0;
    Array.prototype.forEach.call(document.querySelectorAll('table.t'), function (tb) {
      if (inSolution(tb) || tb.querySelector('td.blank')) return;
      Array.prototype.forEach.call(tb.querySelectorAll('td'), function (td) {
        if (td.querySelector('textarea,input')) return;
        var txt = td.textContent.replace(/\u00a0/g, ' ').trim(), i = ei++;
        if (!txt && !td.children.length) {
          var t = mk('e' + i, 'Your answer'); td.appendChild(t); all.push(t);
        } else if (/\u2610\s*Yes\s*\u2610\s*No/.test(txt)) {
          var name = 'yn' + i; td.innerHTML = '';
          ['Yes', 'No'].forEach(function (v) {
            var l = document.createElement('label'); l.style.cssText = 'margin-right:8px;white-space:nowrap;cursor:pointer';
            var r = document.createElement('input'); r.type = 'radio'; r.name = name; r.value = v; r.checked = A[name] === v;
            r.addEventListener('change', function () { A[name] = v; save(); });
            l.appendChild(r); l.appendChild(document.createTextNode(' ' + v)); td.appendChild(l);
          });
        }
      });
    });
    /* 2. a box under each question that has no table to fill in */
    Array.prototype.forEach.call(document.querySelectorAll('.q'), function (q, i) {
      if (inSolution(q)) return;
      var n = q.nextElementSibling, hasTable = false;
      while (n && !n.matches('.q, .locked, .sit, h2, h3')) {
        if (n.querySelector && (n.querySelector('td.blank') || n.matches('table'))) { hasTable = true; break; }
        if (n.matches('p') && /Solution/i.test(n.textContent)) break;
        n = n.nextElementSibling;
      }
      if (hasTable) return;
      var lab = (q.querySelector('.n') || {}).textContent || ('Q' + (i + 1));
      var box = document.createElement('div'); box.className = 'ta-box';
      var id = 'q' + i, l = document.createElement('label'); l.textContent = 'Your answer to ' + lab.replace(/\.$/, ''); l.setAttribute('for', 'ta-' + id);
      var t = mk(id, l.textContent); t.id = 'ta-' + id;
      box.appendChild(l); box.appendChild(t); q.parentNode.insertBefore(box, q.nextSibling); all.push(t);
    });
    if (!all.length) return;
    /* 3. one-line hint under the title */
    var tb = document.querySelector('.title-block');
    if (tb) {
      var note = document.createElement('div'); note.className = 'ta-note';
      note.innerHTML = '&#9997;&#65039; <b>Write your answers here.</b> Type in the empty cells and answer boxes. They are saved in this browser only. To keep a copy, use <b>Annotate &rarr; Print / PDF</b>.';
      tb.parentNode.insertBefore(note, tb.nextSibling);
    }
    all.forEach(grow);
    window.addEventListener('resize', function () { all.forEach(grow); });
    window.addEventListener('beforeprint', function () { all.forEach(grow); });
    document.addEventListener('toggle', function () { all.forEach(grow); }, true);
    window.addEventListener('load', function () { all.forEach(grow); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
