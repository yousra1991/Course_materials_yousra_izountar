/**
 * HCI online exam - server
 * Izountar Yousra - Universite Alger 1
 *
 * This script is bound to the Google Sheet "HCI Exam".
 * It is published as a web app (Deploy > New deployment > Web app,
 * execute as me, access: anyone).
 *
 * The correct answers never leave this file: the student page receives
 * the questions without the key, and the marking is done here.
 */

var TEACHER_KEY = 'CHANGE-THIS-KEY';   // the teacher types this key in the dashboard
var MAX_WARNINGS = 3;                  // after this number of cheating events the copy is sent
var SH = {
  S: 'Settings', Q: 'Questions', ST: 'Students', A: 'Answers', E: 'Events'
};

/* ------------------------------------------------------------------ */
/* entry points                                                        */
/* ------------------------------------------------------------------ */

function doGet(e) {
  return json({ ok: true, service: 'HCI exam', time: Date.now() });
}

function doPost(e) {
  var out;
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    out = route(body);
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return json(out);
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function route(b) {
  var a = String(b.action || '');
  /* student */
  if (a === 'join')      return sJoin(b);
  if (a === 'poll')      return sPoll(b);
  if (a === 'questions') return sQuestions(b);
  if (a === 'answer')    return sAnswer(b);
  if (a === 'event')     return sEvent(b);
  if (a === 'submit')    return sSubmit(b);
  /* teacher */
  if (a.charAt(0) === 't') {
    if (String(b.key || '').replace(/\s/g, '').toUpperCase() !==
        TEACHER_KEY.replace(/\s/g, '').toUpperCase()) {
      return { ok: false, error: 'Wrong teacher key' };
    }
    if (a === 'tstate')    return tState(b);
    if (a === 'tapprove')  return tApprove(b);
    if (a === 'treject')   return tReject(b);
    if (a === 'tstart')    return tStart(b);
    if (a === 'tstop')     return tStop(b);
    if (a === 'tminutes')  return tMinutes(b);
    if (a === 'tconfig')   return tConfig(b);
    if (a === 'treset')    return tReset(b);
    if (a === 'tpdf')      return tPdfAll(b);
  }
  return { ok: false, error: 'Unknown action: ' + a };
}

/* ------------------------------------------------------------------ */
/* sheet helpers                                                       */
/* ------------------------------------------------------------------ */

function ss() { return SpreadsheetApp.getActive(); }

function sheet(name) {
  var s = ss().getSheetByName(name);
  if (!s) s = ss().insertSheet(name);
  return s;
}

function rows(name) {
  var v = sheet(name).getDataRange().getValues();
  if (v.length < 2) return [];
  var head = v[0].map(function (h) { return String(h).trim(); });
  return v.slice(1).map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, c) { if (h) o[h] = r[c]; });
    return o;
  }).filter(function (o) { return String(o.Matricule || o.Id || o.Key || '').length > 0; });
}

function colIndex(name, header) {
  var h = sheet(name).getRange(1, 1, 1, sheet(name).getLastColumn()).getValues()[0];
  for (var i = 0; i < h.length; i++) if (String(h[i]).trim() === header) return i + 1;
  return 0;
}

function setCell(name, row, header, value) {
  var c = colIndex(name, header);
  if (c) sheet(name).getRange(row, c).setValue(value);
}

/* settings are a two column sheet: Key | Value */
function cfg() {
  var v = sheet(SH.S).getDataRange().getValues(), o = {};
  for (var i = 1; i < v.length; i++) {
    var k = String(v[i][0]).trim();
    if (k) o[k] = v[i][1];
  }
  return o;
}

function setCfg(key, value) {
  var s = sheet(SH.S), v = s.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0]).trim() === key) { s.getRange(i + 1, 2).setValue(value); return; }
  }
  s.appendRow([key, value]);
}

function now() { return Date.now(); }

function lock(fn) {
  var l = LockService.getScriptLock();
  l.waitLock(20000);
  try { return fn(); } finally { l.releaseLock(); }
}

/* ------------------------------------------------------------------ */
/* student                                                             */
/* ------------------------------------------------------------------ */

