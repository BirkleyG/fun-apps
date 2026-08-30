const DB_NAME = "meeting_recorder_db";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("recordings")) {
        db.createObjectStore("recordings", { keyPath: "id" });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
function getDB() {
  if (!dbPromise) dbPromise = openDB();
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return getDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const store = t.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export const localRecordings = {
  put: (record) => tx("recordings", "readwrite", (s) => s.put(record)),
  get: (id) => tx("recordings", "readonly", (s) => s.get(id)),
  delete: (id) => tx("recordings", "readwrite", (s) => s.delete(id)),
  all: () => tx("recordings", "readonly", (s) => s.getAll())
};
