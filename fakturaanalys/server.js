'use strict';
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { open, openReadOnly } = require('./src/db');
const { extractSubmission, friendlyError } = require('./src/extract');
const { saveExtraction, reconcile } = require('./src/store');
const { overview, compareUnitPrices, dimensions, buildWhere } = require('./src/analytics');
const { ask } = require('./src/ask');
const { COST_CATEGORIES, TRADES } = require('./src/taxonomy');
const { importFiles, scanFolder, listFolder, resolveInside, mimeFromName, createQueue } = require('./src/importer');
const os = require('os');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'fakturor.db');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PORT = process.env.PORT || 3100;
const APP_PASSWORD = process.env.APP_PASSWORD || '';
// Utan lösenord nås appen bara från den egna datorn. Med lösenord även från mobil/iPad i nätverket.
const HOST = process.env.HOST || (APP_PASSWORD ? '0.0.0.0' : '127.0.0.1');
const ICLOUD = path.join(os.homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs');
// Rotmapp som projektmappar får väljas inom (iCloud Drive om den finns, annars hemkatalogen).
const FAKTURA_ROOT = process.env.FAKTURA_ROOT || (fs.existsSync(ICLOUD) ? ICLOUD : os.homedir());

const db = open(DB_PATH);
const roDb = openReadOnly(DB_PATH);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const TMP_DIR = path.join(DATA_DIR, 'tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: TMP_DIR, filename: (req, file, cb) => cb(null, crypto.randomUUID()) }),
  limits: { fileSize: 25 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, cb) => {
    // multer levererar filnamnet som latin1-avkodade UTF-8-bytes
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, Boolean(mimeFromName(file.originalname)));
  },
});

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---- Inloggning (aktiv när APP_PASSWORD är satt)
const AUTH_TOKEN = APP_PASSWORD
  ? crypto.createHmac('sha256', APP_PASSWORD).update('fakturaanalys-v1').digest('hex') : '';
const cookie = (req, name) => {
  const m = (req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).find(([k]) => k === name);
  return m ? decodeURIComponent(m.slice(1).join('=')) : '';
};
const safeEq = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const isAuthed = (req) => !APP_PASSWORD || safeEq(cookie(req, 'fa_auth'), AUTH_TOKEN);
const loginAttempts = new Map();

app.get('/api/session', (req, res) => res.json({ authRequired: Boolean(APP_PASSWORD), authed: isAuthed(req) }));
app.post('/api/login', (req, res) => {
  const ip = req.ip;
  const a = loginAttempts.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - a.t > 15 * 60 * 1000) { a.n = 0; a.t = Date.now(); }
  if (++a.n > 10) return res.status(429).json({ error: 'För många försök – vänta en stund.' });
  loginAttempts.set(ip, a);
  if (!APP_PASSWORD || !safeEq(String(req.body.password || ''), APP_PASSWORD)) {
    return res.status(401).json({ error: 'Fel lösenord' });
  }
  loginAttempts.delete(ip);
  res.setHeader('Set-Cookie', `fa_auth=${AUTH_TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${90 * 86400}` +
    (req.secure || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''));
  res.json({ ok: true });
});
app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'fa_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ ok: true });
});
app.use('/api', (req, res, next) => (isAuthed(req) ? next() : res.status(401).json({ error: 'Inloggning krävs' })));

const wrap = (fn) => (req, res) => Promise.resolve().then(() => fn(req, res)).catch((e) => {
  console.error(e);
  res.status(e.status && e.status < 500 && !e.headers ? e.status : 500).json({ error: friendlyError(e) });
});
const parseIds = (v) => (v ? String(v).split(',').filter(Boolean).map(Number) : []);
const filtersFrom = (q) => ({
  projectIds: parseIds(q.projects), from: q.from || null, to: q.to || null,
  supplier: q.supplier || null, category: q.category || null, monthBasis: q.monthBasis || 'work',
});

const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
app.get('/api/meta', (req, res) => res.json({
  categories: COST_CATEGORIES, trades: TRADES, aiEnabled: aiEnabled(), folderRoot: path.basename(FAKTURA_ROOT),
  queue: queue.size,
}));

// ---- Projekt
app.get('/api/projects', (req, res) => res.json(db.prepare(`
  SELECT p.*, (SELECT COUNT(*) FROM submissions s WHERE s.project_id = p.id) AS submissions,
    (SELECT ROUND(SUM(effective_amount),2) FROM cost_lines c WHERE c.project_id = p.id) AS total
  FROM projects p ORDER BY p.name`).all()));

