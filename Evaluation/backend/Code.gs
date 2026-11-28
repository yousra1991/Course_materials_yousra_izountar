/**
 * Continuous evaluation - server
 * Izountar Yousra - Universite Alger 1
 *
 * Bound to the Google Sheet that holds the evaluation tabs
 * (for NoSQL & Cloud: "NoSQL & Cloud - Student Registration Form (reponses)").
 * Published as a web app: Deploy > New deployment > Web app,
 * execute as me, access: anyone.
 *
 * A student signs in with their matricule (8 digits, as in the official list).
 * The server sends back ONLY that student's row, their claims and their absence notes.
 * The teacher key, the other students and the Drive files never leave Google.
 */

var TEACHER_KEY = 'CHANGE-THIS-KEY';   // the key you type in the dashboard
var SH = { S: 'Settings', ST: 'Students', C: 'Claims', A: 'Absences', L: 'Log' };

var ST_COLS = ['Matricule', 'Inscription', 'LastName', 'FirstName', 'Group', 'Token', 'LastSeen'];
var C_COLS  = ['Id', 'Time', 'Matricule', 'Name', 'Group', 'Topic', 'Message', 'FileName', 'FileUrl',
               'Status', 'Reply', 'RepliedAt'];
var A_COLS  = ['Id', 'Time', 'Matricule', 'Name', 'Group', 'Session', 'Reason', 'FileName', 'FileUrl',
               'Status', 'Reply', 'RepliedAt'];
var L_COLS  = ['Time', 'Matricule', 'Event'];

var DEFAULTS = [
  ['Title', 'NoSQL & Cloud - Continuous evaluation', 'Title shown to the students'],
  ['EvalTabs', 'EvaluationContinuG1,EvaluationContinuG2', 'Tabs that hold the marks, separated by commas'],
  ['ClaimsOpen', 'yes', 'yes = students can send claims and absence notes, no = read only'],
  ['Deadline', '', 'Optional text shown to the students, e.g. "Claims until 10/12/2026"'],
  ['MaxFileMB', 5, 'Largest file a student can send (PDF, JPG or PNG)'],
  ['FolderId', '', 'Drive folder of the files, made by the server'],
  ['FolderUrl', '', 'Link to that folder']
];

var STATUS = ['Pending', 'Accepted', 'Refused'];

/* ------------------------------------------------------------------ */
/* entry points                                                        */
/* ------------------------------------------------------------------ */

function doGet(e) { return json({ ok: true, service: 'evaluation', time: Date.now() }); }

