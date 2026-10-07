'use strict';
// Appens "backend" – körs helt på enheten. Gränssnittet anropar api('/api/...') precis som mot en
// server, men allt hanteras här: SQLite-databasen, originalfilerna, mappsynk och kön för tolkning.
// Det enda som lämnar enheten är tolkningen och frågorna som skickas till Claude.
const { COST_CATEGORIES, TRADES } = require('./taxonomy');
const { saveExtraction, reconcile } = require('./store');
const { overview, compareUnitPrices, dimensions, buildWhere } = require('./analytics');
const { friendlyError } = require('./extract');
const { createSdkLlm } = require('./llm');
const { saveContract } = require('./contract-extract');
const { runContractChecks, contractFor, buildReviewPrompt, storeReview } = require('./contract-check');
const { importFiles, mimeFromName, isSupported, sha256, createQueue } = require('./importer');
const { loadFixture } = require('./demo');

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/**
 * deps:
 *   db          – databas med node:sqlite-kompatibelt API (sql.js-adapter i appen)
 *   store       – { kvGet, kvSet, blobGet, blobPut, blobDel }
 *   folders     – { folderMode, pickFolder, listFolder, forgetFolder }
 *   llm         – vägen till Claude (src/llm.js); standard: API med nyckel från inställningarna
 *   fixture     – exempeldata för "Läs in exempel"
 *   exportDb / importDb – säkerhetskopia av databasen
 */