app.post('/api/projects', wrap((req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Namn saknas' });
  const r = db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)').run(name, req.body.description || null);
  res.json({ id: Number(r.lastInsertRowid) });
}));

app.delete('/api/projects/:id', wrap((req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(Number(req.params.id));
  res.json({ ok: true });
}));

// ---- Underlag
app.get('/api/projects/:id/submissions', (req, res) => res.json(db.prepare(`
  SELECT s.*, (SELECT GROUP_CONCAT(original_name, ' | ') FROM files f WHERE f.submission_id = s.id) AS files,
    (SELECT ROUND(SUM(effective_amount),2) FROM line_items li JOIN invoices i ON i.id = li.invoice_id
       WHERE i.submission_id = s.id AND li.counted = 1) AS total,
    (SELECT COUNT(*) FROM findings fi WHERE fi.submission_id = s.id AND fi.severity = 'varning') AS warnings
  FROM submissions s WHERE s.project_id = ? ORDER BY s.uploaded_at DESC, s.id DESC`).all(Number(req.params.id))));

// Uppladdning från enheten. mode: together (alla filer = ett underlag), separate (en fil per underlag)
// eller folders (filer i samma undermapp hör ihop; paths = relativa sökvägar från vald mapp).
app.post('/api/projects/:id/submissions', upload.array('files'), wrap(async (req, res) => {
  const tmp = req.files || [];
  const cleanup = () => tmp.forEach((f) => fs.rmSync(f.path, { force: true }));
  const projectId = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM projects WHERE id = ?').get(projectId)) { cleanup(); return res.status(404).json({ error: 'Projektet finns inte' }); }
  if (!aiEnabled()) { cleanup(); return res.status(503).json({ error: 'ANTHROPIC_API_KEY saknas – tolkning är avstängd' }); }
  if (!tmp.length) return res.status(400).json({ error: 'Inga giltiga filer (PDF, bild, txt, csv)' });
  let paths = [];
  try { paths = JSON.parse(req.body.paths || '[]'); } catch { paths = []; }
  const mode = ['together', 'separate', 'folders'].includes(req.body.mode) ? req.body.mode : 'together';
  const r = importFiles(db, {
    projectId, mode, label: req.body.label || null, uploadDir: UPLOAD_DIR, force: req.body.force === '1',
    files: tmp.map((f, i) => ({ name: f.originalname, relPath: paths[i] || f.originalname, tmpPath: f.path, size: f.size })),
  });
  queue.push(r.submissions);
  res.json(r);
}));

// Låter webbläsaren hoppa över filer som redan finns (skickar bara hashar, inte filer).
app.post('/api/projects/:id/known', wrap((req, res) => {
  const projectId = Number(req.params.id);
  const hashes = Array.isArray(req.body.hashes) ? req.body.hashes.slice(0, 10000).map(String) : [];
  const q = db.prepare(`SELECT 1 FROM files f JOIN submissions s ON s.id = f.submission_id WHERE s.project_id = ? AND f.sha256 = ?
    UNION SELECT 1 FROM ignored_files WHERE project_id = ? AND sha256 = ?`);
  res.json({ known: hashes.filter((h) => q.get(projectId, h, projectId, h)) });
}));

// ---- Mappsynk (mapp på servern, t.ex. iCloud Drive som syns i Filer på iPad/iPhone)
app.get('/api/folders', wrap((req, res) => res.json({ root: path.basename(FAKTURA_ROOT), ...listFolder(FAKTURA_ROOT, req.query.path || '') })));

app.put('/api/projects/:id/folder', wrap((req, res) => {
  const id = Number(req.params.id);
  const folder = req.body.clear ? null : resolveInside(FAKTURA_ROOT, req.body.path || '').rel;
  db.prepare('UPDATE projects SET folder_path = ? WHERE id = ?').run(folder, id);
  res.json({ folder_path: folder });
}));

function syncProject(projectId) {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!p || p.folder_path == null) { const e = new Error('Projektet har ingen mapp vald'); e.status = 400; throw e; }
  const { abs } = resolveInside(FAKTURA_ROOT, p.folder_path);
  const files = scanFolder(abs);
  const r = importFiles(db, { projectId, mode: 'folders', uploadDir: UPLOAD_DIR,
    files: files.map((f) => ({ name: f.name, relPath: f.relPath, srcPath: f.srcPath, size: f.size })) });
  db.prepare("UPDATE projects SET last_synced_at = datetime('now') WHERE id = ?").run(projectId);
  queue.push(r.submissions);
  return { project: p.name, scanned: files.length, ...r };
}

