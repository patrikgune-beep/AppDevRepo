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

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'fakturor.db');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PORT = process.env.PORT || 3100;

const db = open(DB_PATH);
const roDb = openReadOnly(DB_PATH);
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = {
  'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp',
  'text/plain': '.txt', 'text/csv': '.csv',
};
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + (ALLOWED[file.mimetype] || '')),
  }),
  limits: { fileSize: 25 * 1024 * 1024, files: 30 },
  fileFilter: (req, file, cb) => cb(null, Boolean(ALLOWED[file.mimetype])),
});

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(e.status && e.status < 500 && !e.headers ? e.status : 500).json({ error: friendlyError(e) });
});
const parseIds = (v) => (v ? String(v).split(',').filter(Boolean).map(Number) : []);
const filtersFrom = (q) => ({
  projectIds: parseIds(q.projects), from: q.from || null, to: q.to || null,
  supplier: q.supplier || null, category: q.category || null, monthBasis: q.monthBasis || 'work',
});

const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
app.get('/api/meta', (req, res) => res.json({ categories: COST_CATEGORIES, trades: TRADES, aiEnabled: aiEnabled() }));

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

app.post('/api/projects/:id/submissions', upload.array('files'), wrap(async (req, res) => {
  const projectId = Number(req.params.id);
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(404).json({ error: 'Projektet finns inte' });
  if (!aiEnabled()) {
    for (const f of req.files || []) fs.rmSync(f.path, { force: true });
    return res.status(503).json({ error: 'ANTHROPIC_API_KEY saknas – tolkning är avstängd' });
  }
  if (!req.files || !req.files.length) return res.status(400).json({ error: 'Inga giltiga filer (PDF, bild, txt, csv)' });
  // multer levererar filnamnet som latin1-avkodade UTF-8-bytes
  for (const f of req.files) f.originalname = Buffer.from(f.originalname, 'latin1').toString('utf8');
  const label = req.body.label || req.files.map((f) => f.originalname).join(', ');
  const sid = Number(db.prepare("INSERT INTO submissions (project_id, label, status) VALUES (?, ?, 'processing')")
    .run(projectId, label).lastInsertRowid);
  const ins = db.prepare('INSERT INTO files (submission_id, original_name, stored_path, mime_type, size_bytes) VALUES (?,?,?,?,?)');
  for (const f of req.files) ins.run(sid, f.originalname, f.path, f.mimetype, f.size);
  res.json({ id: sid, status: 'processing' });
  processSubmission(sid).catch((e) => console.error('processSubmission', e));
}));

async function processSubmission(sid) {
  const s = db.prepare('SELECT s.*, p.name AS project_name FROM submissions s JOIN projects p ON p.id = s.project_id WHERE s.id = ?').get(sid);
  const files = db.prepare('SELECT * FROM files WHERE submission_id = ?').all(sid);
  try {
    const ex = await extractSubmission(files, { projectName: s.project_name });
    saveExtraction(db, sid, s.project_id, ex);
    reconcile(db, s.project_id);
  } catch (e) {
    db.prepare("UPDATE submissions SET status = 'error', error = ? WHERE id = ?").run(friendlyError(e), sid);
  }
}

app.post('/api/submissions/:id/retry', wrap((req, res) => {
  const sid = Number(req.params.id);
  const s = db.prepare('SELECT * FROM submissions WHERE id = ?').get(sid);
  if (!s) return res.status(404).json({ error: 'Saknas' });
  db.prepare('DELETE FROM invoices WHERE submission_id = ?').run(sid);
  db.prepare('DELETE FROM supporting_docs WHERE submission_id = ?').run(sid);
  db.prepare('DELETE FROM findings WHERE submission_id = ?').run(sid);
  db.prepare("UPDATE submissions SET status = 'processing', error = NULL WHERE id = ?").run(sid);
  res.json({ ok: true });
  processSubmission(sid).catch((e) => console.error(e));
}));

app.delete('/api/submissions/:id', wrap((req, res) => {
  const sid = Number(req.params.id);
  const s = db.prepare('SELECT * FROM submissions WHERE id = ?').get(sid);
  if (!s) return res.status(404).json({ error: 'Saknas' });
  for (const f of db.prepare('SELECT stored_path FROM files WHERE submission_id = ?').all(sid)) {
    fs.rmSync(f.stored_path, { force: true });
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
  app.listen(PORT, () => console.log(`Fakturaanalys körs på http://localhost:${PORT}`));
}

module.exports = { app, db };