function student(token) {
  if (!token) return null;
  var all = rows(SH.ST);
  for (var i = 0; i < all.length; i++) {
    if (String(all[i].Token) === String(token)) return all[i];
  }
  return null;
}

function publicExam() {
  var c = cfg();
  return {
    title: String(c.Title || 'Exam'),
    status: String(c.Status || 'closed'),   // closed | waiting | running | finished
    duration: Number(c.DurationMin || 30),
    groups: String(c.Groups || 'G1,G2,G3,G4,G5').split(',')
              .map(function (g) { return g.trim(); }).filter(String)
  };
}

function sJoin(b) {
  var name = String(b.name || '').trim();
  var mat  = String(b.matricule || '').trim();
  var grp  = String(b.group || '').trim();
  if (!name || !mat || !grp) return { ok: false, error: 'Name, matricule and group are required' };

  var ex = publicExam();
  if (ex.status === 'closed') return { ok: false, error: 'The exam is not open yet' };

  return lock(function () {
    var all = rows(SH.ST);
    for (var i = 0; i < all.length; i++) {
      if (String(all[i].Matricule).trim() === mat) {
        if (String(all[i].Status) === 'rejected') return { ok: false, error: 'Access refused' };
        if (String(all[i].Status) === 'submitted') return { ok: false, error: 'You already sent your copy' };
        return { ok: true, token: String(all[i].Token), exam: ex };   // same student comes back
      }
    }
    var token = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    sheet(SH.ST).appendRow([new Date(), name, mat, grp, token, 'waiting', '', '', '', '', 0, '']);
    return { ok: true, token: token, exam: ex };
  });
}

function sPoll(b) {
  var st = student(b.token);
  if (!st) return { ok: false, error: 'Unknown student' };
  var ex = publicExam();
  var ends = st.EndsAt ? Number(st.EndsAt) : 0;

  /* time is over: close the copy automatically */
  if (String(st.Status) === 'running' && ends && now() > ends) {
    autoSubmit(st, 'time over');
    st = student(b.token);
  }
  return {
    ok: true,
    status: String(st.Status),
    warnings: Number(st.Warnings || 0),
    maxWarnings: MAX_WARNINGS,
    exam: ex,
    endsAt: ends,
    serverTime: now(),
    score: st.Score === '' ? null : Number(st.Score),
    total: Number(cfg().TotalPoints || 0)
  };
}

function sQuestions(b) {
  var st = student(b.token);
  if (!st) return { ok: false, error: 'Unknown student' };
  if (String(st.Status) !== 'running') return { ok: false, error: 'The exam has not started' };

  var qs = rows(SH.Q).map(function (q) {
    return {
      id: String(q.Id),
      text: String(q.Question),
      points: Number(q.Points || 1),
      choices: ['A', 'B', 'C', 'D', 'E']
        .filter(function (L) { return String(q[L] || '').trim() !== ''; })
        .map(function (L) { return { k: L, t: String(q[L]) }; })
    };
  });

  if (String(cfg().Shuffle || '').toLowerCase() === 'yes') {
    qs = shuffleWithSeed(qs, String(st.Matricule));
  }
  /* answers already saved, so a reload does not lose the work */
  var saved = {};
  rows(SH.A).forEach(function (r) {
    if (String(r.Matricule) === String(st.Matricule)) saved[String(r.QuestionId)] = String(r.Choice);
  });
  return { ok: true, questions: qs, saved: saved };
}

