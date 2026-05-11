const DB_NAME = 'shiori-tts';
const STORE_NAME = 'audio';
const DB_VERSION = 1;

export interface TTSAudioCache {
  get(key: string): Promise<ArrayBuffer | null>;
  set(key: string, audio: ArrayBuffer): Promise<void>;
  clearByPrefix(prefix: string): Promise<void>;
}

export function makeSentenceCacheKey(textId: number, sentenceIndex: number): string {
  return `${textId}:${sentenceIndex}`;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function createIndexedDBCache(): TTSAudioCache {
  return {
    async get(key) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const req = db
          .transaction(STORE_NAME, 'readonly')
          .objectStore(STORE_NAME)
          .get(key);
        req.onsuccess = () => resolve((req.result as ArrayBuffer | undefined) ?? null);
        req.onerror = () => reject(req.error);
      });
    },

    async set(key, audio) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const req = db
          .transaction(STORE_NAME, 'readwrite')
          .objectStore(STORE_NAME)
          .put(audio, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    async clearByPrefix(prefix) {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const store = db
          .transaction(STORE_NAME, 'readwrite')
          .objectStore(STORE_NAME);
        const req = store.openCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor === null) { resolve(); return; }
          if ((cursor.key as string).startsWith(prefix)) cursor.delete();
          cursor.continue();
        };
        req.onerror = () => reject(req.error);
      });
    },
  };
}

// Future: export function createServerBlobCache(baseUrl: string): TTSAudioCache { ... }
