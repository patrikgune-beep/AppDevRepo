'use strict';
// Import av filer: från uppladdning, från en vald mapp i webbläsaren eller från en mapp på servern
// (t.ex. iCloud Drive). Varje fil identifieras med SHA-256 så att samma faktura aldrig läses in två
// gånger, oavsett filnamn eller hur många gånger användaren trycker "Uppdatera".
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIME_BY_EXT = {
  '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.txt': 'text/plain', '.csv': 'text/csv',
};
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_SCAN_FILES = 5000;
const MAX_DEPTH = 6;

const mimeFromName = (name) => MIME_BY_EXT[path.extname(name).toLowerCase()] || null;

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

// Löser upp en relativ sökväg under root och vägrar allt som hamnar utanför (.., symlänkar).
function resolveInside(root, rel = '') {
  const realRoot = fs.realpathSync(root);
  const target = path.resolve(realRoot, String(rel).replace(/^[/\\]+/, ''));
  let real;
  try { real = fs.realpathSync(target); } catch { const e = new Error('Mappen finns inte'); e.status = 404; throw e; }
  const r = path.relative(realRoot, real);
  if (r.startsWith('..') || path.isAbsolute(r)) { const e = new Error('Mappen ligger utanför tillåten rot'); e.status = 400; throw e; }
  return { abs: real, rel: r.split(path.sep).join('/') };
}

// Undermappar och antal fakturafiler i en mapp (för mappväljaren i appen).
function listFolder(root, rel) {
  const { abs, rel: cleanRel } = resolveInside(root, rel);
  const entries = fs.readdirSync(abs, { withFileTypes: true }).filter((d) => !d.name.startsWith('.'));
  const folders = entries.filter((d) => d.isDirectory()).map((d) => d.name).sort((a, b) => a.localeCompare(b, 'sv'));
  const files = entries.filter((d) => d.isFile() && mimeFromName(d.name)).length;
  return { path: cleanRel, parent: cleanRel ? path.posix.dirname(cleanRel).replace(/^\.$/, '') : null, folders, files };
}

// Alla fakturafiler i en mapp, rekursivt. relPath är relativt den valda mappen.
function scanFolder(absDir) {
  const out = [];
  const walk = (dir, rel, depth) => {
    if (depth > MAX_DEPTH || out.length >= MAX_SCAN_FILES) return;
    for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
      if (d.name.startsWith('.')) continue;
      const abs = path.join(dir, d.name);
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) walk(abs, r, depth + 1);
      else if (d.isFile() && mimeFromName(d.name)) {
        const size = fs.statSync(abs).size;
        if (size > 0 && size <= MAX_FILE_BYTES) out.push({ name: d.name, relPath: r, srcPath: abs, size });
      }
    }
  };
  walk(absDir, '', 0);
  return out;
}

// Grupperingsnyckel: filer i samma undermapp hör ihop (faktura + bilagor), filer direkt i
// huvudmappen är var sitt underlag.
function groupKey(relPath, mode) {
  if (mode === 'together') return '*';
  const parts = String(relPath || '').split('/').filter(Boolean);
  if (mode === 'folders' && parts.length > 1) return `dir:${parts.slice(0, -1).join('/')}`;
  return `file:${relPath}`;
}

/**
 * Importerar filer till ett projekt.
 * files: [{ name, relPath, size, srcPath? (läses/kopieras), tmpPath? (flyttas) }]
 * mode: 'together' | 'separate' | 'folders'
 * Returnerar { submissions: [id], imported, skipped: [namn], ignored: [namn] }.
 */
function importFiles(db, { projectId, files, mode = 'separate', label = null, uploadDir, force = false }) {
  const known = db.prepare(`SELECT 1 FROM files f JOIN submissions s ON s.id = f.submission_id
    WHERE s.project_id = ? AND f.sha256 = ? LIMIT 1`);
  const ignored = db.prepare('SELECT 1 FROM ignored_files WHERE project_id = ? AND sha256 = ?');
  const unignore = db.prepare('DELETE FROM ignored_files WHERE project_id = ? AND sha256 = ?');
  const result = { submissions: [], imported: 0, skipped: [], ignored: [] };
  const seen = new Set();
  const groups = new Map();

  for (const f of files) {
    const mime = mimeFromName(f.name);
    const src = f.tmpPath || f.srcPath;
    const cleanup = () => { if (f.tmpPath) fs.rmSync(f.tmpPath, { force: true }); };
    if (!mime) { result.skipped.push(f.name); cleanup(); continue; }
    const hash = sha256File(src);
    if (seen.has(hash) || known.get(projectId, hash)) { result.skipped.push(f.name); cleanup(); continue; }
    if (ignored.get(projectId, hash)) {
      if (!force) { result.ignored.push(f.name); cleanup(); continue; }
      unignore.run(projectId, hash);
    }
    seen.add(hash);
    // Originalet i användarens mapp rörs aldrig: vi arbetar på en egen kopia.
    const stored = path.join(uploadDir, crypto.randomUUID() + path.extname(f.name).toLowerCase());
    if (f.tmpPath) fs.renameSync(f.tmpPath, stored); else fs.copyFileSync(f.srcPath, stored);
    const key = groupKey(f.relPath || f.name, mode);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...f, mime, hash, stored, size: fs.statSync(stored).size });
  }

  const insSub = db.prepare("INSERT INTO submissions (project_id, label, status) VALUES (?, ?, 'processing')");
  const insFile = db.prepare(`INSERT INTO files (submission_id, original_name, stored_path, mime_type, size_bytes,
    sha256, rel_path) VALUES (?,?,?,?,?,?,?)`);
  for (const [key, group] of groups) {
    const groupLabel = label && mode === 'together' ? label
      : key.startsWith('dir:') ? `${key.slice(4)} (${group.length} ${group.length === 1 ? 'fil' : 'filer'})`
        : group.map((g) => g.relPath || g.name).join(', ');
    const sid = Number(insSub.run(projectId, groupLabel).lastInsertRowid);
    for (const g of group) insFile.run(sid, g.name, g.stored, g.mime, g.size, g.hash, g.relPath || null);
    result.submissions.push(sid);
    result.imported += group.length;
  }
  return result;
}

// Enkel kö så att en första synk med hundra fakturor inte startar hundra AI-anrop samtidigt.
function createQueue(worker, concurrency = 2) {
  const pending = [];
  let running = 0;
  const next = () => {
    while (running < concurrency && pending.length) {
      const id = pending.shift();
      running++;
      Promise.resolve().then(() => worker(id)).catch((e) => console.error('kö', e))
        .finally(() => { running--; next(); });
    }
  };
  return {
    push(ids) { pending.push(...[].concat(ids)); next(); },
    get size() { return pending.length + running; },
  };
}

module.exports = { importFiles, scanFolder, listFolder, resolveInside, sha256File, mimeFromName, createQueue, groupKey };
