/**
 * Online exam - server
 * Izountar Yousra - Universite Alger 1
 *
 * Bound to the Google Sheet "HCI Exam".
 * Published as a web app: Deploy > New deployment > Web app,
 * execute as me, access: anyone.
 *
 * Question types: single (one answer), multi (several answers), open (written answer).
 * Open answers are read by an analyser that says complete, partial or wrong.
 * The correct answers and the expected elements never leave this file.
 */

var TEACHER_KEY = 'CHANGE-THIS-KEY';   // the key you type in the dashboard
var MAX_WARNINGS = 3;                  // after this number of events the copy is sent
var SH = { S: 'Settings', Q: 'Questions', ST: 'Students', A: 'Answers', E: 'Events' };

var Q_COLS  = ['Id','Theme','Type','Question','Code','A','B','C','D','E','Correct','Expect','Points'];
var ST_COLS = ['Time','Name','Matricule','Group','Token','Status','StartedAt','EndsAt',
               'SubmittedAt','Score','ScoreOutOf','Warnings','Copy'];
var A_COLS  = ['Time','Matricule','QuestionId','Answer','Verdict','Mark','Detail'];
var E_COLS  = ['Time','Name','Matricule','Group','Event'];

var DEFAULTS = [
  ['Module','HCI','Name of the module'],
  ['ExamName','Test 1','Which exam (test 1, exam, catch-up...)'],
  ['Title','HCI - Test 1','Title shown to the students'],
  ['UseCaseTitle','','Optional case study, read in the waiting room'],
  ['UseCaseText','','The text of the case study (leave empty if there is none)'],
  ['DurationMin',40,'Minutes for each student'],
  ['Groups','G1,G2,G3','Groups a student can choose'],
  ['Shuffle','yes','yes = a different order of questions for each student'],
  ['ScoreOutOf',15,'The final mark is brought back to this (0 = keep the raw points)'],
  ['SameMark','yes','yes = every question is worth MarkPerQuestion'],
  ['MarkPerQuestion',1,'Points of one question when SameMark is yes'],
  ['PartialMulti','yes','yes = partial points when several answers are expected'],
  ['OpenComplete',0.85,'From this share of the expected elements: complete'],
  ['OpenPartial',0.40,'From this share: partial. Below: wrong'],
  ['OpenIgnoreCase','no','yes = the analyser ignores upper and lower case in code'],
  ['Status','closed','closed, waiting, running, finished (the dashboard changes it)'],
  ['TotalPoints',0,'Filled by the server'],
  ['FolderId','','Drive folder of the copies, made by the server'],
  ['FolderUrl','','Link to that folder']
];

/* ------------------------------------------------------------------ */
/* entry points                                                        */
/* ------------------------------------------------------------------ */

function doGet(e) { return json({ ok: true, service: 'exam', time: Date.now() }); }

