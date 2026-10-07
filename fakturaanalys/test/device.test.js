'use strict';
// Testar appens lokala motor med samma SQLite-motor (sql.js) som körs på iPhone/iPad.
// Enhetens lagring, mappen i Filer och Claude ersätts med fejkade versioner.
const test = require('node:test');
const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');
const { adapt } = require('../src/sqljs-adapter');
const { init } = require('../src/schema');
const { createLocalApi } = require('../src/local-api');
const fixture = require('../fixtures/karlavagen71.json');

function memoryStore() {
  const kv = new Map();
  const blobs = new Map();
  return {
    kv, blobs,
    kvGet: async (k) => kv.get(k), kvSet: async (k, v) => { kv.set(k, v); }, kvDel: async (k) => { kv.delete(k); },
    blobGet: async (h) => blobs.get(h), blobPut: async (h, b) => { blobs.set(h, b); }, blobDel: async (h) => { blobs.delete(h); },
  };
}

// Fejkad mapp i Filer: { 'relativ/sökväg.pdf': { text, modified } }
function fakeFolders(tree) {
  const reads = [];
  return {
    reads,
    folderMode: () => 'native',
    pickFolder: async () => ({ name: 'Fakturor Karlavägen' }),
    forgetFolder: async () => {},
    listFolder: async () => Object.entries(tree).map(([p, f]) => ({
      path: p, size: Buffer.byteLength(f.text), modified: f.modified,
      read: async () => { reads.push(p); return new Uint8Array(Buffer.from(f.text)); },
    })),
  };
}

// Fejkad Claude: svarar med tolkningen ur exemplet för fakturan, och räknar anropen.
function fakeClaude() {
  const calls = [];
  const client = { beta: { messages: { stream: (params) => {
    calls.push(params);
    const names = params.messages[0].content.filter((b) => b.type === 'text' && b.text.startsWith('Fil:')).map((b) => b.text);
    const ex = names.some((n) => n.includes('132370')) ? fixture.submissions[0].extraction : fixture.submissions[1].extraction;
    return { finalMessage: async () => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(ex) }] }) };
  } } } };
  return { calls, makeClient: (key) => { assert.equal(key, 'sk-test'); return client; } };
}

const toBase64 = async (blob) => Buffer.from(await blob.arrayBuffer()).toString('base64');
const waitIdle = async (local) => { while (local.queue.size) await new Promise((r) => setTimeout(r, 5)); };

async function setup(tree) {
  const SQL = await initSqlJs();
  const db = adapt(new SQL.Database());
  init(db);
  const store = memoryStore();
  const folders = fakeFolders(tree);
  const claude = fakeClaude();
  const local = createLocalApi({ db, store, folders, toBase64, fixture, makeClient: claude.makeClient, concurrency: 1 });
  await local.api('/api/settings', { method: 'PUT', body: { apiKey: 'sk-test' } });
  return { db, store, folders, claude, local, api: local.api };
}

test('välj mapp + Uppdatera: läser bara nya filer, tolkar och räknar rätt', async () => {
  const tree = {
    'Faktura 132370 ÄTA1.pdf': { text: '%PDF ata', modified: 1000 },
    'Faktura 132387/huvudfaktura.pdf': { text: '%PDF huvud', modified: 1000 },
    'Faktura 132387/bilaga Beijer.jpg': { text: 'jpg', modified: 1000 },
    'anteckningar.docx': { text: 'ej faktura', modified: 1000 },
  };
  const { api, local, claude, folders, store } = await setup(tree);
  const { id } = await api('/api/projects', { method: 'POST', body: { name: 'Karlavägen 71' } });
  assert.equal((await api(`/api/projects/${id}/folder`, { method: 'POST' })).folder_path, 'Fakturor Karlavägen');

  const r1 = await api(`/api/projects/${id}/sync`, { method: 'POST' });
  assert.equal(r1.imported, 3);
  assert.equal(r1.submissions.length, 2); // undermappen = ett underlag
  await waitIdle(local);
  assert.equal(claude.calls.length, 2);
  assert.equal(store.blobs.size, 3);

  const subs = await api(`/api/projects/${id}/submissions`);
  assert.ok(subs.every((s) => s.status === 'done'), JSON.stringify(subs.map((s) => [s.status, s.error])));
  const projects = await api('/api/projects');
  assert.ok(Math.abs(projects[0].total - 100047.71) < 0.5);

  // Uppdatera igen: inget nytt, inga filer läses (cache på storlek + ändringstid), inga AI-anrop
  folders.reads.length = 0;
  const r2 = await api('/api/sync', { method: 'POST' });
  assert.equal(r2.results[0].imported, 0);
  assert.equal(folders.reads.length, 0);
  await waitIdle(local);
  assert.equal(claude.calls.length, 2);

  // Ny fil i mappen läses in
  tree['Faktura 140000.pdf'] = { text: '%PDF ny', modified: 2000 };
  const r3 = await api(`/api/projects/${id}/sync`, { method: 'POST' });
  assert.equal(r3.imported, 1);
  await waitIdle(local);

  // Det nya underlaget innehåller samma fakturanummer som exemplet -> dubblett, totalen ändras inte
  const after = await api('/api/projects');
  assert.ok(Math.abs(after[0].total - 100047.71) < 0.5);

  // Borttaget underlag kommer inte tillbaka vid Uppdatera
  const newest = (await api(`/api/projects/${id}/submissions`)).find((s) => s.label === 'Faktura 140000.pdf');
  await api(`/api/submissions/${newest.id}`, { method: 'DELETE' });
  const r4 = await api(`/api/projects/${id}/sync`, { method: 'POST' });
  assert.equal(r4.imported, 0);
  assert.deepEqual(r4.ignored, ['Faktura 140000.pdf']);
});