function shuffleWithSeed(arr, seed) {
  var s = 0, i;
  for (i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) % 100000;
  var a = arr.slice();
  for (i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    var j = s % (i + 1);
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function sAnswer(b) {
  var st = student(b.token);
  if (!st || String(st.Status) !== 'running') return { ok: false, error: 'Not running' };
  return lock(function () {
    var s = sheet(SH.A), v = s.getDataRange().getValues();
    for (var i = 1; i < v.length; i++) {
      if (String(v[i][1]) === String(st.Matricule) && String(v[i][2]) === String(b.qid)) {
        s.getRange(i + 1, 4).setValue(String(b.choice));
        s.getRange(i + 1, 1).setValue(new Date());
        return { ok: true };
      }
    }
    s.appendRow([new Date(), st.Matricule, String(b.qid), String(b.choice)]);
    return { ok: true };
  });
}

function sEvent(b) {
  var st = student(b.token);
  if (!st) return { ok: false, error: 'Unknown student' };
  var type = String(b.type || 'unknown');
  sheet(SH.E).appendRow([new Date(), st.Name, st.Matricule, st.Group, type]);

  var counted = ['exit-fullscreen', 'tab-hidden', 'window-blur', 'copy', 'paste', 'cut',
                 'contextmenu', 'devtools', 'print'];
  if (counted.indexOf(type) < 0) return { ok: true, warnings: Number(st.Warnings || 0) };

  var w = Number(st.Warnings || 0) + 1;
  setCell(SH.ST, st._row, 'Warnings', w);
  if (w >= MAX_WARNINGS && String(st.Status) === 'running') {
    autoSubmit(student(b.token), 'too many warnings');
    return { ok: true, warnings: w, forceSubmit: true };
  }
  return { ok: true, warnings: w, maxWarnings: MAX_WARNINGS };
}

function sSubmit(b) {
  var st = student(b.token);
  if (!st) return { ok: false, error: 'Unknown student' };
  if (String(st.Status) === 'submitted') {
    return { ok: true, already: true, score: Number(st.Score || 0), total: Number(cfg().TotalPoints || 0) };
  }
  if (b.answers) {
    for (var qid in b.answers) sAnswer({ token: b.token, qid: qid, choice: b.answers[qid] });
  }
  var r = finish(student(b.token), 'sent by the student');
  return { ok: true, score: r.score, total: r.total };
}

function autoSubmit(st, why) {
  if (!st || String(st.Status) === 'submitted') return;
  finish(st, why);
}

/* marking + the PDF copy in Drive */
function finish(st, why) {
  return lock(function () {
    var qs = rows(SH.Q);
    var given = {};
    rows(SH.A).forEach(function (r) {
      if (String(r.Matricule) === String(st.Matricule)) given[String(r.QuestionId)] = String(r.Choice).trim().toUpperCase();
    });

    var score = 0, total = 0, lines = [];
    qs.forEach(function (q) {
      var pts = Number(q.Points || 1);
      var key = String(q.Correct || '').trim().toUpperCase();
      var got = given[String(q.Id)] || '';
      var good = got && got === key;
      if (good) score += pts;
      total += pts;
      lines.push({ id: String(q.Id), q: String(q.Question), got: got, good: good, pts: pts });
    });

    setCell(SH.ST, st._row, 'Status', 'submitted');
    setCell(SH.ST, st._row, 'SubmittedAt', new Date());
    setCell(SH.ST, st._row, 'Score', score);
    setCfg('TotalPoints', total);

    var url = '';
    try { url = makePdf(st, lines, score, total, why); } catch (err) { url = 'PDF error: ' + err; }
    setCell(SH.ST, st._row, 'Copy', url);
    return { score: score, total: total, url: url };
  });
}

function examFolder() {
  var c = cfg(), id = String(c.FolderId || '');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var name = 'Exam copies - ' + String(c.Title || 'Exam') + ' - ' +
             Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var f = DriveApp.createFolder(name);
  setCfg('FolderId', f.getId());
  setCfg('FolderUrl', f.getUrl());
  return f;
}

function makePdf(st, lines, score, total, why) {
  var c = cfg();
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };
  var when = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  var h = '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:26px}' +
    'h1{font-size:19px;margin:0 0 2px}h2{font-size:14px;margin:18px 0 6px;color:#1d4ed8}' +
    '.m{color:#555;font-size:12px}table{width:100%;border-collapse:collapse;font-size:12px;margin-top:6px}' +
    'td,th{border:1px solid #bbb;padding:5px 7px;text-align:left;vertical-align:top}' +
    'th{background:#eef2ff}.ok{color:#15803d;font-weight:bold}.no{color:#b91c1c;font-weight:bold}' +
    '.score{font-size:16px;font-weight:bold;margin-top:10px}</style></head><body>' +
    '<h1>' + esc(c.Title || 'Exam') + '</h1>' +
    '<div class="m">University of Algiers 1 &middot; Computer Science Department &middot; ' +
    esc(c.Module || 'HCI') + '</div><h2>Student</h2>' +
    '<table><tr><th>Name</th><td>' + esc(st.Name) + '</td><th>Matricule</th><td>' + esc(st.Matricule) + '</td></tr>' +
    '<tr><th>Group</th><td>' + esc(st.Group) + '</td><th>Sent</th><td>' + when + ' (' + esc(why) + ')</td></tr>' +
    '<tr><th>Warnings</th><td colspan="3">' + Number(st.Warnings || 0) + '</td></tr></table>' +
    '<h2>Answers</h2><table><tr><th style="width:38px">#</th><th>Question</th>' +
    '<th style="width:60px">Answer</th><th style="width:60px">Result</th><th style="width:48px">Points</th></tr>';
  lines.forEach(function (l, i) {
    h += '<tr><td>' + (i + 1) + '</td><td>' + esc(l.q) + '</td><td>' + esc(l.got || '-') + '</td>' +
         '<td class="' + (l.good ? 'ok">correct' : 'no">wrong') + '</td><td>' +
         (l.good ? l.pts : 0) + ' / ' + l.pts + '</td></tr>';
  });
  h += '</table><div class="score">Score: ' + score + ' / ' + total + '</div></body></html>';

  var pdf = Utilities.newBlob(h, 'text/html', 'copy.html').getAs('application/pdf')
            .setName(st.Group + ' - ' + st.Matricule + ' - ' + st.Name + '.pdf');
  return examFolder().createFile(pdf).getUrl();
}

/* ------------------------------------------------------------------ */
/* teacher                                                             */
/* ------------------------------------------------------------------ */

function tState(b) {
  var c = cfg();
  var list = rows(SH.ST).map(function (s) {
    return {
      row: s._row, name: String(s.Name), matricule: String(s.Matricule), group: String(s.Group),
      status: String(s.Status), warnings: Number(s.Warnings || 0),
      endsAt: s.EndsAt ? Number(s.EndsAt) : 0,
      score: s.Score === '' ? null : Number(s.Score),
      copy: String(s.Copy || '')
    };
  });
  var ev = rows(SH.E).slice(-40).reverse().map(function (e) {
    return { t: e.Time ? new Date(e.Time).getTime() : 0, name: String(e.Name),
             matricule: String(e.Matricule), group: String(e.Group), type: String(e.Event) };
  });
  return {
    ok: true, serverTime: now(),
    exam: { title: String(c.Title || 'Exam'), status: String(c.Status || 'closed'),
            duration: Number(c.DurationMin || 30), shuffle: String(c.Shuffle || 'no'),
            groups: String(c.Groups || ''), module: String(c.Module || 'HCI'),
            folder: String(c.FolderUrl || ''), questions: rows(SH.Q).length },
    students: list, events: ev
  };
}

function tApprove(b) {
  var ex = cfg(), targets = pick(b);
  targets.forEach(function (s) {
    if (String(s.Status) === 'waiting') {
      setCell(SH.ST, s._row, 'Status', 'approved');
      /* if the exam is already running the student starts now */
      if (String(ex.Status) === 'running') startOne(s, Number(ex.DurationMin || 30));
    }
  });
  return { ok: true, n: targets.length };
}

function tReject(b) {
  pick(b).forEach(function (s) { setCell(SH.ST, s._row, 'Status', 'rejected'); });
  return { ok: true };
}

function pick(b) {
  var all = rows(SH.ST);
  if (b.matricule) return all.filter(function (s) { return String(s.Matricule) === String(b.matricule); });
  if (b.group)     return all.filter(function (s) { return String(s.Group) === String(b.group); });
  return all;
}

function startOne(s, minutes) {
  var ends = now() + minutes * 60000;
  setCell(SH.ST, s._row, 'Status', 'running');
  setCell(SH.ST, s._row, 'StartedAt', new Date());
  setCell(SH.ST, s._row, 'EndsAt', ends);
}

function tStart(b) {
  var minutes = Number(b.minutes || cfg().DurationMin || 30);
  setCfg('DurationMin', minutes);
  setCfg('Status', 'running');
  rows(SH.ST).forEach(function (s) {
    if (String(s.Status) === 'approved') startOne(s, minutes);
  });
  return { ok: true };
}

function tStop(b) {
  setCfg('Status', 'finished');
  rows(SH.ST).forEach(function (s) {
    if (String(s.Status) === 'running') autoSubmit(s, 'stopped by the teacher');
  });
  return { ok: true };
}

/* add (or remove) minutes: everybody, one group or one student */
function tMinutes(b) {
  var add = Number(b.minutes || 0) * 60000;
  pick(b).forEach(function (s) {
    if (String(s.Status) === 'running' && s.EndsAt) {
      setCell(SH.ST, s._row, 'EndsAt', Number(s.EndsAt) + add);
    }
  });
  return { ok: true };
}

function tConfig(b) {
  ['Title', 'Module', 'DurationMin', 'Groups', 'Shuffle', 'Status'].forEach(function (k) {
    if (b[k] !== undefined && b[k] !== null && b[k] !== '') setCfg(k, b[k]);
  });
  return { ok: true, exam: cfg() };
}

/* empty the students, answers and events of the previous exam */
function tReset(b) {
  [SH.ST, SH.A, SH.E].forEach(function (n) {
    var s = sheet(n);
    if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, s.getLastColumn()).clearContent();
  });
  setCfg('Status', 'closed');
  setCfg('FolderId', '');
  setCfg('FolderUrl', '');
  return { ok: true };
}