app.post('/api/projects/:id/sync', wrap((req, res) => {
  if (!aiEnabled()) return res.status(503).json({ error: 'ANTHROPIC_API_KEY saknas – tolkning är avstängd' });
  res.json(syncProject(Number(req.params.id)));
}));

app.post('/api/sync', wrap((req, res) => {
  if (!aiEnabled()) return res.status(503).json({ error: 'ANTHROPIC_API_KEY saknas – tolkning är avstängd' });
  const ids = db.prepare('SELECT id FROM projects WHERE folder_path IS NOT NULL').all().map((r) => r.id);
  const results = [];
  for (const id of ids) {
    try { results.push(syncProject(id)); } catch (e) { results.push({ projectId: id, error: e.message }); }
  }
  res.json({ results });
}));

async function processSubmission(sid) {
  const s = db.prepare('SELECT s.*, p.name AS project_name FROM submissions s JOIN projects p ON p.id = s.project_id WHERE s.id = ?').get(sid);
  if (!s) return;
  const files = db.prepare('SELECT * FROM files WHERE submission_id = ?').all(sid);
  try {
    const ex = await extractSubmission(files, { projectName: s.project_name });
    saveExtraction(db, sid, s.project_id, ex);
    reconcile(db, s.project_id);
  } catch (e) {
    db.prepare("UPDATE submissions SET status = 'error', error = ? WHERE id = ?").run(friendlyError(e), sid);
  }
}
const queue = createQueue(processSubmission, Number(process.env.EXTRACT_CONCURRENCY) || 2);

app.post('/api/submissions/:id/retry', wrap((req, res) => {
  const sid = Number(req.params.id);
  const s = db.prepare('SELECT * FROM submissions WHERE id = ?').get(sid);
  if (!s) return res.status(404).json({ error: 'Saknas' });
  db.prepare('DELETE FROM invoices WHERE submission_id = ?').run(sid);
  db.prepare('DELETE FROM supporting_docs WHERE submission_id = ?').run(sid);
  db.prepare('DELETE FROM findings WHERE submission_id = ?').run(sid);
  db.prepare("UPDATE submissions SET status = 'processing', error = NULL WHERE id = ?").run(sid);
  res.json({ ok: true });
  queue.push(sid);
}));

app.delete('/api/submissions/:id', wrap((req, res) => {
  const sid = Number(req.params.id);
  const s = db.prepare('SELECT * FROM submissions WHERE id = ?').get(sid);
  if (!s) return res.status(404).json({ error: 'Saknas' });
  const ignore = db.prepare('INSERT OR IGNORE INTO ignored_files (project_id, sha256) VALUES (?, ?)');
  for (const f of db.prepare('SELECT stored_path, sha256 FROM files WHERE submission_id = ?').all(sid)) {
    fs.rmSync(f.stored_path, { force: true });
    // Borttaget underlag ska inte komma tillbaka vid nästa mappsynk.
    if (f.sha256) ignore.run(s.project_id, f.sha256);
  }
  db.prepare('DELETE FROM submissions WHERE id = ?').run(sid);
  reconcile(db, s.project_id);
  res.json({ ok: true });
}));

app.get('/api/submissions/:id', wrap((req, res) => {
  const sid = Number(req.params.id);
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(sid);
  if (!submission) return res.status(404).json({ error: 'Saknas' });
  const invoices = db.prepare('SELECT * FROM invoices WHERE submission_id = ? ORDER BY parent_invoice_id IS NOT NULL, id').all(sid);
  const lines = db.prepare(`SELECT li.* FROM line_items li JOIN invoices i ON i.id = li.invoice_id
    WHERE i.submission_id = ? ORDER BY li.invoice_id, li.line_no`).all(sid);
  for (const inv of invoices) inv.lines = lines.filter((l) => l.invoice_id === inv.id);
  res.json({
    submission,
    files: db.prepare('SELECT id, original_name, mime_type, size_bytes FROM files WHERE submission_id = ?').all(sid),
    invoices,
    supporting: db.prepare('SELECT * FROM supporting_docs WHERE submission_id = ?').all(sid),
    findings: db.prepare('SELECT * FROM findings WHERE submission_id = ? ORDER BY severity DESC, id').all(sid),
  });
}));

