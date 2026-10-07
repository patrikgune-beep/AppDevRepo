'use strict';
// Startpunkt för appen. Allt körs på enheten (iPhone/iPad, eller i webbläsaren):
// SQLite (WebAssembly) + IndexedDB för lagring, och Claude-anrop direkt från appen.
const initSqlJs = require('sql.js');
const { Capacitor } = require('@capacitor/core');
const { adapt } = require('../src/sqljs-adapter');
const { init } = require('../src/schema');
const store = require('../src/device-store');
const folders = require('../src/folders');
const { createLocalApi } = require('../src/local-api');
const fixture = require('../fixtures/karlavagen71.json');
const ui = require('./ui');

const { FolderAccess } = folders;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const isSqlite = (bytes) => new TextDecoder().decode(bytes.slice(0, 15)) === 'SQLite format 3';

async function boot() {
  const SQL = await initSqlJs({ locateFile: (f) => f });
  const saved = await store.kvGet('db');
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
  // Spara direkt när appen läggs i bakgrunden
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) save().catch(console.error); });
  store.requestPersistence();

  const exportDb = async () => {
    const bytes = db.export();
    const name = `fakturaanalys-${new Date().toISOString().slice(0, 10)}.sqlite`;
    if (Capacitor.isNativePlatform()) {
      await FolderAccess.exportFile({ name, data: await blobToBase64(new Blob([bytes])) });
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
  const importDb = async (bytes) => {
    if (!isSqlite(bytes)) throw new Error('Filen är inte en säkerhetskopia från appen.');
    const test = adapt(new SQL.Database(bytes));
    if (!test.prepare("SELECT 1 FROM sqlite_master WHERE name = 'line_items'").get()) throw new Error('Filen är inte en säkerhetskopia från appen.');
    test.close();
    clearTimeout(timer);
    await store.kvSet('db', bytes);
    return { ok: true };
  };

  const local = createLocalApi({ db, store, folders, toBase64: blobToBase64, fixture, exportDb, importDb });
  await ui.start(local.api);
  local.resumeInterrupted();
  document.getElementById('boot').hidden = true;

  if ('serviceWorker' in navigator && !Capacitor.isNativePlatform() && window.isSecureContext) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot().catch((e) => {
  console.error(e);
  document.getElementById('boot').textContent = `Appen kunde inte starta: ${e.message}`;
});
