
const DB_NAME = 'StarVocabListeningDB';
const DB_VERSION = 1;

const STORES = {
    SESSIONS: 'lm_sessions',
    EVENTS: 'lm_events',
    MATERIALS: 'lm_materials',
    PROGRESS: 'lm_progress',
    WALLET: 'lm_wallet'
};

class ListeningDB {
    constructor() {
        this.db = null;
        this.initPromise = this._initDB();
    }

    async _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("ListeningDB open error:", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. Sessions Store
                if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
                    const store = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
                    store.createIndex('userId', 'userId', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('updatedAt', 'updatedAt', { unique: false });
                }

                // 2. Events Store (Key: sessionId)
                // Stores { sessionId: "...", events: [...] }
                if (!db.objectStoreNames.contains(STORES.EVENTS)) {
                    db.createObjectStore(STORES.EVENTS, { keyPath: 'sessionId' });
                }

                // 3. Materials Store
                if (!db.objectStoreNames.contains(STORES.MATERIALS)) {
                    const store = db.createObjectStore(STORES.MATERIALS, { keyPath: 'id' });
                    store.createIndex('userId', 'userId', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // 4. Progress Store
                if (!db.objectStoreNames.contains(STORES.PROGRESS)) {
                    const store = db.createObjectStore(STORES.PROGRESS, { keyPath: 'id' });
                    store.createIndex('materialId', 'materialId', { unique: false });
                    store.createIndex('userId', 'userId', { unique: false });
                }

                // 5. Wallet Store
                if (!db.objectStoreNames.contains(STORES.WALLET)) {
                    db.createObjectStore(STORES.WALLET, { keyPath: 'userId' });
                }
            };
        });
    }

    async getDB() {
        if (!this.db) await this.initPromise;
        return this.db;
    }

    async transaction(storeNames, mode = 'readonly') {
        const db = await this.getDB();
        return db.transaction(storeNames, mode);
    }

    // Generic helpers
    async get(storeName, key) {
        const tx = await this.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async put(storeName, value) {
        const tx = await this.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const req = store.put(value);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async getAll(storeName, indexName = null, query = null) {
        const tx = await this.transaction([storeName], 'readonly');
        const store = tx.objectStore(storeName);
        const source = indexName ? store.index(indexName) : store;
        return new Promise((resolve, reject) => {
            const req = source.getAll(query);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    
    async delete(storeName, key) {
        const tx = await this.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
}

export const listeningDB = new ListeningDB();
export const STORES_CONST = STORES;
