// ═══════════════════════════════════════════════════════════
// MyDiscipline — Agenda & Local/Cloud Storage Engine
// Serverless Local Filesystem & IndexedDB Integration
// ═══════════════════════════════════════════════════════════

const DB_NAME = 'MyDiscipline_AgendaDB';
const DB_VERSION = 1;
const STORE_NAME = 'academic_files';

let dbInstance = null;

export function initAgendaDB() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };
  });
}

export async function storeLocalFile(fileRecord, fileBlob) {
  const db = await initAgendaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item = {
      ...fileRecord,
      blob: fileBlob,
      updated_at: Date.now(),
    };
    const req = store.put(item);
    req.onsuccess = () => resolve(item);
    req.onerror = () => reject(req.error);
  });
}

export async function getLocalFile(fileId) {
  const db = await initAgendaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(fileId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removeLocalFile(fileId) {
  const db = await initAgendaDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(fileId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function downloadLocalFile(fileRecord) {
  try {
    const data = await getLocalFile(fileRecord.id);
    if (!data || !data.blob) {
      if (fileRecord.url) {
        window.open(fileRecord.url, '_blank');
        return;
      }
      throw new Error('Archivo no disponible localmente');
    }

    const url = URL.createObjectURL(data.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileRecord.name || 'documento';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('Download error:', err);
    throw err;
  }
}

/**
 * Modern File System Access API: Pick an actual folder from user's hard drive
 */
export async function pickUserLocalDirectory() {
  if ('showDirectoryPicker' in window) {
    try {
      const dirHandle = await window.showDirectoryPicker({
        mode: 'read',
      });
      const files = [];
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          try {
            const file = await entry.getFile();
            files.push({
              name: entry.name,
              size: file.size,
              lastModified: file.lastModified,
              type: file.type || 'document',
            });
          } catch (e) {
            files.push({ name: entry.name, size: 0, type: 'document' });
          }
        }
      }
      return {
        supported: true,
        directoryName: dirHandle.name,
        files,
        handle: dirHandle,
      };
    } catch (e) {
      if (e.name === 'AbortError') return null; // user cancelled
      console.warn('Directory picker error, fallback:', e);
    }
  }

  return {
    supported: false,
    directoryName: null,
    files: [],
  };
}
