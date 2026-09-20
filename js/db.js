/* IndexedDB data layer for the Bautagebuch app.
   Two object stores: "sites" (Baustellen) and "entries" (Tagebucheintraege).
   Photos are stored as Blobs directly inside the entry record. */

const DB_NAME = "bautagebuch-db";
const DB_VERSION = 1;

let dbInstance = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains("sites")) {
        const siteStore = db.createObjectStore("sites", { keyPath: "id" });
        siteStore.createIndex("byName", "name", { unique: false });
      }

      if (!db.objectStoreNames.contains("entries")) {
        const entryStore = db.createObjectStore("entries", { keyPath: "id" });
        entryStore.createIndex("bySite", "siteId", { unique: false });
        entryStore.createIndex("byDate", "date", { unique: false });
        entryStore.createIndex("bySiteAndDate", ["siteId", "date"], { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject(event.target.error || new Error("IndexedDB konnte nicht geoeffnet werden."));
    };
  });
}

function tx(storeName, mode) {
  return openDatabase().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function wrapRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function newId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

const DB = {
  newId,

  // ---- Sites ----
  async getAllSites() {
    const store = await tx("sites", "readonly");
    const all = await wrapRequest(store.getAll());
    return all.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  },

  async getSite(id) {
    const store = await tx("sites", "readonly");
    return wrapRequest(store.get(id));
  },

  async saveSite(site) {
    const store = await tx("sites", "readwrite");
    if (!site.id) {
      site.id = newId();
      site.createdAt = Date.now();
    }
    site.updatedAt = Date.now();
    await wrapRequest(store.put(site));
    return site;
  },

  async deleteSite(id) {
    const entryStore = await tx("entries", "readwrite");
    const idx = entryStore.index("bySite");
    const keys = await wrapRequest(idx.getAllKeys(id));
    await Promise.all(keys.map((k) => wrapRequest(entryStore.delete(k))));

    const siteStore = await tx("sites", "readwrite");
    await wrapRequest(siteStore.delete(id));
  },

  // ---- Entries ----
  async getEntriesBySite(siteId) {
    const store = await tx("entries", "readonly");
    const idx = store.index("bySite");
    const all = await wrapRequest(idx.getAll(siteId));
    return all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  },

  async getEntry(id) {
    const store = await tx("entries", "readonly");
    return wrapRequest(store.get(id));
  },

  async findEntryByDate(siteId, date) {
    const store = await tx("entries", "readonly");
    const idx = store.index("bySiteAndDate");
    return wrapRequest(idx.get([siteId, date]));
  },

  async saveEntry(entry) {
    const store = await tx("entries", "readwrite");
    if (!entry.id) {
      entry.id = newId();
      entry.createdAt = Date.now();
    }
    entry.updatedAt = Date.now();
    await wrapRequest(store.put(entry));
    return entry;
  },

  async deleteEntry(id) {
    const store = await tx("entries", "readwrite");
    await wrapRequest(store.delete(id));
  },

  async getAllEntries() {
    const store = await tx("entries", "readonly");
    return wrapRequest(store.getAll());
  },
};

window.DB = DB;
