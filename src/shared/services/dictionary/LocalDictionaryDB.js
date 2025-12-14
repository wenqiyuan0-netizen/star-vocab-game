const DB_NAME = 'StarVocabDictionaryDB';
const DB_VERSION = 3; // 升级版本：新增 word_lower 索引和 translation_tasks
const STORE_ENTRIES = 'entries';
const STORE_QUEUE = 'translation_queue';
const STORE_EXAMPLES = 'examples';
const STORE_TASKS = 'translation_tasks'; // 新增：翻译任务存储

/**
 * 词条结构示例 (UnifiedEntry):
 * {
 *   id: "haus_noun",
 *   word: "Haus",
 *   word_lower: "haus",
 *   pos: "noun",
 *   translation_cn: "房子",
 *   ...
 * }
 * 
 * 翻译任务结构 (TranslationTask):
 * {
 *   id: "task_haus_noun_1702500000",
 *   entry_id: "haus_noun",
 *   word: "Haus",
 *   status: "queued" | "processing" | "completed" | "failed",
 *   ...
 * }
 */

class LocalDictionaryDB {
    constructor() {
        this.db = null;
        this.initPromise = this._initDB();
    }

    async _initDB(retryAfterDelete = false) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = async (event) => {
                console.error("DictionaryDB open error:", event.target.error);

                // If this is first try and we got an error, delete and retry
                if (!retryAfterDelete) {
                    console.log('[DictDB] Attempting to delete and recreate database...');
                    try {
                        await this._deleteDatabase();
                        const db = await this._initDB(true);
                        resolve(db);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(event.target.error);
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;

                // Handle version mismatch error during use
                this.db.onerror = (e) => {
                    console.error('[DictDB] Database error:', e.target.error);
                };

                resolve(this.db);
            };

            request.onblocked = () => {
                console.warn('[DictDB] Database blocked - close other tabs');
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                console.log(`[DictDB] Upgrading from v${oldVersion} to v${DB_VERSION}`);

                // 1. 词条存储
                if (!db.objectStoreNames.contains(STORE_ENTRIES)) {
                    const store = db.createObjectStore(STORE_ENTRIES, { keyPath: 'id' });
                    store.createIndex('word', 'word', { unique: false });
                    store.createIndex('word_lower', 'word_lower', { unique: false });
                    store.createIndex('source', 'source', { unique: false });
                    store.createIndex('frequency', 'frequency', { unique: false });
                } else if (oldVersion < 3) {
                    try {
                        const tx = event.target.transaction;
                        const store = tx.objectStore(STORE_ENTRIES);
                        if (!store.indexNames.contains('word_lower')) {
                            store.createIndex('word_lower', 'word_lower', { unique: false });
                        }
                    } catch (e) {
                        console.warn('[DictDB] Could not add word_lower index:', e);
                    }
                }

                // 2. 待翻译队列存储 (旧版兼容)
                if (!db.objectStoreNames.contains(STORE_QUEUE)) {
                    db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
                }

                // 3. 独立例句存储
                if (!db.objectStoreNames.contains(STORE_EXAMPLES)) {
                    const store = db.createObjectStore(STORE_EXAMPLES, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('word', 'word', { unique: false });
                }

                // 4. 翻译任务存储 (新增)
                if (!db.objectStoreNames.contains(STORE_TASKS)) {
                    const store = db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
                    store.createIndex('entry_id', 'entry_id', { unique: false });
                    store.createIndex('status', 'status', { unique: false });
                    store.createIndex('created_at', 'created_at', { unique: false });
                }
            };
        });
    }

    async _deleteDatabase() {
        return new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(DB_NAME);
            req.onsuccess = () => {
                console.log('[DictDB] Old database deleted');
                resolve(true);
            };
            req.onerror = () => {
                console.warn('[DictDB] Could not delete database');
                resolve(false);
            };
            req.onblocked = () => {
                console.warn('[DictDB] Delete blocked');
                resolve(false);
            };
        });
    }

    /**
     * 关闭数据库连接
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('[DictDB] Database connection closed');
        }
        // 不要设置 initPromise = null，保持原有的 Promise
        // 如果需要重新连接，调用 ensureConnection()
    }

    /**
     * 确保数据库连接可用，如果已关闭则重新初始化
     */
    async ensureConnection() {
        if (!this.db || !this.initPromise) {
            console.log('[DictDB] Connection not available, re-initializing...');
            this.initPromise = this._initDB();
        }
        await this.initPromise;
        return this.db;
    }


    // ... (Entry methods keep same) ...
    async getEntry(word) {
        await this.ensureConnection();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_ENTRIES], 'readonly');
            const store = tx.objectStore(STORE_ENTRIES);
            const request = store.get(word.toLowerCase().trim());

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveEntry(entry) {
        await this.ensureConnection();
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
        await this.ensureConnection();
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
        await this.ensureConnection();
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
        await this.ensureConnection();
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

    // --- 队列管理 (旧版兼容) ---

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
            const request = store.getAll(null, limit);

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

    // --- 新增：按 word_lower 查询 ---

    /**
     * 按单词查询所有词性的词条
     * @param {string} word
     * @returns {Promise<Object[]>}
     */
    async getEntriesByWord(word) {
        await this.ensureConnection();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_ENTRIES], 'readonly');
            const store = tx.objectStore(STORE_ENTRIES);

            // 尝试使用 word_lower 索引
            let index;
            try {
                index = store.index('word_lower');
            } catch (e) {
                // 降级到 word 索引
                index = store.index('word');
            }

            const request = index.getAll(word.toLowerCase().trim());
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 按单词和来源类型查询
     * @param {string} word
     * @param {string} sourceType
     * @returns {Promise<Object[]>}
     */
    async getEntriesByWordAndSource(word, sourceType) {
        const entries = await this.getEntriesByWord(word);
        return entries.filter(e =>
            e.sources?.some(s => s.type === sourceType) ||
            e.source?.includes(sourceType)
        );
    }

    // --- 新增：翻译任务管理 ---

    /**
     * 保存翻译任务
     * @param {Object} task
     */
    async saveTranslationTask(task) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_TASKS], 'readwrite');
            const store = tx.objectStore(STORE_TASKS);
            const request = store.put(task);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 获取翻译任务
     * @param {string} entryId
     */
    async getTranslationTask(entryId) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_TASKS], 'readonly');
            const store = tx.objectStore(STORE_TASKS);
            const index = store.index('entry_id');
            const request = index.get(entryId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 获取未完成的翻译任务
     * @param {number} limit
     */
    async getIncompleteTasks(limit = 10) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_TASKS], 'readonly');
            const store = tx.objectStore(STORE_TASKS);
            const index = store.index('status');

            const results = [];
            const request = index.openCursor(IDBKeyRange.only('queued'));

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 按状态获取任务
     * @param {string} status
     */
    async getTasksByStatus(status) {
        await this.initPromise;
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_TASKS], 'readonly');
            const store = tx.objectStore(STORE_TASKS);
            const index = store.index('status');
            const request = index.getAll(status);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    // --- 清空数据库 ---

    async clearAll() {
        await this.initPromise;
        const stores = [STORE_ENTRIES, STORE_QUEUE, STORE_EXAMPLES, STORE_TASKS];
        const tx = this.db.transaction(stores, 'readwrite');
        stores.forEach(name => {
            if (this.db.objectStoreNames.contains(name)) {
                tx.objectStore(name).clear();
            }
        });
        return new Promise(resolve => {
            tx.oncomplete = () => resolve();
        });
    }
}

export const localDictDB = new LocalDictionaryDB();

