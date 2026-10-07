'use strict';
// Lagring på enheten (IndexedDB): databasfilen, originalfilerna (blobbar per SHA-256) och små
// inställningar som mapphandtag. Allt stannar på iPhone/iPad – inget skickas till någon server
// utom själva tolkningen och frågorna som går till Claude.

function openIdb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open('fakturaanalys', 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('kv');
      r.result.createObjectStore('blobs');
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
let idbPromise = null;
const idb = () => (idbPromise ||= openIdb());

async function req(store, mode, fn) {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error('Lagringen avbröts (fullt utrymme?)'));
  });
}

const kvGet = (key) => req('kv', 'readonly', (s) => s.get(key));
const kvSet = (key, val) => req('kv', 'readwrite', (s) => s.put(val, key));
const kvDel = (key) => req('kv', 'readwrite', (s) => s.delete(key));
const blobGet = (hash) => req('blobs', 'readonly', (s) => s.get(hash));
const blobPut = (hash, blob) => req('blobs', 'readwrite', (s) => s.put(blob, hash));
const blobDel = (hash) => req('blobs', 'readwrite', (s) => s.delete(hash));

// Be webbläsaren att inte rensa appens data när utrymmet blir trångt.
async function requestPersistence() {
  try { return navigator.storage && navigator.storage.persist ? await navigator.storage.persist() : false; } catch { return false; }
}

module.exports = { kvGet, kvSet, kvDel, blobGet, blobPut, blobDel, requestPersistence };
