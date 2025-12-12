
const DB_NAME = 'StarVocabDictionaryDB';
const DB_VERSION = 2; // 升级版本
const STORE_ENTRIES = 'entries';
const STORE_QUEUE = 'translation_queue';
const STORE_EXAMPLES = 'examples'; // 新增例句表

/**
 * 词条结构示例:
 * { ... }
 * 
 * 例句结构示例 (STORE_EXAMPLES):
 * {
 *   id: "auto_gen_uuid",
 *   word: "haus", (索引字段，小写)
 *   sentence: "Das ist ein Haus.",
 *   translation: "这是一所房子。",
 *   source: "common_dict_import"
 * }
 */

class LocalDictionaryDB {
    constructor() {
        this.db = null;
        this.initPromise = this._initDB();
    }

    async _initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("DictionaryDB open error:", event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // 1. 词条存储
                if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
                    const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
                    store.createIndex('word', 'word', { unique: false });
                    store.createIndex('source', 'source', { unique: false });
                    store.createIndex('frequency', 'frequency', { unique: false });
                }

                // 2. 待翻译队列存储
                if (!db.objectStoreNames.contains(STORE_QUEUE)) {
                    db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
                }

                // 3. 独立例句存储 (新增)
                if (!db.objectStoreNames.contains(STORE_EXAMPLES)) {
                    const store = db.createObjectStore(STORE_EXAMPLES, { keyPath: 'id', autoIncrement: true });
                    // 建立 word 索引，允许重复（因为一个单词可以有多个例句）
                    store.createIndex('word', 'word', { unique: false });
                }
            };
        });
    }

    // ... (Entry methods keep same) ...
    async getEntry(word) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_ENTRIES], 'readonly');
            const store = tx.objectStore(STORE_ENTRIES);
            const request = store.get(word.toLowerCase().trim());

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveEntry(entry) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_ENTRIES], 'readwrite');
            const store = tx.objectStore(STORE_ENTRIES);
            
            if (!entry.id) {
                entry.id = (entry.word || entry.headword).toLowerCase().trim();
            }

            const request = store.put(entry);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async bulkSaveEntries(entries) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_ENTRIES], 'readwrite');
            const store = tx.objectStore(STORE_ENTRIES);
            
            let completed = 0;
            let errors = 0;

            tx.oncomplete = () => resolve({ saved: completed, errors });
            tx.onerror = () => reject(tx.error);

            entries.forEach(entry => {
                if (!entry.id) entry.id = (entry.word || entry.headword).toLowerCase().trim();
                const req = store.put(entry);
                req.onsuccess = () => completed++;
                req.onerror = () => errors++;
            });
        });
    }

    // --- 例句管理 (Examples) ---

    /**
     * 获取某单词的所有例句
     */
    async getExamples(word) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_EXAMPLES], 'readonly');
            const store = tx.objectStore(STORE_EXAMPLES);
            const index = store.index('word');
            const request = index.getAll(word.toLowerCase().trim());
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 批量保存例句
     * @param {Array} examples - [{ word: 'Haus', sentence: '...', translation: '...' }]
     */
    async bulkSaveExamples(examples) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_EXAMPLES], 'readwrite');
            const store = tx.objectStore(STORE_EXAMPLES);
            
            let count = 0;
            tx.oncomplete = () => resolve(count);
            tx.onerror = () => reject(tx.error);

            examples.forEach(ex => {
                // 确保有 word 字段用于索引
                if (ex.word) {
                    ex.word = ex.word.toLowerCase().trim();
                    store.add(ex); // 使用 add 而不是 put，让它自动生成 id
                    count++;
                }
            });
        });
    }

    // --- 队列管理 ---


    async addToTranslationQueue(entry) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_QUEUE], 'readwrite');
            const store = tx.objectStore(STORE_QUEUE);
            const request = store.put(entry);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async getTranslationQueue(limit = 20) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_QUEUE], 'readonly');
            const store = tx.objectStore(STORE_QUEUE);
            const request = store.getAll(null, limit); // 获取前 N 个
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removeFromQueue(ids) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_QUEUE], 'readwrite');
            const store = tx.objectStore(STORE_QUEUE);
            
            ids.forEach(id => store.delete(id));
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }
    
    // 清空整个数据库（用于导入新版本时）
    async clearAll() {
        await this.initPromise;
        const tx = this.db.transaction([STORE_ENTRIES, STORE_QUEUE], 'readwrite');
        tx.objectStore(STORE_ENTRIES).clear();
        tx.objectStore(STORE_QUEUE).clear();
        return new Promise(resolve => {
            tx.oncomplete = () => resolve();
        });
    }
}

export const localDictDB = new LocalDictionaryDB();
