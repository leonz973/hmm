/**
 * 附件存 IndexedDB：localStorage 只有 ~5MB 且只能存字符串，
 * 发票 PDF/照片动辄几百 KB，必须走 IndexedDB 存 Blob。
 * 接后端后改成预签名直传对象存储即可。
 */

const DB_NAME = 'hmm-files';
const DB_VERSION = 1;
const STORE = 'attachments';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putBlob(key: string, blob: Blob): Promise<void> {
  await tx('readwrite', (s) => s.put(blob, key) as IDBRequest<IDBValidKey>);
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const value = await tx<Blob | undefined>('readonly', (s) => s.get(key));
  return value ?? undefined;
}

export async function delBlob(key: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(key) as unknown as IDBRequest<undefined>);
}

export async function blobUrl(key: string): Promise<string | null> {
  const blob = await getBlob(key);
  return blob ? URL.createObjectURL(blob) : null;
}