function doPost(e) {
  var out;
  try { out = route(JSON.parse(e.postData.contents || '{}')); }
  catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return json(out);
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function route(b) {
  var a = String(b.action || '');
  if (a === 'join')      return sJoin(b);
  if (a === 'poll')      return sPoll(b);
  if (a === 'questions') return sQuestions(b);
  if (a === 'answer')    return sAnswer(b);
  if (a === 'event')     return sEvent(b);
  if (a === 'submit')    return sSubmit(b);
  if (a.charAt(0) === 't') {
    /* the key shipped with the code is public: it must be changed before any exam */
    if (TEACHER_KEY.replace(/\s/g, '').toUpperCase() === 'CHANGE-THIS-KEY') {
      return { ok: false, error: 'Set your own TEACHER_KEY at the top of Code.gs, then deploy a new version.' };
    }
    if (String(b.key || '').replace(/\s/g, '').toUpperCase() !==
        TEACHER_KEY.replace(/\s/g, '').toUpperCase()) return { ok: false, error: 'Wrong teacher key' };
    if (a === 'tstate')    return tState(b);
    if (a === 'tapprove')  return tApprove(b);
    if (a === 'treject')   return tReject(b);
    if (a === 'tstart')    return tStart(b);
    if (a === 'tstop')     return tStop(b);
    if (a === 'tminutes')  return tMinutes(b);
    if (a === 'tconfig')   return tConfig(b);
    if (a === 'treset')    return tReset(b);
    if (a === 'timport')   return tImport(b);
    if (a === 'tquestions')return tQuestions(b);
    if (a === 'tbank')     return tBank(b);
    if (a === 'topen')     return tOpen(b);
    if (a === 'tgrade')    return tGrade(b);
    if (a === 'tpdf')      return tPdfAll(b);
  }
  return { ok: false, error: 'Unknown action: ' + a };
}

/* ------------------------------------------------------------------ */
/* sheet helpers                                                       */
/* ------------------------------------------------------------------ */

function ss() { return SpreadsheetApp.getActive(); }
function sheet(n) { return ss().getSheetByName(n) || ss().insertSheet(n); }

function rows(name) {
  var s = sheet(name), last = s.getLastRow();
  if (last < 2) return [];
  var v = s.getRange(1, 1, last, s.getLastColumn()).getValues();
  var head = v[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var o = { _row: i + 1 }, any = false;
    head.forEach(function (h, c) { if (h) { o[h] = v[i][c]; if (String(v[i][c]).length) any = true; } });
    if (any) out.push(o);
  }
  return out;
}

function colIndex(name, header) {
  var s = sheet(name), n = s.getLastColumn();
  if (!n) return 0;
  var h = s.getRange(1, 1, 1, n).getValues()[0];
  for (var i = 0; i < h.length; i++) if (String(h[i]).trim() === header) return i + 1;
  return 0;
}

function setCell(name, row, header, value) {
  var c = colIndex(name, header);
  if (c) sheet(name).getRange(row, c).setValue(value);
}

function cfg() {
  var s = sheet(SH.S), last = s.getLastRow();
  var o = {}, v = last ? s.getRange(1, 1, last, 2).getValues() : [];
  for (var i = 1; i < v.length; i++) { var k = String(v[i][0]).trim(); if (k) o[k] = v[i][1]; }
  return o;
}

function setCfg(key, value) {
  var s = sheet(SH.S), last = s.getLastRow();
  var v = last ? s.getRange(1, 1, last, 1).getValues() : [];
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === key) { s.getRange(i + 1, 2).setValue(value); return; }
  }
  s.appendRow([key, value]);
}

function num(v, d) { var n = Number(v); return isNaN(n) ? d : n; }
function yes(v) { return String(v).trim().toLowerCase() === 'yes'; }
function now() { return Date.now(); }
function lock(fn) {
  var l = LockService.getScriptLock(); l.waitLock(25000);
  try { return fn(); } finally { l.releaseLock(); }
}

/* ------------------------------------------------------------------ */
/* questions                                                           */
/* ------------------------------------------------------------------ */

function bank() {
  var c = cfg(), same = yes(c.SameMark), per = num(c.MarkPerQuestion, 1);
  return rows(SH.Q).filter(function (q) { return String(q.Id || '').trim(); }).map(function (q) {
    var type = String(q.Type || 'single').trim().toLowerCase();
    if (type !== 'multi' && type !== 'open') type = 'single';
    return {
      row: q._row,
      id: String(q.Id).trim(),
      theme: String(q.Theme || ''),
      type: type,
      text: String(q.Question || ''),
      code: String(q.Code || ''),
      choices: ['A','B','C','D','E'].filter(function (L) { return String(q[L] || '').trim() !== ''; })
                 .map(function (L) { return { k: L, t: String(q[L]) }; }),
      correct: String(q.Correct || '').toUpperCase().replace(/[^A-E]/g, '').split(''),
      expect: String(q.Expect || ''),
      points: same ? per : num(q.Points, 1)
    };
  });
}

function publicExam() {
  var c = cfg();
  return {
    title: String(c.Title || 'Exam'),
    module: String(c.Module || ''),
    examName: String(c.ExamName || ''),
    status: String(c.Status || 'closed'),
    duration: num(c.DurationMin, 30),
    scoreOutOf: num(c.ScoreOutOf, 0),
    useCaseTitle: String(c.UseCaseTitle || ''),
    useCaseText: String(c.UseCaseText || ''),
    groups: String(c.Groups || 'G1').split(',').map(function (g) { return g.trim(); }).filter(String)
  };
}

/* ------------------------------------------------------------------ */
/* student                                                             */
/* ------------------------------------------------------------------ */

function student(token) {
  if (!token) return null;
  var all = rows(SH.ST);
  for (var i = 0; i < all.length; i++) if (String(all[i].Token) === String(token)) return all[i];
  return null;
}

