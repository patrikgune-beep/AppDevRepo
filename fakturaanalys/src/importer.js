'use strict';
// Import av fakturafiler till ett projekt. Varje fil identifieras med SHA-256 av innehållet, så
// samma faktura läses aldrig in två gånger – oavsett filnamn eller hur ofta man trycker Uppdatera.
// Ren logik utan filsystem: själva filerna sparas av den som anropar (saveFile).

const MIME_BY_EXT = {
  pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', txt: 'text/plain', csv: 'text/csv',
};
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const mimeFromName = (name) => MIME_BY_EXT[String(name).split('.').pop().toLowerCase()] || null;
const isSupported = (name) => !String(name).split('/').pop().startsWith('.') && Boolean(mimeFromName(name));

async function sha256(bytes) {
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Filer i samma undermapp hör ihop (faktura + bilagor); filer direkt i mappen är var sitt underlag.
function groupKey(relPath, mode) {
  if (mode === 'together') return '*';
  const parts = String(relPath || '').split('/').filter(Boolean);
  if (mode === 'folders' && parts.length > 1) return `dir:${parts.slice(0, -1).join('/')}`;
  return `file:${relPath}`;
}

function isKnown(db, projectId, hash) {
  return Boolean(db.prepare(`SELECT 1 FROM files f JOIN submissions s ON s.id = f.submission_id
    WHERE s.project_id = ? AND f.sha256 = ? LIMIT 1`).get(projectId, hash));
}
function isIgnored(db, projectId, hash) {
  return Boolean(db.prepare('SELECT 1 FROM ignored_files WHERE project_id = ? AND sha256 = ?').get(projectId, hash));
}

/**
 * files: [{ name, relPath, hash, size, getBytes?: () => Promise<Uint8Array|Blob> }]
 * mode: 'separate' | 'together' | 'folders'
 * saveFile(hash, file): sparar originalet på enheten (anropas bara för nya filer).
 * Returnerar { submissions: [id], imported, skipped: [namn], ignored: [namn] }.
 */
// En undermapp som heter t.ex. "Avtal", "Kontrakt" eller "Offert" innehåller avtalsunderlag.
const CONTRACT_FOLDER = /(^|\/)[^/]*(avtal|kontrakt|offert|ue-?avtal|prislista)[^/]*\//i;
const kindFromPath = (relPath) => (CONTRACT_FOLDER.test(String(relPath || '')) ? 'avtal' : 'faktura');

async function importFiles(db, { projectId, files, mode = 'separate', label = null, force = false, saveFile, kind = null }) {
  const result = { submissions: [], imported: 0, skipped: [], ignored: [] };
  const seen = new Set();
  const groups = new Map();
  for (const f of files) {
    const mime = mimeFromName(f.name);
    if (!mime || f.size > MAX_FILE_BYTES) { result.skipped.push(f.name); continue; }
    if (seen.has(f.hash) || isKnown(db, projectId, f.hash)) { result.skipped.push(f.name); continue; }
    if (isIgnored(db, projectId, f.hash)) {
      if (!force) { result.ignored.push(f.name); continue; }
      db.prepare('DELETE FROM ignored_files WHERE project_id = ? AND sha256 = ?').run(projectId, f.hash);
    }
    seen.add(f.hash);
    if (saveFile) await saveFile(f.hash, f);
    const fileKind = kind || (mode === 'folders' ? kindFromPath(f.relPath) : 'faktura');
    const key = `${fileKind}|${groupKey(f.relPath || f.name, mode)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...f, mime, kind: fileKind });
  }

  const insSub = db.prepare("INSERT INTO submissions (project_id, label, status, kind) VALUES (?, ?, 'processing', ?)");
  const insFile = db.prepare(`INSERT INTO files (submission_id, original_name, stored_path, mime_type, size_bytes,
    sha256, rel_path) VALUES (?,?,?,?,?,?,?)`);
  for (const [fullKey, group] of groups) {
    const key = fullKey.slice(fullKey.indexOf('|') + 1);
    const groupLabel = label && mode === 'together' ? label
      : key.startsWith('dir:') ? `${key.slice(4)} (${group.length} ${group.length === 1 ? 'fil' : 'filer'})`
        : group.map((g) => g.relPath || g.name).join(', ');
    const sid = Number(insSub.run(projectId, groupLabel, group[0].kind).lastInsertRowid);
    for (const g of group) insFile.run(sid, g.name, `blob:${g.hash}`, g.mime, g.size, g.hash, g.relPath || null);
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

module.exports = { kindFromPath, importFiles, groupKey, mimeFromName, isSupported, sha256, createQueue, MAX_FILE_BYTES };
