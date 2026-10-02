export interface DraftRecord {
  width: number;
  height: number;
  pixels: ImageData;
  savedAt: number;
}

interface DraftRow extends DraftRecord {
  id: string;
}

const DB_NAME = 'minipaint';
const STORE = 'drafts';
const KEY = 'current';

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** 防抖到期后写入草稿；IndexedDB 不可用时静默失败。返回是否写入成功。 */
export async function saveDraft(draft: DraftRecord): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const row: DraftRow = { id: KEY, ...draft };
      const request = tx.objectStore(STORE).put(row);
      request.onsuccess = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

/** 读取草稿；无/损坏/不可用返回 null（损坏抛错也吞掉）。 */
export async function loadDraft(): Promise<DraftRecord | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(KEY);
      request.onsuccess = () => {
        const row = request.result as DraftRow | undefined;
        if (
          !row ||
          typeof row.width !== 'number' ||
          typeof row.height !== 'number' ||
          !(row.pixels instanceof ImageData)
        ) {
          resolve(null);
          return;
        }
        resolve({ width: row.width, height: row.height, pixels: row.pixels, savedAt: row.savedAt });
      };
      request.onerror = () => resolve(null);
      tx.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function clearDraft(): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      const request = tx.objectStore(STORE).delete(KEY);
      request.onsuccess = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** 草稿与目标文档像素是否完全一致（尺寸+逐像素）。 */
export function draftMatches(
  draft: DraftRecord,
  width: number,
  height: number,
  pixels: ImageData,
): boolean {
  if (draft.width !== width || draft.height !== height) return false;
  if (draft.pixels.data.length !== pixels.data.length) return false;
  const a = draft.pixels.data;
  const b = pixels.data;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