function sJoin(b) {
  var name = String(b.name || '').trim(), mat = String(b.matricule || '').trim(),
      grp = String(b.group || '').trim();
  if (!name || !mat || !grp) return { ok: false, error: 'Name, matricule and group are required' };
  var ex = publicExam();
  if (ex.status === 'closed') return { ok: false, error: 'The exam is not open yet' };
  return lock(function () {
    var all = rows(SH.ST);
    for (var i = 0; i < all.length; i++) {
      if (String(all[i].Matricule).trim() === mat) {
        if (String(all[i].Status) === 'rejected') return { ok: false, error: 'Access refused' };
        return { ok: true, token: String(all[i].Token), exam: ex };
      }
    }
    var token = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    sheet(SH.ST).appendRow([new Date(), name, mat, grp, token, 'waiting', '', '', '', '', '', 0, '']);
    return { ok: true, token: token, exam: ex };
  });
}

function sPoll(b) {
  var st = student(b.token);
  if (!st) return { ok: false, error: 'Unknown student' };
  var ends = st.EndsAt ? Number(st.EndsAt) : 0;
  if (String(st.Status) === 'running' && ends && now() > ends) {
    finish(st, 'time over'); st = student(b.token);
  }
  return {
    ok: true, status: String(st.Status), warnings: num(st.Warnings, 0), maxWarnings: MAX_WARNINGS,
    exam: publicExam(), endsAt: ends, serverTime: now(),
    score: st.Score === '' ? null : Number(st.Score),
    outOf: st.ScoreOutOf === '' ? null : Number(st.ScoreOutOf)
  };
}

function sQuestions(b) {
  var st = student(b.token);
  if (!st) return { ok: false, error: 'Unknown student' };
  if (String(st.Status) !== 'running') return { ok: false, error: 'The exam has not started' };
  var qs = bank().map(function (q) {
    return { id: q.id, theme: q.theme, type: q.type, text: q.text, code: q.code,
             points: q.points, multi: q.type === 'multi', choices: q.choices };
  });
  if (yes(cfg().Shuffle)) qs = shuffle(qs, String(st.Matricule));
  var saved = {};
  rows(SH.A).forEach(function (r) {
    if (String(r.Matricule) === String(st.Matricule)) saved[String(r.QuestionId)] = String(r.Answer);
  });
  return { ok: true, questions: qs, saved: saved };
}

