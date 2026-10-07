'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { open } = require('../src/db');
const { importFiles, scanFolder, resolveInside } = require('../src/importer');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'fa-sync-'));
function makeTree(root) {
  fs.mkdirSync(path.join(root, 'Projekt A', 'Faktura 132387'), { recursive: true });
  fs.writeFileSync(path.join(root, 'Projekt A', 'enkel.pdf'), '%PDF-1 enkel');
  fs.writeFileSync(path.join(root, 'Projekt A', 'Faktura 132387', 'huvud.pdf'), '%PDF-1 huvud');
  fs.writeFileSync(path.join(root, 'Projekt A', 'Faktura 132387', 'bilaga.jpg'), 'jpgdata');
  fs.writeFileSync(path.join(root, 'Projekt A', 'anteckning.docx'), 'ignoreras');
  fs.writeFileSync(path.join(root, 'Projekt A', '.dold.pdf'), 'ignoreras');
}

test('mappsynk: undermapp = ett underlag, lösa filer = egna underlag, andra gången inget nytt', () => {
  const root = tmp(); makeTree(root);
  const db = open(path.join(tmp(), 'db.sqlite'));
  const up = tmp();
  const pid = Number(db.prepare("INSERT INTO projects (name) VALUES ('A')").run().lastInsertRowid);
  const files = scanFolder(path.join(root, 'Projekt A'));
  assert.equal(files.length, 3);
  const r1 = importFiles(db, { projectId: pid, mode: 'folders', uploadDir: up, files });
  assert.equal(r1.imported, 3);
  assert.equal(r1.submissions.length, 2);
  const grouped = db.prepare(`SELECT COUNT(*) c FROM files GROUP BY submission_id ORDER BY c DESC`).all();
  assert.deepEqual(grouped.map((g) => g.c), [2, 1]);
  // originalen finns kvar orörda
  assert.ok(fs.existsSync(path.join(root, 'Projekt A', 'enkel.pdf')));

  const r2 = importFiles(db, { projectId: pid, mode: 'folders', uploadDir: up, files: scanFolder(path.join(root, 'Projekt A')) });
  assert.equal(r2.imported, 0);
  assert.equal(r2.skipped.length, 3);

  // ny fil, även med ett namn som redan finns i en annan mapp, läses in
  fs.writeFileSync(path.join(root, 'Projekt A', 'ny.pdf'), '%PDF-1 ny faktura');
  const r3 = importFiles(db, { projectId: pid, mode: 'folders', uploadDir: up, files: scanFolder(path.join(root, 'Projekt A')) });
  assert.equal(r3.imported, 1);
});

test('borttagen fil kommer inte tillbaka vid synk, men kan laddas upp med force', () => {
  const root = tmp(); makeTree(root);
  const db = open(path.join(tmp(), 'db.sqlite'));
  const up = tmp();
  const pid = Number(db.prepare("INSERT INTO projects (name) VALUES ('A')").run().lastInsertRowid);
  importFiles(db, { projectId: pid, mode: 'folders', uploadDir: up, files: scanFolder(path.join(root, 'Projekt A')) });
  const f = db.prepare("SELECT * FROM files WHERE original_name = 'enkel.pdf'").get();
  db.prepare('INSERT INTO ignored_files (project_id, sha256) VALUES (?, ?)').run(pid, f.sha256);
  db.prepare('DELETE FROM submissions WHERE id = ?').run(f.submission_id);
  const r = importFiles(db, { projectId: pid, mode: 'folders', uploadDir: up, files: scanFolder(path.join(root, 'Projekt A')) });
  assert.deepEqual(r.ignored, ['enkel.pdf']);
  const forced = importFiles(db, { projectId: pid, mode: 'separate', uploadDir: up, force: true,
    files: [{ name: 'enkel.pdf', srcPath: path.join(root, 'Projekt A', 'enkel.pdf') }] });
  assert.equal(forced.imported, 1);
});

test('mappar utanför roten nekas', () => {
  const root = tmp(); makeTree(root);
  assert.equal(resolveInside(root, 'Projekt A').rel, 'Projekt A');
  assert.throws(() => resolveInside(root, '../'));
  assert.throws(() => resolveInside(root, '/etc'), /utanför|finns inte/);
  fs.symlinkSync('/etc', path.join(root, 'länk'));
  assert.throws(() => resolveInside(root, 'länk'), /utanför/);
});

test('API: lösenord krävs, mappval och synk fungerar', async () => {
  const root = tmp(); makeTree(root);
  process.env.DATA_DIR = tmp();
  process.env.FAKTURA_ROOT = root;
  process.env.APP_PASSWORD = 'hemligt';
  process.env.ANTHROPIC_API_KEY = 'test';
  process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9'; // inga riktiga AI-anrop i testet
  process.env.EXTRACT_CONCURRENCY = '1';
  const { app } = require('../server');
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/projects`)).status, 401);
    assert.equal((await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'fel' }) })).status, 401);
    const login = await fetch(`${base}/api/login`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: 'hemligt' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const h = { cookie, 'content-type': 'application/json' };
    const call = async (method, url, body) => {
      const r = await fetch(base + url, { method, headers: h, body: body && JSON.stringify(body) });
      return { status: r.status, body: await r.json() };
    };
    const { body: proj } = await call('POST', '/api/projects', { name: 'A' });
    const folders = await call('GET', '/api/folders?path=');
    assert.deepEqual(folders.body.folders, ['Projekt A']);
    assert.equal((await call('GET', '/api/folders?path=..')).status, 400);
    assert.equal((await call('PUT', `/api/projects/${proj.id}/folder`, { path: 'Projekt A' })).body.folder_path, 'Projekt A');
    const s1 = await call('POST', `/api/projects/${proj.id}/sync`);
    assert.equal(s1.body.imported, 3);
    const s2 = await call('POST', '/api/sync');
    assert.equal(s2.body.results[0].imported, 0);

    // uppladdning från enhet: samma fil igen ger inget nytt
    const fd = new FormData();
    fd.append('mode', 'separate');
    fd.append('files', new Blob([fs.readFileSync(path.join(root, 'Projekt A', 'enkel.pdf'))], { type: 'application/pdf' }), 'Kopia av enkel ÄTA.pdf');
    fd.append('files', new Blob(['%PDF-1 helt ny']), 'Faktura ÄTA2.pdf');
    const up = await fetch(`${base}/api/projects/${proj.id}/submissions`, { method: 'POST', headers: { cookie }, body: fd });
    const upBody = await up.json();
    assert.equal(upBody.imported, 1);
    assert.deepEqual(upBody.skipped, ['Kopia av enkel ÄTA.pdf']);
    const subs = await call('GET', `/api/projects/${proj.id}/submissions`);
    assert.ok(subs.body.some((s) => s.label === 'Faktura ÄTA2.pdf'));
  } finally {
    server.close();
  }
});