function tPdfAll(b) {
  var n = 0;
  rows(SH.ST).forEach(function (s) {
    if (String(s.Status) === 'submitted' && !String(s.Copy || '')) {
      try { finish(s, 'copy rebuilt'); n++; } catch (e) {}
    }
  });
  return { ok: true, n: n, folder: String(cfg().FolderUrl || '') };
}

/* ------------------------------------------------------------------ */
/* first run: build the sheets                                         */
/* ------------------------------------------------------------------ */

function setupSheets() {
  var s = sheet(SH.S);
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, 2).setValues([['Key', 'Value']]).setFontWeight('bold');
    [['Title', 'HCI - Exam 1'], ['Module', 'HCI'], ['DurationMin', 30],
     ['Groups', 'G1,G2,G3,G4,G5'], ['Shuffle', 'no'], ['Status', 'closed'],
     ['TotalPoints', 0], ['FolderId', ''], ['FolderUrl', '']]
      .forEach(function (r) { s.appendRow(r); });
  }
  head(SH.Q,  ['Id', 'Question', 'A', 'B', 'C', 'D', 'E', 'Correct', 'Points']);
  head(SH.ST, ['Time', 'Name', 'Matricule', 'Group', 'Token', 'Status', 'StartedAt',
               'EndsAt', 'SubmittedAt', 'Score', 'Warnings', 'Copy']);
  head(SH.A,  ['Time', 'Matricule', 'QuestionId', 'Choice']);
  head(SH.E,  ['Time', 'Name', 'Matricule', 'Group', 'Event']);
  if (sheet(SH.Q).getLastRow() === 1) {
    sheet(SH.Q).appendRow(['Q1', 'Which widget makes one choice among n exclusive alternatives?',
      'Check box', 'Radio button', 'Text field', 'Scrollbar', '', 'B', 1]);
    sheet(SH.Q).appendRow(['Q2', 'In a FIFO event queue, which event is processed first?',
      'The last one', 'The shortest one', 'The oldest one', 'A random one', '', 'C', 1]);
  }
  SpreadsheetApp.getUi().alert('Sheets ready. Now set the teacher key in the script and deploy.');
}

function head(name, cols) {
  var s = sheet(name);
  if (s.getLastRow() === 0) {
    s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    s.setFrozenRows(1);
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Exam')
    .addItem('Prepare the sheets', 'setupSheets')
    .addToUi();
}
