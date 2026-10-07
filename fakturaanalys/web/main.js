'use strict';
// Startpunkt för appen. Allt körs på enheten: SQLite + IndexedDB för lagring.
// Två byggen: iOS-app/webbapp (Claude via API-nyckel) och länk-versionen som öppnas i
// Claude/Safari (__ARTIFACT__), där Claude nås via användarens eget Claude-konto.
const initSqlJs = require('sql.js');
const { Capacitor } = require('@capacitor/core');
const { adapt } = require('../src/sqljs-adapter');
const { init } = require('../src/schema');
const store = require('../src/device-store');
const folders = require('../src/folders');
const { createLocalApi } = require('../src/local-api');
const { createSdkLlm, createSampleLlm, blobToBase64 } = require('../src/llm');
const { pdfToPages } = require('../src/pdf-pages');
const fixture = require('../fixtures/karlavagen71.json');
const ui = require('./ui');

/* global __ARTIFACT__ */
const ARTIFACT = typeof __ARTIFACT__ !== 'undefined' && __ARTIFACT__;
const { FolderAccess } = folders;

const isSqlite = (bytes) => new TextDecoder().decode(bytes.slice(0, 15)) === 'SQLite format 3';
const bytesToBase64 = async (bytes) => blobToBase64(new Blob([bytes]));
const base64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

// Säkerhetskopia: SQLite-filen direkt, eller inslagen i JSON där bara vissa filtyper får sparas.
function unwrapBackup(bytes) {
  if (isSqlite(bytes)) return bytes;
  try {
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (obj && obj.app === 'fakturaanalys' && obj.db) return base64ToBytes(obj.db);
  } catch { /* inte JSON */ }
  throw new Error('Filen är inte en säkerhetskopia från appen.');
}

async function useCapability(name) {
  try { return window.claude && window.claude.use ? await window.claude.use(name) : null; } catch { return null; }
}

function unavailableLlm(message) {
  const fail = async () => { const e = new Error(message); e.status = 400; throw e; };
  return { mode: 'sample', available: async () => false, ensureReady: fail, extract: fail, ask: fail };
}

async function boot() {
  const SQL = await initSqlJs({ locateFile: (f) => f });
  const saved = await store.kvGet('db').catch(() => null);
  let timer = null;
  let db;
  const save = async () => {
    if (db.inTransaction) return schedule();
    timer = null;
    await store.kvSet('db', db.export());
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => save().catch(console.error), 300); };
  db = adapt(new SQL.Database(saved || undefined), { onChange: schedule });
  init(db);
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) save().catch(console.error); });
  store.requestPersistence();

  let llm;
  let downloads = null;
  if (ARTIFACT) {
    const [sample, dl] = await Promise.all([useCapability('sample'), useCapability('downloads')]);
    downloads = dl;
    llm = sample ? createSampleLlm({ sample, pdfToPages })
      : unavailableLlm('Claude är inte tillgängligt här. Öppna appens länk i Claude-appen eller på claude.ai när du är inloggad.');
  } else {
    llm = createSdkLlm({ getApiKey: async () => (await store.kvGet('apiKey')) || '' });
  }

  const exportDb = async () => {
    const bytes = db.export();
    const day = new Date().toISOString().slice(0, 10);
    if (ARTIFACT) {
      if (!downloads) throw new Error('Det går inte att spara filer här.');
      const json = JSON.stringify({ app: 'fakturaanalys', version: 1, created: new Date().toISOString(), db: await bytesToBase64(bytes) });
      try {
        await downloads.save({ filename: `fakturaanalys-${day}.json`, data: json });
        return 'Säkerhetskopian sparades.';
      } catch (e) {
        if (e && e.code === 'declined') return 'Avbrutet.';
        throw new Error('Säkerhetskopian kunde inte sparas.');
      }
    }
    const name = `fakturaanalys-${day}.sqlite`;
    if (Capacitor.isNativePlatform()) {
      await FolderAccess.exportFile({ name, data: await bytesToBase64(bytes) });
      return 'Säkerhetskopian sparades.';
    }
    const file = new File([bytes], name, { type: 'application/octet-stream' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return 'Säkerhetskopian delades.';
    }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    return `Säkerhetskopian ${name} laddades ned.`;
  };
  const importDb = async (raw) => {
    const bytes = unwrapBackup(raw);
    const test = adapt(new SQL.Database(bytes));
    const ok = test.prepare("SELECT 1 FROM sqlite_master WHERE name = 'line_items'").get();
    test.close();
    if (!ok) throw new Error('Filen är inte en säkerhetskopia från appen.');
    clearTimeout(timer);
    await store.kvSet('db', bytes);
    return { ok: true };
  };

  // I länk-versionen kan sidan inte komma ihåg mappar – man väljer filerna i mappen.
  const deviceFolders = ARTIFACT ? { ...folders, folderMode: () => 'none' } : folders;
  const local = createLocalApi({ db, store, folders: deviceFolders, fixture, exportDb, importDb, llm });
  await ui.start(local.api);
  // Länk-versionen använder ditt Claude-konto – starta bara anrop när du själv trycker.
  if (ARTIFACT) local.markInterrupted(); else local.resumeInterrupted();
  document.getElementById('boot').hidden = true;

  if (!ARTIFACT && 'serviceWorker' in navigator && !Capacitor.isNativePlatform() && window.isSecureContext && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('boot').textContent = `Appen kunde inte starta: ${e.message}`;
});