function shuffle(arr, seed) {
  var s = 0, i;
  for (i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) % 100000;
  var a = arr.slice();
  for (i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    var j = s % (i + 1), t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function sAnswer(b) {
  var st = student(b.token);
  if (!st || String(st.Status) !== 'running') return { ok: false, error: 'Not running' };
  return lock(function () {
    var s = sheet(SH.A), last = s.getLastRow();
    var v = last > 1 ? s.getRange(2, 2, last - 1, 2).getValues() : [];
    for (var i = 0; i < v.length; i++) {
      if (String(v[i][0]) === String(st.Matricule) && String(v[i][1]) === String(b.qid)) {
        s.getRange(i + 2, 1).setValue(new Date());
        s.getRange(i + 2, 4).setValue(String(b.answer));
        return { ok: true };
      }
    }
    s.appendRow([new Date(), st.Matricule, String(b.qid), String(b.answer), '', '', '']);
    return { ok: true };
  });
}

function sEvent(b) {
  var st = student(b.token);
  if (!st) return { ok: false, error: 'Unknown student' };
  var type = String(b.type || 'unknown');
  sheet(SH.E).appendRow([new Date(), st.Name, st.Matricule, st.Group, type]);
  var counted = ['exit-fullscreen','tab-hidden','window-blur','copy','paste','cut',
                 'contextmenu','devtools','print'];
  if (counted.indexOf(type) < 0) return { ok: true, warnings: num(st.Warnings, 0) };
  var w = num(st.Warnings, 0) + 1;
  setCell(SH.ST, st._row, 'Warnings', w);
  if (w >= MAX_WARNINGS && String(st.Status) === 'running') {
    finish(student(b.token), 'too many warnings');
    return { ok: true, warnings: w, forceSubmit: true };
  }
  return { ok: true, warnings: w, maxWarnings: MAX_WARNINGS };
}

function sSubmit(b) {
  var st = student(b.token);
  if (!st) return { ok: false, error: 'Unknown student' };
  if (String(st.Status) === 'submitted') {
    return { ok: true, already: true, score: num(st.Score, 0), outOf: num(st.ScoreOutOf, 0) };
  }
  if (b.answers) for (var qid in b.answers) sAnswer({ token: b.token, qid: qid, answer: b.answers[qid] });
  var r = finish(student(b.token), 'sent by the student');
  return { ok: true, score: r.score, outOf: r.outOf };
}

/* ------------------------------------------------------------------ */
/* the analyser for written answers                                    */
/* ------------------------------------------------------------------ */

/**
 * Expect is a list separated by |. One element can be:
 *   JFrame                  a piece of Java code, spaces are free
 *   setTitle("*")           * stands for anything
 *   addActionListener:2     counts double
 *   ~feedback               plain words, upper and lower case ignored
 *   !System.exit            must NOT be there (takes points away)
 * Everything after # in an element is a comment for you.
 */
function analyse(answer, expect, c) {
  var txt = String(answer || '');
  var code = txt.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
                .replace(/\s+/g, '').trim();   /* spaces removed: setSize(600, 400) = setSize(600,400) */
  var plain = txt.toLowerCase().replace(/\s+/g, ' ');
  var ic = yes(c.OpenIgnoreCase);
  var items = String(expect || '').split('|').map(function (s) { return s.trim(); }).filter(String);
  var total = 0, got = 0, found = [], missing = [], banned = [];

  items.forEach(function (raw) {
    var it = raw.replace(/#.*$/, '').trim();
    if (!it) return;
    var neg = it.charAt(0) === '!'; if (neg) it = it.slice(1).trim();
    var loose = it.charAt(0) === '~'; if (loose) it = it.slice(1).trim();
    var w = 1, m = it.match(/:(\d+(?:\.\d+)?)\s*$/);
    if (m) { w = Number(m[1]); it = it.slice(0, m.index).trim(); }
    if (!it) return;
    var hit = loose ? looseHit(plain, it) : codeHit(code, it, ic);
    if (neg) { if (hit) { banned.push(it); got -= w; } return; }
    total += w;
    if (hit) { got += w; found.push(it); } else { missing.push(it); }
  });

  var cov = total > 0 ? Math.max(0, got) / total : 0;
  var full = num(c.OpenComplete, 0.85), part = num(c.OpenPartial, 0.40);
  var verdict = cov >= full ? 'complete' : (cov >= part ? 'partial' : 'wrong');
  if (!txt.trim()) verdict = 'empty';
  return {
    verdict: verdict, coverage: Math.round(cov * 100) / 100,
    found: found, missing: missing, banned: banned, scored: total > 0
  };
}

function looseHit(plain, word) {
  var w = word.toLowerCase().replace(/\s+/g, ' ');
  return plain.indexOf(w) >= 0;
}

function codeHit(code, pattern, ignoreCase) {
  var p = pattern.replace(/\s+/g, '');           /* the pattern loses its spaces too */
  var esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  esc = esc.replace(/\\\*/g, '[\\s\\S]*?');      /* * is a wildcard */
  try { return new RegExp(esc, ignoreCase ? 'i' : '').test(code); }
  catch (e) { return code.indexOf(p) >= 0; }
}

/* ------------------------------------------------------------------ */
/* marking                                                             */
/* ------------------------------------------------------------------ */

function markOne(q, answer, c) {
  var a = String(answer == null ? '' : answer);
  if (q.type === 'open') {
    var r = analyse(a, q.expect, c);
    var share = r.verdict === 'complete' ? 1 : (r.verdict === 'partial' ? r.coverage : 0);
    if (!r.scored) share = 0;     /* nothing expected: you mark it by hand */
    return { mark: round4(q.points * share), verdict: r.verdict,
             detail: (r.missing.length ? 'missing: ' + r.missing.join(', ') : 'all the expected elements') +
                     (r.banned.length ? ' | not allowed: ' + r.banned.join(', ') : ''),
             manual: !r.scored };
  }
  var given = a.toUpperCase().replace(/[^A-E]/g, '').split('').filter(String);
  var key = q.correct;
  if (!key.length) return { mark: 0, verdict: 'no key', detail: 'no correct answer given', manual: true };
  if (q.type === 'single') {
    var good = given.length === 1 && given[0] === key[0];
    return { mark: good ? q.points : 0, verdict: good ? 'correct' : 'wrong',
             detail: 'answer ' + (given[0] || '-') , manual: false };
  }
  var hit = 0, bad = 0;
  given.forEach(function (g) { if (key.indexOf(g) >= 0) hit++; else bad++; });
  if (yes(c.PartialMulti)) {
    var share = Math.max(0, (hit - bad) / key.length);
    return { mark: round4(q.points * share),
             verdict: share >= 1 ? 'correct' : (share > 0 ? 'partial' : 'wrong'),
             detail: hit + ' right, ' + bad + ' wrong, of ' + key.length, manual: false };
  }
  var all = hit === key.length && bad === 0;
  return { mark: all ? q.points : 0, verdict: all ? 'correct' : 'wrong',
           detail: hit + ' right, ' + bad + ' wrong, of ' + key.length, manual: false };
}

function round4(x) { return Math.round(x * 4) / 4; }

function finish(st, why) {
  if (!st || String(st.Status) === 'submitted') return { score: num(st && st.Score, 0), outOf: 0 };
  return lock(function () {
    var c = cfg(), qs = bank(), given = {}, rowOf = {};
    rows(SH.A).forEach(function (r) {
      if (String(r.Matricule) === String(st.Matricule)) {
        given[String(r.QuestionId)] = String(r.Answer);
        rowOf[String(r.QuestionId)] = r._row;
      }
    });

    var raw = 0, total = 0, lines = [];
    qs.forEach(function (q) {
      var res = markOne(q, given[q.id], c);
      raw += res.mark; total += q.points;
      lines.push({ q: q, answer: given[q.id] || '', res: res });
      if (rowOf[q.id]) {
        setCell(SH.A, rowOf[q.id], 'Verdict', res.verdict);
        setCell(SH.A, rowOf[q.id], 'Mark', res.mark);
        setCell(SH.A, rowOf[q.id], 'Detail', res.detail);
      }
    });

    var outOf = num(c.ScoreOutOf, 0);
    var score = (outOf > 0 && total > 0) ? round4(raw * outOf / total) : round4(raw);
    if (outOf <= 0) outOf = total;

    setCell(SH.ST, st._row, 'Status', 'submitted');
    setCell(SH.ST, st._row, 'SubmittedAt', new Date());
    setCell(SH.ST, st._row, 'Score', score);
    setCell(SH.ST, st._row, 'ScoreOutOf', outOf);
    setCfg('TotalPoints', total);

    var url = '';
    try { url = makePdf(st, lines, score, outOf, why, c); } catch (err) { url = 'PDF error: ' + err; }
    setCell(SH.ST, st._row, 'Copy', url);
    return { score: score, outOf: outOf, url: url };
  });
}

/* ------------------------------------------------------------------ */
/* the PDF copy                                                        */
/* ------------------------------------------------------------------ */

function examFolder(c) {
  var id = String(c.FolderId || '');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var name = 'Copies - ' + String(c.Module || 'Module') + ' - ' + String(c.ExamName || 'Exam') +
             ' - ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var f = DriveApp.createFolder(name);
  setCfg('FolderId', f.getId()); setCfg('FolderUrl', f.getUrl());
  return f;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function makePdf(st, lines, score, outOf, why, c) {
  var when = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  var h = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:26px;font-size:12px}' +
    'h1{font-size:19px;margin:0 0 2px}h2{font-size:14px;margin:16px 0 6px;color:#1d4ed8}' +
    '.m{color:#555}table{width:100%;border-collapse:collapse;margin-top:6px}' +
    'td,th{border:1px solid #bbb;padding:5px 7px;text-align:left;vertical-align:top}' +
    'th{background:#eef2ff}.ok{color:#15803d;font-weight:bold}.pa{color:#b45309;font-weight:bold}' +
    '.no{color:#b91c1c;font-weight:bold}pre{white-space:pre-wrap;font-size:11px;margin:4px 0;' +
    'background:#f6f8fc;border:1px solid #e2e8f0;padding:6px;border-radius:4px}' +
    '.sc{font-size:17px;font-weight:bold;margin-top:12px}</style></head><body>' +
    '<h1>' + esc(c.Module || '') + ' &middot; ' + esc(c.ExamName || '') + '</h1>' +
    '<div class="m">' + esc(c.Title || '') +
    ' &middot; University of Algiers 1 &middot; Computer Science Department</div>' +
    '<h2>Student</h2><table>' +
    '<tr><th>Name</th><td>' + esc(st.Name) + '</td><th>Matricule</th><td>' + esc(st.Matricule) + '</td></tr>' +
    '<tr><th>Group</th><td>' + esc(st.Group) + '</td><th>Sent</th><td>' + when + ' (' + esc(why) + ')</td></tr>' +
    '<tr><th>Warnings</th><td colspan="3">' + num(st.Warnings, 0) + '</td></tr></table><h2>Answers</h2>';

  lines.forEach(function (l, i) {
    var cls = /^(correct|complete)$/.test(l.res.verdict) ? 'ok'
            : (l.res.verdict === 'partial' ? 'pa' : 'no');
    h += '<table><tr><th style="width:36px">' + (i + 1) + '</th><td colspan="3">' +
         esc(l.q.text) + (l.q.theme ? ' <span class="m">(' + esc(l.q.theme) + ')</span>' : '') + '</td></tr>';
    if (l.q.type === 'open') {
      h += '<tr><th>Answer</th><td colspan="3"><pre>' + esc(l.answer || '(nothing)') + '</pre></td></tr>' +
           '<tr><th>Analyser</th><td class="' + cls + '">' + esc(l.res.verdict) + '</td>' +
           '<th>Points</th><td>' + l.res.mark + ' / ' + l.q.points + '</td></tr>' +
           '<tr><th>Detail</th><td colspan="3" class="m">' + esc(l.res.detail) + '</td></tr>';
    } else {
      h += '<tr><th>Answer</th><td>' + esc(l.answer || '-') + '</td>' +
           '<th>Result</th><td class="' + cls + '">' + esc(l.res.verdict) +
           ' (' + l.res.mark + ' / ' + l.q.points + ')</td></tr>';
    }
    h += '</table>';
  });

  h += '<div class="sc">Mark: ' + score + ' / ' + outOf + '</div></body></html>';
  var pdf = Utilities.newBlob(h, 'text/html', 'copy.html').getAs('application/pdf')
            .setName(st.Group + ' - ' + st.Matricule + ' - ' + st.Name + '.pdf');
  return examFolder(c).createFile(pdf).getUrl();
}

/* ------------------------------------------------------------------ */
/* teacher                                                             */
/* ------------------------------------------------------------------ */

function tState(b) {
  var c = cfg(), qs = bank(), kinds = { single: 0, multi: 0, open: 0 }, pts = 0;
  qs.forEach(function (q) { kinds[q.type]++; pts += q.points; });
  var list = rows(SH.ST).map(function (s) {
    return { row: s._row, name: String(s.Name), matricule: String(s.Matricule), group: String(s.Group),
             status: String(s.Status), warnings: num(s.Warnings, 0),
             endsAt: s.EndsAt ? Number(s.EndsAt) : 0,
             score: s.Score === '' ? null : Number(s.Score),
             outOf: s.ScoreOutOf === '' ? null : Number(s.ScoreOutOf),
             copy: String(s.Copy || '') };
  });
  var ev = rows(SH.E).slice(-40).reverse().map(function (e) {
    return { name: String(e.Name), matricule: String(e.Matricule),
             group: String(e.Group), type: String(e.Event) };
  });
  return { ok: true, serverTime: now(),
    exam: { title: String(c.Title || ''), module: String(c.Module || ''),
            examName: String(c.ExamName || ''), status: String(c.Status || 'closed'),
            duration: num(c.DurationMin, 30), shuffle: String(c.Shuffle || 'no'),
            groups: String(c.Groups || ''), scoreOutOf: num(c.ScoreOutOf, 0),
            sameMark: String(c.SameMark || 'yes'), markPerQuestion: num(c.MarkPerQuestion, 1),
            partialMulti: String(c.PartialMulti || 'yes'),
            openComplete: num(c.OpenComplete, .85), openPartial: num(c.OpenPartial, .4),
            openIgnoreCase: String(c.OpenIgnoreCase || 'no'),
            useCaseTitle: String(c.UseCaseTitle || ''), useCaseText: String(c.UseCaseText || ''),
            folder: String(c.FolderUrl || ''),
            questions: qs.length, kinds: kinds, totalPoints: pts },
    students: list, events: ev };
}

function pick(b) {
  var all = rows(SH.ST);
  if (b.matricule) return all.filter(function (s) { return String(s.Matricule) === String(b.matricule); });
  if (b.group) return all.filter(function (s) { return String(s.Group) === String(b.group); });
  return all;
}

function startOne(s, minutes) {
  setCell(SH.ST, s._row, 'Status', 'running');
  setCell(SH.ST, s._row, 'StartedAt', new Date());
  setCell(SH.ST, s._row, 'EndsAt', now() + minutes * 60000);
}

function tApprove(b) {
  var c = cfg();
  pick(b).forEach(function (s) {
    if (String(s.Status) === 'waiting') {
      setCell(SH.ST, s._row, 'Status', 'approved');
      if (String(c.Status) === 'running') startOne(s, num(c.DurationMin, 30));
    }
  });
  return { ok: true };
}

function tReject(b) {
  pick(b).forEach(function (s) { setCell(SH.ST, s._row, 'Status', 'rejected'); });
  return { ok: true };
}

function tStart(b) {
  var minutes = num(b.minutes, num(cfg().DurationMin, 30));
  setCfg('DurationMin', minutes); setCfg('Status', 'running');
  rows(SH.ST).forEach(function (s) { if (String(s.Status) === 'approved') startOne(s, minutes); });
  return { ok: true };
}

function tStop(b) {
  setCfg('Status', 'finished');
  rows(SH.ST).forEach(function (s) { if (String(s.Status) === 'running') finish(s, 'stopped by the teacher'); });
  return { ok: true };
}

function tMinutes(b) {
  var add = num(b.minutes, 0) * 60000;
  pick(b).forEach(function (s) {
    if (String(s.Status) === 'running' && s.EndsAt) setCell(SH.ST, s._row, 'EndsAt', Number(s.EndsAt) + add);
  });
  return { ok: true };
}

function tConfig(b) {
  ['Module','ExamName','Title','UseCaseTitle','UseCaseText','DurationMin','Groups','Shuffle',
   'ScoreOutOf','SameMark','MarkPerQuestion','PartialMulti','OpenComplete','OpenPartial',
   'OpenIgnoreCase','Status'].forEach(function (k) {
    if (b[k] !== undefined && b[k] !== null) setCfg(k, b[k]);
  });
  return { ok: true };
}

function tReset(b) {
  [SH.ST, SH.A, SH.E].forEach(function (n) {
    var s = sheet(n);
    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).clearContent();
  });
  setCfg('Status', 'closed'); setCfg('FolderId', ''); setCfg('FolderUrl', '');
  return { ok: true };
}

/* the dashboard sends rows already parsed: [{Id,Theme,Type,Question,Code,A..E,Correct,Expect,Points}] */
function tImport(b) {
  var list = b.questions || [];
  if (!list.length) return { ok: false, error: 'Nothing to import' };
  return lock(function () {
    var s = sheet(SH.Q);
    s.clear();
    s.getRange(1, 1, 1, Q_COLS.length).setValues([Q_COLS]).setFontWeight('bold');
    s.setFrozenRows(1);
    var out = list.map(function (q) {
      return Q_COLS.map(function (col) { return q[col] === undefined ? '' : q[col]; });
    });
    s.getRange(2, 1, out.length, Q_COLS.length).setValues(out);
    /* if the questions do not all carry the same points, use the Points column */
    var pts = {}, note = '';
    list.forEach(function (q) { pts[Number(q.Points) || 1] = 1; });
    if (Object.keys(pts).length > 1 && yes(cfg().SameMark)) {
      setCfg('SameMark', 'no');
      note = 'The questions have different points, so "same mark for every question" was turned off.';
    }
    return { ok: true, n: out.length, note: note };
  });
}

/* the questions as they are in the sheet, for the editor */
function tBank(b) {
  var out = rows(SH.Q).filter(function (q) { return String(q.Id || '').trim(); }).map(function (q) {
    var o = {};
    Q_COLS.forEach(function (c) { o[c] = q[c] === undefined ? '' : q[c]; });
    o.Type = String(o.Type || 'single').toLowerCase();
    if (o.Type !== 'multi' && o.Type !== 'open') o.Type = 'single';
    o.Correct = String(o.Correct || '').toUpperCase().replace(/[^A-E]/g, '').split('').join(',');
    o.Points = num(o.Points, 1);
    return o;
  });
  return { ok: true, questions: out };
}

function tQuestions(b) {
  return { ok: true, questions: bank().map(function (q) {
    return { id: q.id, theme: q.theme, type: q.type, text: q.text, points: q.points,
             choices: q.choices.length, correct: q.correct.join(''), expect: q.expect };
  }) };
}

/* the written answers, to read and to mark by hand */
function tOpen(b) {
  var open = {}, out = [];
  bank().forEach(function (q) { if (q.type === 'open') open[q.id] = q; });
  rows(SH.A).forEach(function (r) {
    var q = open[String(r.QuestionId)];
    if (!q) return;
    if (b.matricule && String(r.Matricule) !== String(b.matricule)) return;
    out.push({ row: r._row, matricule: String(r.Matricule), qid: String(r.QuestionId),
               question: q.text, points: q.points, answer: String(r.Answer || ''),
               verdict: String(r.Verdict || ''), mark: r.Mark === '' ? null : Number(r.Mark),
               detail: String(r.Detail || '') });
  });
  return { ok: true, answers: out };
}

/* change the mark of one written answer and rebuild that student's total */
function tGrade(b) {
  var row = num(b.row, 0);
  if (!row) return { ok: false, error: 'Which answer?' };
  setCell(SH.A, row, 'Mark', num(b.mark, 0));
  setCell(SH.A, row, 'Verdict', String(b.verdict || 'by the teacher'));
  setCell(SH.A, row, 'Detail', String(b.detail || 'marked by the teacher'));
  return recompute(String(b.matricule || ''));
}

function recompute(mat) {
  if (!mat) return { ok: true };
  var c = cfg(), qs = bank(), marks = {}, total = 0, raw = 0;
  rows(SH.A).forEach(function (r) {
    if (String(r.Matricule) === mat && r.Mark !== '') marks[String(r.QuestionId)] = Number(r.Mark);
  });
  qs.forEach(function (q) { total += q.points; raw += (marks[q.id] || 0); });
  var outOf = num(c.ScoreOutOf, 0);
  var score = (outOf > 0 && total > 0) ? round4(raw * outOf / total) : round4(raw);
  if (outOf <= 0) outOf = total;
  rows(SH.ST).forEach(function (s) {
    if (String(s.Matricule) === mat) {
      setCell(SH.ST, s._row, 'Score', score);
      setCell(SH.ST, s._row, 'ScoreOutOf', outOf);
    }
  });
  return { ok: true, score: score, outOf: outOf };
}

function tPdfAll(b) {
  var n = 0;
  rows(SH.ST).forEach(function (s) {
    if (String(s.Status) === 'submitted' && !String(s.Copy || '')) {
      try { setCell(SH.ST, s._row, 'Status', 'approved'); finish(student(s.Token), 'copy rebuilt'); n++; }
      catch (e) {}
    }
  });
  return { ok: true, n: n, folder: String(cfg().FolderUrl || '') };
}

/* ------------------------------------------------------------------ */
/* first run                                                           */
/* ------------------------------------------------------------------ */

function setupSheets() {
  var s = sheet(SH.S);
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, 3).setValues([['Key', 'Value', 'What it is']]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  var have = cfg();
  DEFAULTS.forEach(function (d) { if (have[d[0]] === undefined) s.appendRow(d); });
  head(SH.Q, Q_COLS); head(SH.ST, ST_COLS); head(SH.A, A_COLS); head(SH.E, E_COLS);
  if (sheet(SH.Q).getLastRow() === 1) {
    sheet(SH.Q).getRange(2, 1, 3, Q_COLS.length).setValues([
      ['Q1','Ch. 4 · Interface','single','Which widget makes one choice among n exclusive alternatives?','',
       'Check box','Radio button','Text field','Scrollbar','','B','',1],
      ['Q2','Ch. 4 · Interface','multi','Which of these are utility windows? (several answers)','',
       'Tooltip','Dialog box','Floating palette','Progress indication','','A,C,D','',1],
      ['Q3','Ch. 4 · Interface','open',
       'Write the Java Swing code of an empty window named "Campus Library", 600x400, centred, that does not close by itself.','',
       '','','','','','','JFrame | setTitle("*") | setSize(600,400) | setLocationRelativeTo(null) | setDefaultCloseOperation | setVisible(true) | !System.exit',3]
    ]);
  }
  try { SpreadsheetApp.getUi().alert('Sheets ready. Set the teacher key in the code, then deploy.'); } catch (e) {}
}

function head(name, cols) {
  var s = sheet(name);
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Exam').addItem('Prepare the sheets', 'setupSheets').addToUi();
}