test('valda filer: samma innehåll med annat namn läses inte in igen', async () => {
  const { api, local } = await setup({});
  const { id } = await api('/api/projects', { method: 'POST', body: { name: 'P' } });
  const file = (name, text) => Object.assign(new Blob([text], { type: 'application/pdf' }), { name });
  const r1 = await api(`/api/projects/${id}/submissions`, { method: 'POST', body: {
    mode: 'together', files: [file('Faktura 132387.pdf', '%PDF a'), file('bilaga.pdf', '%PDF b')] } });
  assert.equal(r1.submissions.length, 1);
  const r2 = await api(`/api/projects/${id}/submissions`, { method: 'POST', body: {
    mode: 'separate', files: [file('Kopia av Faktura.pdf', '%PDF a'), file('notes.docx', 'x')] } });
  assert.equal(r2.imported, 0);
  assert.deepEqual(r2.skipped.sort(), ['Kopia av Faktura.pdf', 'notes.docx']);
  await waitIdle(local);
});

test('utan API-nyckel: tydligt fel, men analys och exempel fungerar', async () => {
  const { api } = await setup({});
  await api('/api/settings', { method: 'PUT', body: { apiKey: '' } });
  assert.equal((await api('/api/meta')).aiEnabled, false);
  const { id } = await api('/api/demo', { method: 'POST' });
  const pdf = Object.assign(new Blob(['%PDF']), { name: 'a.pdf' });
  await assert.rejects(api(`/api/projects/${id}/submissions`, { method: 'POST', body: { files: [pdf] } }), /API-nyckel/);
  const cmp = await api('/api/analysis/compare?dimension=trade&value=rivning&unit=h');
  assert.equal(cmp.overall.avg_price, 481.6);
  await assert.rejects(api('/api/ask', { method: 'POST', body: { question: 'x' } }), /API-nyckel/);
});

test('sql.js: skrivskyddade frågor och lagring som bytes', async () => {
  const { db, api } = await setup({});
  await api('/api/demo', { method: 'POST' });
  const { runReadOnlySql } = require('../src/ask');
  assert.ok(runReadOnlySql(db, 'SELECT COUNT(*) n FROM cost_lines').rows[0].n > 40);
  db.prepare('PRAGMA query_only = ON').run();
  assert.throws(() => db.prepare('DELETE FROM projects').run());
  db.prepare('PRAGMA query_only = OFF').run();
  const SQL = await initSqlJs();
  const copy = adapt(new SQL.Database(db.export()));
  assert.equal(copy.prepare('SELECT COUNT(*) n FROM projects').get().n, 1);
});

test('frågor sparas, samma fråga räknas upp, favoriter ligger först', async () => {
  const { api, db } = await setup({});
  await api('/api/demo', { method: 'POST' });
  const fakeAsk = { mode: 'sdk' };
  // Byt ut Claude-anropet mot ett fast svar
  const { createLocalApi } = require('../src/local-api');
  const local = createLocalApi({ db, store: { kvGet: async () => 'k', kvSet: async () => {}, blobGet: async () => null, blobPut: async () => {}, blobDel: async () => {} },
    folders: fakeFolders({}), fixture, llm: { ...fakeAsk, available: async () => true, ensureReady: async () => true, ask: async () => ({ answer: 'svar', queries: [] }) } });
  const r1 = await local.api('/api/ask', { method: 'POST', body: { question: 'Vad kostar rivning per timme?' } });
  await local.api('/api/ask', { method: 'POST', body: { question: '  vad kostar rivning per timme ' } });
  await local.api('/api/ask', { method: 'POST', body: { question: 'Vilka leverantörer finns?' } });
  await local.api(`/api/questions/${r1.questionId}`, { method: 'PATCH', body: { favorite: true } });
  let qs = await local.api('/api/questions');
  assert.equal(qs.length, 2);
  assert.deepEqual([qs[0].text, qs[0].favorite, qs[0].times_asked, qs[0].last_answer], ['Vad kostar rivning per timme?', 1, 2, 'svar']);
  await local.api(`/api/questions/${qs[1].id}`, { method: 'DELETE' });
  qs = await local.api('/api/questions');
  assert.equal(qs.length, 1);
});