function doPost(e) {
  var out;
  try { out = route(JSON.parse(e.postData.contents || '{}')); }
  catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  return json(out);
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function route(b) {
  var a = String(b.action || '');
  if (a === 'login')   return sLogin(b);
  if (a === 'me')      return sMe(b);
  if (a === 'claim')   return sClaim(b);
  if (a === 'absence') return sAbsence(b);
  if (a.charAt(0) === 't') {
    /* the key shipped with the code is public: it must be changed first */
    if (norm(TEACHER_KEY) === 'CHANGE-THIS-KEY') {
      return { ok: false, error: 'Set your own TEACHER_KEY at the top of Code.gs, then deploy a new version.' };
    }
    if (norm(b.key) !== norm(TEACHER_KEY)) return { ok: false, error: 'Wrong teacher key' };
    if (a === 'tstate')    return tState(b);
    if (a === 'treply')    return tReply(b);
    if (a === 'tsettings') return tSettings(b);
    if (a === 'tstudent')  return tStudent(b);
  }
  return { ok: false, error: 'Unknown action: ' + a };
}

/* the teacher key is compared tolerantly: spaces and case do not count */
function norm(s) { return String(s || '').replace(/\s/g, '').toUpperCase(); }
function digits(s) { return String(s || '').replace(/\D/g, ''); }

/* ------------------------------------------------------------------ */
/* sheet helpers                                                       */
/* ------------------------------------------------------------------ */

function ss() { return SpreadsheetApp.getActive(); }
function sheet(n) { return ss().getSheetByName(n) || ss().insertSheet(n); }

function rows(name) {
  var s = ss().getSheetByName(name);
  if (!s || s.getLastRow() < 2) return [];
  var v = s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getDisplayValues();
  var head = v[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var o = { _row: i + 1 }, any = false;
    head.forEach(function (h, c) { if (h) { o[h] = v[i][c]; if (String(v[i][c]).length) any = true; } });
    if (any) out.push(o);
  }
  return out;
}

function setCells(name, row, obj) {
  var s = sheet(name), head = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  Object.keys(obj).forEach(function (k) {
    var c = head.indexOf(k);
    if (c >= 0) s.getRange(row, c + 1).setValue(obj[k]);
  });
}

function append(name, cols, obj) {
  sheet(name).appendRow(cols.map(function (c) { return obj[c] === undefined ? '' : obj[c]; }));
}

function settings() {
  var o = {};
  rows(SH.S).forEach(function (r) { o[r.Key] = r.Value; });
  DEFAULTS.forEach(function (d) { if (o[d[0]] === undefined) o[d[0]] = d[1]; });
  return o;
}

function setSetting(key, value) {
  var r = rows(SH.S).filter(function (x) { return x.Key === key; })[0];
  if (r) sheet(SH.S).getRange(r._row, 2).setValue(value);
  else sheet(SH.S).appendRow([key, value, '']);
}

function withLock(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function log(mat, ev) { append(SH.L, L_COLS, { Time: new Date(), Matricule: mat, Event: ev }); }

/* ------------------------------------------------------------------ */
/* setup (run once from the editor or from the menu)                   */
/* ------------------------------------------------------------------ */

function setupSheets() {
  var s = sheet(SH.S);
  if (s.getLastRow() === 0) s.appendRow(['Key', 'Value', 'What it is']);
  var have = rows(SH.S).map(function (r) { return r.Key; });
  DEFAULTS.forEach(function (d) { if (have.indexOf(d[0]) < 0) s.appendRow(d); });
  [[SH.ST, ST_COLS], [SH.C, C_COLS], [SH.A, A_COLS], [SH.L, L_COLS]].forEach(function (p) {
    var t = sheet(p[0]);
    if (t.getLastRow() === 0) { t.appendRow(p[1]); t.setFrozenRows(1); }
  });
  folder();
  SpreadsheetApp.getActive().toast('Tabs ready: Settings, Students, Claims, Absences, Log');
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Evaluation')
    .addItem('Set up the tabs', 'setupSheets')
    .addToUi();
}

function folder() {
  var st = settings();
  if (st.FolderId) { try { return DriveApp.getFolderById(st.FolderId); } catch (e) {} }
  var f = DriveApp.createFolder(st.Title + ' - files from students');
  setSetting('FolderId', f.getId());
  setSetting('FolderUrl', f.getUrl());
  return f;
}

/* ------------------------------------------------------------------ */
/* students                                                            */
/* ------------------------------------------------------------------ */

function findStudent(token) {
  if (!token) return null;
  return rows(SH.ST).filter(function (r) { return r.Token && r.Token === String(token); })[0] || null;
}

function sLogin(b) {
  var mat = digits(b.matricule);
  if (!mat) return { ok: false, error: 'Write your matricule.' };
  /* slow down people who try many matricules: 30 unknown ones in 15 minutes = wait */
  var cache = CacheService.getScriptCache(), fails = Number(cache.get('fail_all') || 0);
  if (fails >= 30) return { ok: false, error: 'Too many tries. Wait 15 minutes, then try again.' };
  var st = rows(SH.ST).filter(function (r) { return digits(r.Matricule) === mat; })[0];
  if (!st) {
    cache.put('fail_all', String(fails + 1), 900);
    log(mat, 'unknown matricule');
    return { ok: false, error: 'This matricule is not on the list. Check it on your student card.' };
  }
  return withLock(function () {
    var token = st.Token;
    if (!token) { token = Utilities.getUuid(); setCells(SH.ST, st._row, { Token: token }); }  /* a reload gets the same token */
    setCells(SH.ST, st._row, { LastSeen: new Date() });
    log(mat, 'sign-in');
    return { ok: true, token: token };
  });
}

function evaluationOf(mat) {
  var tabs = String(settings().EvalTabs || '').split(',').map(function (t) { return t.trim(); }).filter(String);
  for (var i = 0; i < tabs.length; i++) {
    var s = ss().getSheetByName(tabs[i]);
    if (!s || s.getLastRow() < 2) continue;
    var v = s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getDisplayValues();
    var head = v[0].map(function (h) { return String(h).trim(); });
    var mc = head.indexOf('Matricule');
    if (mc < 0) continue;
    for (var r = 1; r < v.length; r++) {
      if (digits(v[r][mc]) !== mat) continue;
      var sessions = [], fields = [], seen = {};
      head.forEach(function (h, c) {
        if (!h || /^(matricule|nom|pr[ée]nom)$/i.test(h)) return;
        if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(h)) {
          if (seen[h]) return;              /* a date written twice: the first column counts */
          seen[h] = true;
          sessions.push({ date: h, status: v[r][c] });
        }
        else fields.push({ label: h, value: v[r][c] });
      });
      return { tab: tabs[i], sessions: sessions, fields: fields };
    }
  }
  return null;
}

function mine(name, mat) {
  return rows(name).filter(function (r) { return digits(r.Matricule) === mat; }).map(function (r) {
    return { id: r.Id, time: r.Time, topic: r.Topic, session: r.Session, message: r.Message || r.Reason,
             fileName: r.FileName, status: r.Status || 'Pending', reply: r.Reply, repliedAt: r.RepliedAt };
  }).reverse();
}

function sMe(b) {
  var st = findStudent(b.token);
  if (!st) return { ok: false, error: 'signed-out' };
  var mat = digits(st.Matricule), set = settings();
  return {
    ok: true,
    student: { matricule: mat, lastName: st.LastName, firstName: st.FirstName, group: st.Group },
    evaluation: evaluationOf(mat),
    claims: mine(SH.C, mat),
    absences: mine(SH.A, mat),
    settings: { title: set.Title, claimsOpen: String(set.ClaimsOpen).toLowerCase() === 'yes',
                deadline: set.Deadline, maxFileMB: Number(set.MaxFileMB) || 5 }
  };
}

function saveFile(st, kind, f) {
  if (!f || !f.data) return { name: '', url: '' };
  var set = settings(), max = (Number(set.MaxFileMB) || 5) * 1024 * 1024;
  var ok = ['application/pdf', 'image/jpeg', 'image/png'];
  if (ok.indexOf(f.type) < 0) throw new Error('Send a PDF, JPG or PNG file.');
  var bytes = Utilities.base64Decode(f.data);
  if (bytes.length > max) throw new Error('The file is larger than ' + set.MaxFileMB + ' MB.');
  var ext = f.type === 'application/pdf' ? '.pdf' : f.type === 'image/png' ? '.png' : '.jpg';
  var name = [st.Group, digits(st.Matricule), st.LastName, kind,
              Utilities.formatDate(new Date(), 'Africa/Algiers', 'yyyy-MM-dd HH.mm')].join(' - ') + ext;
  var file = folder().createFile(Utilities.newBlob(bytes, f.type, name));
  return { name: name, url: file.getUrl() };
}

function sClaim(b) {
  var st = findStudent(b.token);
  if (!st) return { ok: false, error: 'signed-out' };
  if (String(settings().ClaimsOpen).toLowerCase() !== 'yes') return { ok: false, error: 'Claims are closed.' };
  var topic = String(b.topic || '').slice(0, 80), msg = String(b.message || '').trim().slice(0, 2000);
  if (!topic || msg.length < 10) return { ok: false, error: 'Choose a topic and explain your claim (10 characters or more).' };
  var file = saveFile(st, 'claim', b.file);
  return withLock(function () {
    var id = 'C' + Date.now().toString(36).toUpperCase();
    append(SH.C, C_COLS, { Id: id, Time: new Date(), Matricule: digits(st.Matricule),
      Name: st.LastName + ' ' + st.FirstName, Group: st.Group, Topic: topic, Message: msg,
      FileName: file.name, FileUrl: file.url, Status: 'Pending' });
    log(digits(st.Matricule), 'claim ' + id);
    return { ok: true, id: id };
  });
}

function sAbsence(b) {
  var st = findStudent(b.token);
  if (!st) return { ok: false, error: 'signed-out' };
  if (String(settings().ClaimsOpen).toLowerCase() !== 'yes') return { ok: false, error: 'Absence notes are closed.' };
  var session = String(b.session || '').slice(0, 40), reason = String(b.reason || '').trim().slice(0, 1000);
  if (!session || reason.length < 5) return { ok: false, error: 'Choose the session and write the reason.' };
  if (!b.file || !b.file.data) return { ok: false, error: 'Add the document that justifies the absence.' };
  var file = saveFile(st, 'absence ' + session.replace(/\//g, '-'), b.file);
  return withLock(function () {
    var id = 'A' + Date.now().toString(36).toUpperCase();
    append(SH.A, A_COLS, { Id: id, Time: new Date(), Matricule: digits(st.Matricule),
      Name: st.LastName + ' ' + st.FirstName, Group: st.Group, Session: session, Reason: reason,
      FileName: file.name, FileUrl: file.url, Status: 'Pending' });
    log(digits(st.Matricule), 'absence note ' + id);
    return { ok: true, id: id };
  });
}

/* ------------------------------------------------------------------ */
/* teacher                                                             */
/* ------------------------------------------------------------------ */

function tState(b) {
  var set = settings();
  var students = rows(SH.ST).map(function (r) {
    return { matricule: digits(r.Matricule), name: r.LastName + ' ' + r.FirstName, group: r.Group,
             signedIn: !!r.Token, lastSeen: r.LastSeen };
  });
  var pick = function (r) {
    return { id: r.Id, time: r.Time, matricule: digits(r.Matricule), name: r.Name, group: r.Group,
             topic: r.Topic, session: r.Session, message: r.Message || r.Reason, fileName: r.FileName,
             fileUrl: r.FileUrl, status: r.Status || 'Pending', reply: r.Reply, repliedAt: r.RepliedAt };
  };
  return { ok: true, settings: set, students: students,
           claims: rows(SH.C).map(pick).reverse(), absences: rows(SH.A).map(pick).reverse() };
}

function tReply(b) {
  var name = b.kind === 'absence' ? SH.A : SH.C;
  var status = STATUS.indexOf(b.status) >= 0 ? b.status : 'Pending';
  return withLock(function () {
    var r = rows(name).filter(function (x) { return x.Id === b.id; })[0];
    if (!r) return { ok: false, error: 'Request not found: ' + b.id };
    setCells(name, r._row, { Status: status, Reply: String(b.reply || '').slice(0, 2000), RepliedAt: new Date() });
    return { ok: true };
  });
}

function tSettings(b) {
  var allowed = ['Title', 'ClaimsOpen', 'Deadline', 'MaxFileMB', 'EvalTabs'];
  return withLock(function () {
    Object.keys(b.values || {}).forEach(function (k) { if (allowed.indexOf(k) >= 0) setSetting(k, b.values[k]); });
    return { ok: true, settings: settings() };
  });
}

function tStudent(b) {
  var mat = digits(b.matricule);
  var st = rows(SH.ST).filter(function (r) { return digits(r.Matricule) === mat; })[0];
  if (!st) return { ok: false, error: 'No student with this matricule' };
  return { ok: true, student: { matricule: mat, name: st.LastName + ' ' + st.FirstName, group: st.Group },
           evaluation: evaluationOf(mat), claims: mine(SH.C, mat), absences: mine(SH.A, mat) };
}