app.get('/api/files/:id', wrap((req, res) => {
  const f = db.prepare('SELECT * FROM files WHERE id = ?').get(Number(req.params.id));
  if (!f) return res.status(404).end();
  res.type(f.mime_type);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(f.original_name)}`);
  fs.createReadStream(f.stored_path).pipe(res);
}));

// Manuell rättning av klassificering
app.patch('/api/lines/:id', wrap((req, res) => {
  const id = Number(req.params.id);
  const line = db.prepare('SELECT * FROM line_items WHERE id = ?').get(id);
  if (!line) return res.status(404).json({ error: 'Saknas' });
  const b = req.body;
  if (b.cost_category && !COST_CATEGORIES[b.cost_category]) return res.status(400).json({ error: 'Ogiltig kategori' });
  if (b.trade && !TRADES[b.trade]) return res.status(400).json({ error: 'Ogiltigt yrke' });
  db.prepare(`UPDATE line_items SET cost_category = COALESCE(?, cost_category), trade = ?, material_type = ?,
    unit = COALESCE(?, unit), edited = 1 WHERE id = ?`).run(b.cost_category || null,
    'trade' in b ? b.trade || null : line.trade,
    'material_type' in b ? (b.material_type || '').toLowerCase().trim() || null : line.material_type,
    b.unit || null, id);
  reconcile(db, line.project_id);
  res.json(db.prepare('SELECT * FROM line_items WHERE id = ?').get(id));
}));

// ---- Analys
app.get('/api/analysis/overview', wrap((req, res) => res.json(overview(db, filtersFrom(req.query)))));
app.get('/api/analysis/dimensions', wrap((req, res) => res.json(dimensions(db))));
app.get('/api/analysis/compare', wrap((req, res) => res.json(compareUnitPrices(db, {
  ...filtersFrom(req.query), dimension: req.query.dimension, value: req.query.value, unit: req.query.unit || null,
}))));
app.get('/api/analysis/lines', wrap((req, res) => {
  const w = buildWhere(filtersFrom(req.query));
  res.json(db.prepare(`SELECT * FROM cost_lines ${w.sql} ORDER BY project_name, ${w.monthCol}, line_date LIMIT 2000`)
    .all(...w.params));
}));
app.get('/api/findings', wrap((req, res) => {
  const ids = parseIds(req.query.projects);
  const where = ids.length ? `WHERE f.project_id IN (${ids.map(() => '?').join(',')})` : '';
  res.json(db.prepare(`SELECT f.*, p.name AS project_name FROM findings f JOIN projects p ON p.id = f.project_id
    ${where} ORDER BY f.severity DESC, f.id DESC`).all(...ids));
}));

app.post('/api/ask', wrap(async (req, res) => {
  if (!aiEnabled()) return res.status(503).json({ error: 'ANTHROPIC_API_KEY saknas – fritextfrågor är avstängda' });
  const { question, scope, history } = req.body;
  if (!question) return res.status(400).json({ error: 'Fråga saknas' });
  const scopeF = {
    projectIds: (scope && scope.projectIds) || [], from: scope && scope.from, to: scope && scope.to,
    supplier: scope && scope.supplier, category: scope && scope.category, monthBasis: scope && scope.monthBasis,
  };
  const safeHistory = Array.isArray(history) ? history.filter((m) =>
    (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-8) : [];
  res.json(await ask(db, roDb, { question: String(question), scope: scopeF, history: safeHistory }));
}));

if (require.main === module) {
  // Underlag som avbröts vid omstart markeras så att de kan köras om.
  db.prepare("UPDATE submissions SET status = 'error', error = 'Avbröts (servern startades om)' WHERE status = 'processing'").run();
  app.listen(PORT, HOST, () => {
    console.log(`Fakturaanalys körs på http://localhost:${PORT}`);
    console.log(`Fakturamappar väljs inom: ${FAKTURA_ROOT}`);
    if (HOST === '0.0.0.0') {
      const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal);
      for (const i of ips) console.log(`Från mobil/iPad i samma nätverk: http://${i.address}:${PORT}`);
    } else {
      console.log('Sätt APP_PASSWORD för att kunna öppna appen från mobil/iPad.');
    }
  });
  const minutes = Number(process.env.SYNC_INTERVAL_MIN) || 0;
  if (minutes > 0 && aiEnabled()) {
    setInterval(() => {
      for (const { id } of db.prepare('SELECT id FROM projects WHERE folder_path IS NOT NULL').all()) {
        try { syncProject(id); } catch (e) { console.error('autosynk', e.message); }
      }
    }, minutes * 60 * 1000);
  }
}

module.exports = { app, db };