function createLocalApi(deps) {
  const { db, store, folders, fixture } = deps;
  const parseIds = (v) => (v ? String(v).split(',').filter(Boolean).map(Number) : []);
  const filtersFrom = (q) => ({
    projectIds: parseIds(q.get('projects')), from: q.get('from') || null, to: q.get('to') || null,
    supplier: q.get('supplier') || null, category: q.get('category') || null, monthBasis: q.get('monthBasis') || 'work',
  });
  const apiKey = async () => (await store.kvGet('apiKey')) || '';
  const llm = deps.llm || createSdkLlm({ getApiKey: apiKey, makeClient: deps.makeClient, toBase64: deps.toBase64 });
  const requireKey = () => llm.ensureReady();
  const project = (id) => {
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(id));
    if (!p) throw httpError(404, 'Projektet finns inte');
    return p;
  };

  // Räknar om avstämning och avtalskontroll för ett projekt
  function refresh(projectId) {
    reconcile(db, projectId);
    runContractChecks(db, projectId);
  }

  // ---- Tolkning (kö)
  async function processSubmission(sid) {
    const s = db.prepare('SELECT s.*, p.name AS project_name FROM submissions s JOIN projects p ON p.id = s.project_id WHERE s.id = ?').get(sid);
    if (!s) return;
    try {
      const rows = db.prepare('SELECT * FROM files WHERE submission_id = ?').all(sid);
      const files = [];
      for (const f of rows) {
        const blob = await store.blobGet(f.sha256);
        if (!blob) throw new Error(`Originalfilen ${f.original_name} saknas på enheten – lägg till den igen.`);
        files.push({ original_name: f.original_name, mime_type: f.mime_type, blob });
      }
      if (s.kind === 'avtal') {
        if (!llm.extractContract) throw new Error('Avtalstolkning stöds inte här.');
        saveContract(db, sid, s.project_id, await llm.extractContract(files, { projectName: s.project_name }));
      } else {
        saveExtraction(db, sid, s.project_id, await llm.extract(files, { projectName: s.project_name }));
      }
      refresh(s.project_id);
    } catch (e) {
      db.prepare("UPDATE submissions SET status = 'error', error = ? WHERE id = ?").run(friendlyError(e), sid);
    }
  }
  const queue = createQueue(processSubmission, deps.concurrency || 2);

  // Underlag som avbröts (appen stängdes under tolkning) körs om automatiskt.
  function resumeInterrupted() {
    const ids = db.prepare("SELECT id FROM submissions WHERE status = 'processing'").all().map((r) => r.id);
    if (ids.length) queue.push(ids);
  }

  // ---- Import från valda filer (File/Blob med name)
  async function importUploaded(projectId, fileList, mode, kind = 'faktura') {
    project(projectId);
    await requireKey();
    const files = [];
    const skipped = [];
    for (const f of fileList) {
      if (!isSupported(f.name)) { skipped.push(f.name); continue; }
      const hash = await sha256(new Uint8Array(await f.arrayBuffer()));
      files.push({ name: f.name, relPath: f.relPath || f.name, size: f.size, hash, blob: f });
    }
    const r = await importFiles(db, {
      projectId: Number(projectId), files, mode, kind,
      saveFile: (hash, file) => store.blobPut(hash, file.blob),
    });
    r.skipped.push(...skipped);
    queue.push(r.submissions);
    return r;
  }

  // ---- Mappsynk
  async function syncProject(projectId) {
    const p = project(projectId);
    if (!p.folder_path) throw httpError(400, 'Projektet har ingen mapp vald');
    await requireKey();
    const listing = await folders.listFolder(p.id);
    const cache = new Map(db.prepare('SELECT * FROM file_index WHERE project_id = ?').all(p.id).map((r) => [r.rel_path, r]));
    const upsert = db.prepare(`INSERT INTO file_index (project_id, rel_path, size, modified, sha256) VALUES (?,?,?,?,?)
      ON CONFLICT(project_id, rel_path) DO UPDATE SET size = excluded.size, modified = excluded.modified, sha256 = excluded.sha256`);
    const files = [];
    for (const f of listing) {
      const c = cache.get(f.path);
      let hash;
      // Oförändrad fil (samma storlek och ändringstid) behöver inte läsas igen.
      if (c && c.size === f.size && c.modified === f.modified) hash = c.sha256;
      else {
        hash = await sha256(await f.read());
        upsert.run(p.id, f.path, f.size, f.modified, hash);
      }
      files.push({ name: f.path.split('/').pop(), relPath: f.path, size: f.size, hash, read: f.read });
    }
    const r = await importFiles(db, {
      projectId: p.id, files, mode: 'folders',
      // Bara nya filer läses en andra gång och sparas på enheten.
      saveFile: async (hash, file) => store.blobPut(hash, new Blob([await file.read()], { type: mimeFromName(file.name) })),
    });
    db.prepare("UPDATE projects SET last_synced_at = datetime('now') WHERE id = ?").run(p.id);
    queue.push(r.submissions);
    return { project: p.name, scanned: listing.length, ...r };
  }

  async function deleteBlobIfUnused(hash) {
    if (!hash) return;
    if (!db.prepare('SELECT 1 FROM files WHERE sha256 = ? LIMIT 1').get(hash)) await store.blobDel(hash);
  }

  // ---- Sparade frågor: varje fråga sparas, samma fråga igen räknas upp i stället för att dubbleras.
  const normQuestion = (t) => t.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[?.!\s]+$/, '');
  function rememberQuestion(text) {
    const clean = text.trim().replace(/\s+/g, ' ');
    const norm = normQuestion(clean);
    db.prepare(`INSERT INTO saved_questions (text, norm, times_asked, last_asked_at) VALUES (?, ?, 1, datetime('now'))
      ON CONFLICT(norm) DO UPDATE SET times_asked = times_asked + 1, last_asked_at = excluded.last_asked_at`)
      .run(clean, norm);
    return db.prepare('SELECT id FROM saved_questions WHERE norm = ?').get(norm).id;
  }

  // ---- Rutter
  const routes = [
    ['GET', /^\/api\/meta$/, async () => ({
      categories: COST_CATEGORIES, trades: TRADES, aiEnabled: await llm.available(), llmMode: llm.mode,
      folderMode: folders.folderMode(), queue: queue.size,
    })],

    ['GET', /^\/api\/projects$/, () => db.prepare(`
      SELECT p.*, (SELECT COUNT(*) FROM submissions s WHERE s.project_id = p.id) AS submissions,
        (SELECT ROUND(SUM(effective_amount),2) FROM cost_lines c WHERE c.project_id = p.id) AS total
      FROM projects p ORDER BY p.name`).all()],

    ['POST', /^\/api\/projects$/, (m, body) => {
      const name = String(body.name || '').trim();
      if (!name) throw httpError(400, 'Namn saknas');
      if (db.prepare('SELECT 1 FROM projects WHERE name = ?').get(name)) throw httpError(400, 'Det finns redan ett projekt med det namnet');
      const r = db.prepare('INSERT INTO projects (name, description) VALUES (?, ?)').run(name, body.description || null);
      return { id: Number(r.lastInsertRowid) };
    }],

    ['DELETE', /^\/api\/projects\/(\d+)$/, async ([, id]) => {
      const hashes = db.prepare(`SELECT f.sha256 FROM files f JOIN submissions s ON s.id = f.submission_id
        WHERE s.project_id = ?`).all(Number(id)).map((r) => r.sha256);
      db.prepare('DELETE FROM projects WHERE id = ?').run(Number(id));
      for (const h of hashes) await deleteBlobIfUnused(h);
      try { await folders.forgetFolder(Number(id)); } catch { /* ingen mapp */ }
      return { ok: true };
    }],

    ['GET', /^\/api\/projects\/(\d+)\/submissions$/, ([, id]) => db.prepare(`
      SELECT s.*, (SELECT GROUP_CONCAT(original_name, ' | ') FROM files f WHERE f.submission_id = s.id) AS files,
        (SELECT ROUND(SUM(effective_amount),2) FROM line_items li JOIN invoices i ON i.id = li.invoice_id
           WHERE i.submission_id = s.id AND li.counted = 1) AS total,
        (SELECT COUNT(*) FROM findings fi WHERE fi.submission_id = s.id AND fi.severity = 'varning') AS warnings
      FROM submissions s WHERE s.project_id = ? ORDER BY s.uploaded_at DESC, s.id DESC`).all(Number(id))],

    ['POST', /^\/api\/projects\/(\d+)\/submissions$/, ([, id], body) =>
      importUploaded(id, body.files || [], ['together', 'separate', 'folders'].includes(body.mode) ? body.mode : 'separate',
        body.kind === 'avtal' ? 'avtal' : 'faktura')],

    ['POST', /^\/api\/projects\/(\d+)\/folder$/, async ([, id]) => {
      project(id);
      const r = await folders.pickFolder(Number(id));
      db.prepare('UPDATE projects SET folder_path = ? WHERE id = ?').run(r.name, Number(id));
      return { folder_path: r.name };
    }],

    ['DELETE', /^\/api\/projects\/(\d+)\/folder$/, async ([, id]) => {
      await folders.forgetFolder(Number(id));
      db.prepare('UPDATE projects SET folder_path = NULL WHERE id = ?').run(Number(id));
      db.prepare('DELETE FROM file_index WHERE project_id = ?').run(Number(id));
      return { ok: true };
    }],

    ['POST', /^\/api\/projects\/(\d+)\/sync$/, ([, id]) => syncProject(id)],

    ['POST', /^\/api\/sync$/, async () => {
      const results = [];
      for (const { id, name } of db.prepare('SELECT id, name FROM projects WHERE folder_path IS NOT NULL').all()) {
        try { results.push(await syncProject(id)); } catch (e) { results.push({ project: name, error: e.message }); }
      }
      return { results };
    }],

    ['POST', /^\/api\/submissions\/(\d+)\/retry$/, async ([, sid]) => {
      await requireKey();
      db.prepare('DELETE FROM invoices WHERE submission_id = ?').run(Number(sid));
      db.prepare('DELETE FROM supporting_docs WHERE submission_id = ?').run(Number(sid));
      db.prepare('DELETE FROM findings WHERE submission_id = ?').run(Number(sid));
      db.prepare('DELETE FROM contract_terms WHERE submission_id = ?').run(Number(sid));
      db.prepare("UPDATE submissions SET status = 'processing', error = NULL WHERE id = ?").run(Number(sid));
      queue.push(Number(sid));
      return { ok: true };
    }],

    ['DELETE', /^\/api\/submissions\/(\d+)$/, async ([, sid]) => {
      const s = db.prepare('SELECT * FROM submissions WHERE id = ?').get(Number(sid));
      if (!s) throw httpError(404, 'Saknas');
      const hashes = db.prepare('SELECT sha256 FROM files WHERE submission_id = ?').all(s.id).map((r) => r.sha256);
      // Borttaget underlag ska inte komma tillbaka vid nästa uppdatering från mappen.
      for (const h of hashes) db.prepare('INSERT OR IGNORE INTO ignored_files (project_id, sha256) VALUES (?, ?)').run(s.project_id, h);
      db.prepare('DELETE FROM submissions WHERE id = ?').run(s.id);
      for (const h of hashes) await deleteBlobIfUnused(h);
      refresh(s.project_id);
      return { ok: true };
    }],

    ['GET', /^\/api\/submissions\/(\d+)$/, ([, sid]) => {
      const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(Number(sid));
      if (!submission) throw httpError(404, 'Saknas');
      const invoices = db.prepare('SELECT * FROM invoices WHERE submission_id = ? ORDER BY parent_invoice_id IS NOT NULL, id').all(submission.id);
      const lines = db.prepare(`SELECT li.* FROM line_items li JOIN invoices i ON i.id = li.invoice_id
        WHERE i.submission_id = ? ORDER BY li.invoice_id, li.line_no`).all(submission.id);
      for (const inv of invoices) inv.lines = lines.filter((l) => l.invoice_id === inv.id);
      return {
        submission,
        files: db.prepare('SELECT id, original_name, mime_type, size_bytes FROM files WHERE submission_id = ?').all(submission.id),
        invoices,
        supporting: db.prepare('SELECT * FROM supporting_docs WHERE submission_id = ?').all(submission.id),
        findings: db.prepare('SELECT * FROM findings WHERE submission_id = ? ORDER BY severity DESC, id').all(submission.id),
        contractDocs: db.prepare('SELECT * FROM contract_terms WHERE submission_id = ?').all(submission.id).map((t) => ({
          ...t,
          rates: db.prepare('SELECT * FROM contract_rates WHERE terms_id = ? ORDER BY id').all(t.id),
          clauses: db.prepare('SELECT * FROM contract_clauses WHERE terms_id = ? ORDER BY id').all(t.id),
        })),
        lineFindings: db.prepare(`SELECT f.line_id, f.check_type, f.title, f.amount, f.source FROM review_findings f
          JOIN line_items li ON li.id = f.line_id JOIN invoices i ON i.id = li.invoice_id WHERE i.submission_id = ?`).all(submission.id),
      };
    }],

    // Originalfilen som Blob (gränssnittet öppnar den)
    ['GET', /^\/api\/files\/(\d+)$/, async ([, id]) => {
      const f = db.prepare('SELECT * FROM files WHERE id = ?').get(Number(id));
      if (!f) throw httpError(404, 'Saknas');
      const blob = await store.blobGet(f.sha256);
      if (!blob) throw httpError(404, 'Originalfilen finns inte på enheten');
      return { name: f.original_name, blob };
    }],

    ['PATCH', /^\/api\/lines\/(\d+)$/, ([, id], b) => {
      const line = db.prepare('SELECT * FROM line_items WHERE id = ?').get(Number(id));
      if (!line) throw httpError(404, 'Saknas');
      if (b.cost_category && !COST_CATEGORIES[b.cost_category]) throw httpError(400, 'Ogiltig kategori');
      if (b.trade && !TRADES[b.trade]) throw httpError(400, 'Ogiltigt yrke');
      db.prepare(`UPDATE line_items SET cost_category = COALESCE(?, cost_category), trade = ?, material_type = ?,
        unit = COALESCE(?, unit), edited = 1 WHERE id = ?`).run(b.cost_category || null,
        'trade' in b ? b.trade || null : line.trade,
        'material_type' in b ? (b.material_type || '').toLowerCase().trim() || null : line.material_type,
        b.unit || null, line.id);
      refresh(line.project_id);
      return db.prepare('SELECT * FROM line_items WHERE id = ?').get(line.id);
    }],

    // ---- Avtal och avtalskontroll
    ['GET', /^\/api\/projects\/(\d+)\/contract$/, ([, id]) => {
      const pid = Number(project(id).id);
      const c = contractFor(db, pid);
      const findings = db.prepare(`SELECT f.*, i.invoice_number, li.description AS line_description FROM review_findings f
        LEFT JOIN invoices i ON i.id = f.invoice_id LEFT JOIN line_items li ON li.id = f.line_id
        WHERE f.project_id = ? ORDER BY f.severity DESC, f.amount DESC NULLS LAST, f.id`).all(pid);
      const reviewAt = db.prepare('SELECT value FROM settings WHERE key = ?').get(`review_at:${pid}`);
      return {
        docs: c ? c.docs : [], rates: c ? c.rates : [], clauses: c ? c.clauses : [],
        summary: c ? { counterparty: c.counterparty, contract_form: c.contract_form, fixed_price: c.fixed_price.value,
          markup_ue_pct: c.markup_ue_pct.value, markup_material_pct: c.markup_material_pct.value, payment_days: c.payment_days.value,
          ata_requires_written_order: c.ata_requires_written_order } : null,
        findings, review_at: reviewAt ? reviewAt.value : null,
        dismissed: db.prepare('SELECT COUNT(*) n FROM review_dismissed WHERE project_id = ?').get(pid).n,
      };
    }],
    ['POST', /^\/api\/projects\/(\d+)\/review$/, async ([, id]) => {
      const pid = Number(project(id).id);
      await requireKey();
      if (!llm.review) throw httpError(400, 'Granskning stöds inte här.');
      runContractChecks(db, pid);
      const prompt = buildReviewPrompt(db, pid);
      if (!prompt) throw httpError(400, 'Lägg till kontrakt, offert eller bilagor först.');
      const n = storeReview(db, pid, await llm.review(prompt));
      return { findings: n };
    }],
    ['POST', /^\/api\/review-findings\/(\d+)\/dismiss$/, ([, id]) => {
      const f = db.prepare('SELECT * FROM review_findings WHERE id = ?').get(Number(id));
      if (!f) throw httpError(404, 'Saknas');
      db.prepare('INSERT OR IGNORE INTO review_dismissed (project_id, dedupe_key) VALUES (?, ?)').run(f.project_id, f.dedupe_key);
      db.prepare('DELETE FROM review_findings WHERE id = ?').run(f.id);
      return { ok: true };
    }],
    ['POST', /^\/api\/projects\/(\d+)\/review\/restore$/, ([, id]) => {
      db.prepare('DELETE FROM review_dismissed WHERE project_id = ?').run(Number(id));
      runContractChecks(db, Number(id));
      return { ok: true };
    }],
    ['PATCH', /^\/api\/contract-rates\/(\d+)$/, ([, id], b) => {
      const r = db.prepare('SELECT * FROM contract_rates WHERE id = ?').get(Number(id));
      if (!r) throw httpError(404, 'Saknas');
      if (b.trade && !TRADES[b.trade]) throw httpError(400, 'Ogiltigt yrke');
      const price = b.unit_price === '' || b.unit_price == null ? null : Number(String(b.unit_price).replace(/\s/g, '').replace(',', '.'));
      if (price != null && !Number.isFinite(price)) throw httpError(400, 'Ogiltigt pris');
      db.prepare(`UPDATE contract_rates SET description = ?, unit = ?, unit_price = ?, trade = ?, material_type = ?, edited = 1 WHERE id = ?`)
        .run(String(b.description || r.description), b.unit || null, price, b.trade || null, (b.material_type || '').toLowerCase().trim() || null, r.id);
      runContractChecks(db, r.project_id);
      return { ok: true };
    }],
    ['DELETE', /^\/api\/contract-rates\/(\d+)$/, ([, id]) => {
      const r = db.prepare('SELECT * FROM contract_rates WHERE id = ?').get(Number(id));
      if (!r) throw httpError(404, 'Saknas');
      db.prepare('DELETE FROM contract_rates WHERE id = ?').run(r.id);
      runContractChecks(db, r.project_id);
      return { ok: true };
    }],

    ['GET', /^\/api\/analysis\/overview$/, (m, b, q) => overview(db, filtersFrom(q))],
    ['GET', /^\/api\/analysis\/dimensions$/, () => dimensions(db)],
    ['GET', /^\/api\/analysis\/compare$/, (m, b, q) => compareUnitPrices(db, {
      ...filtersFrom(q), dimension: q.get('dimension'), value: q.get('value'), unit: q.get('unit') || null,
    })],
    ['GET', /^\/api\/analysis\/lines$/, (m, b, q) => {
      const w = buildWhere(filtersFrom(q));
      return db.prepare(`SELECT * FROM cost_lines ${w.sql} ORDER BY project_name, ${w.monthCol}, line_date LIMIT 2000`).all(...w.params);
    }],
    ['GET', /^\/api\/findings$/, (m, b, q) => {
      const ids = parseIds(q.get('projects'));
      const where = ids.length ? `WHERE f.project_id IN (${ids.map(() => '?').join(',')})` : '';
      return db.prepare(`SELECT f.*, p.name AS project_name FROM findings f JOIN projects p ON p.id = f.project_id
        ${where} ORDER BY f.severity DESC, f.id DESC`).all(...ids);
    }],

    ['POST', /^\/api\/ask$/, async (m, body) => {
      await requireKey();
      if (!body.question) throw httpError(400, 'Fråga saknas');
      const qid = rememberQuestion(String(body.question));
      const scope = body.scope || {};
      const history = Array.isArray(body.history) ? body.history.filter((x) =>
        (x.role === 'user' || x.role === 'assistant') && typeof x.content === 'string').slice(-8) : [];
      const result = await llm.ask(db, { question: String(body.question), scope, history });
      db.prepare('UPDATE saved_questions SET last_answer = ? WHERE id = ?').run(result.answer, qid);
      return { ...result, questionId: qid };
    }],

    ['GET', /^\/api\/questions$/, () => db.prepare(`SELECT id, text, favorite, times_asked, last_asked_at, last_answer
      FROM saved_questions ORDER BY favorite DESC, last_asked_at DESC LIMIT 100`).all()],
    ['PATCH', /^\/api\/questions\/(\d+)$/, ([, id], body) => {
      db.prepare('UPDATE saved_questions SET favorite = ? WHERE id = ?').run(body.favorite ? 1 : 0, Number(id));
      return { ok: true };
    }],
    ['DELETE', /^\/api\/questions\/(\d+)$/, ([, id]) => {
      db.prepare('DELETE FROM saved_questions WHERE id = ?').run(Number(id));
      return { ok: true };
    }],

    // ---- Inställningar, exempel och säkerhetskopia
    ['GET', /^\/api\/settings$/, async () => {
      const key = await apiKey();
      return { hasApiKey: Boolean(key), apiKeyHint: key ? `…${key.slice(-4)}` : '', llmMode: llm.mode };
    }],
    ['PUT', /^\/api\/settings$/, async (m, body) => {
      if ('apiKey' in body) await store.kvSet('apiKey', String(body.apiKey || '').trim());
      return { ok: true };
    }],
    ['POST', /^\/api\/demo$/, () => ({ id: loadFixture(db, fixture) })],
    ['GET', /^\/api\/backup$/, async () => deps.exportDb()],
    ['POST', /^\/api\/restore$/, async (m, body) => deps.importDb(body.bytes)],
  ];

  async function api(path, opts = {}) {
    const method = (opts.method || 'GET').toUpperCase();
    const url = new URL(path, 'http://app.local');
    let body = opts.body || {};
    if (typeof body === 'string') body = JSON.parse(body);
    for (const [m, re, handler] of routes) {
      if (m !== method) continue;
      const match = url.pathname.match(re);
      if (match) return handler(match, body, url.searchParams);
    }
    throw httpError(404, `Okänd funktion: ${method} ${url.pathname}`);
  }

  // Alternativ när tolkning inte får starta av sig själv: markera för "Kör om".
  function markInterrupted() {
    db.prepare("UPDATE submissions SET status = 'error', error = 'Avbröts när appen stängdes – tryck Kör om.' WHERE status = 'processing'").run();
  }

  // Räknar om alla projekt (vid start), så att rättningar i avstämningen gäller även redan inläst data.
  function refreshAll() {
    for (const { id } of db.prepare('SELECT id FROM projects').all()) {
      try { refresh(id); } catch (e) { console.error('refresh', id, e); }
    }
  }

  return { api, queue, resumeInterrupted, markInterrupted, refreshAll, syncProject, processSubmission };
}

module.exports = { createLocalApi };
