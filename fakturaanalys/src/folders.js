'use strict';
// Fakturamapp på enheten. Tre lägen:
//  - native:  iOS-appen (Capacitor) – mappen i Filer kommer ihågs via tillägget FolderAccess
//  - browser: Chrome/Edge – webbläsaren kommer ihåg mappen (File System Access API)
//  - none:    Safari m.fl. – man väljer filerna i mappen vid varje uppdatering
const { Capacitor, registerPlugin } = require('@capacitor/core');
const { kvGet, kvSet, kvDel } = require('./device-store');
const { isSupported } = require('./importer');

const FolderAccess = registerPlugin('FolderAccess');

function folderMode() {
  if (Capacitor.isNativePlatform()) return 'native';
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) return 'browser';
  return 'none';
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function browserHandle(projectId, { request = true } = {}) {
  const handle = await kvGet(`dir-${projectId}`);
  if (!handle) throw new Error('Ingen mapp vald');
  let perm = await handle.queryPermission({ mode: 'read' });
  if (perm !== 'granted' && request) perm = await handle.requestPermission({ mode: 'read' });
  if (perm !== 'granted') throw new Error('Åtkomst till mappen nekades');
  return handle;
}

async function pickFolder(projectId) {
  const mode = folderMode();
  if (mode === 'native') return FolderAccess.pickFolder({ key: String(projectId) });
  if (mode === 'browser') {
    const handle = await window.showDirectoryPicker({ id: `fakturor-${projectId}`, mode: 'read' });
    await kvSet(`dir-${projectId}`, handle);
    return { name: handle.name };
  }
  throw new Error('Den här webbläsaren kan inte komma ihåg en mapp. Välj filerna i mappen i stället.');
}

// Returnerar [{ path, size, modified, read: () => Promise<Uint8Array> }]
async function listFolder(projectId) {
  const mode = folderMode();
  if (mode === 'native') {
    const key = String(projectId);
    const r = await FolderAccess.listFiles({ key });
    return r.files.filter((f) => isSupported(f.path)).map((f) => ({
      path: f.path, size: f.size, modified: f.modified, notDownloaded: f.notDownloaded,
      read: async () => base64ToBytes((await FolderAccess.readFile({ key, path: f.path })).data),
    }));
  }
  if (mode === 'browser') {
    const handle = await browserHandle(projectId);
    const out = [];
    const walk = async (dir, prefix, depth) => {
      if (depth > 6) return;
      for await (const entry of dir.values()) {
        if (entry.name.startsWith('.')) continue;
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.kind === 'directory') await walk(entry, rel, depth + 1);
        else if (isSupported(rel)) {
          const file = await entry.getFile();
          out.push({ path: rel, size: file.size, modified: file.lastModified,
            read: async () => new Uint8Array(await file.arrayBuffer()) });
        }
      }
    };
    await walk(handle, '', 0);
    return out;
  }
  throw new Error('Ingen mapp vald');
}

async function forgetFolder(projectId) {
  const mode = folderMode();
  if (mode === 'native') await FolderAccess.forget({ key: String(projectId) });
  else await kvDel(`dir-${projectId}`);
}

module.exports = { folderMode, pickFolder, listFolder, forgetFolder, base64ToBytes, FolderAccess };
