const DB_NAME = 'StarVocabDictionaryDB';
const DB_VERSION = 4; // 升级版本：新增 search_index
const STORE_ENTRIES = 'entries';
const STORE_QUEUE = 'translation_queue';
const STORE_EXAMPLES = 'examples';
const STORE_TASKS = 'translation_tasks';
const STORE_SEARCH_INDEX = 'search_index'; // 新增：变位索引

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

                // Another context (e.g. a dictionary upgrade) wants to delete/upgrade the DB:
                // release our handle so it isn't blocked; the next call reconnects.
                this.db.onversionchange = () => {
                    try { this.db && this.db.close(); } catch (e) { }
                    this.db = null;
                    this.initPromise = null;
                };

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

                // 5. 变位索引存储 (v4)
                if (!db.objectStoreNames.contains(STORE_SEARCH_INDEX)) {
                    // keyPath: 'v' (variant), value: 'l' (lemma_id)
                    // 为了节省空间，我们存储简化的对象 {v: "...", l: ...} 或者直接把 variant 作为 key
                    // 使用 out-of-line keys (不设置 keyPath) 可以存储任意值，比如 just number
                    // 但 keyPath 查询更方便。这里 variant 是唯一的 key。
                    // 让我们用 variant 作为 keyPath，value 是 lemma_id
                    // 但是 IndexedDB value 必须是对象吗？不一定。
                    // 为了最大化性能和空间，我们使用 out-of-line key。
                    // store.put(lemma_id, variant)
                    db.createObjectStore(STORE_SEARCH_INDEX); 
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
        // Force the next call to reopen instead of reusing a closed connection.
        this.initPromise = null;
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

    /**
     * 根据单词获取所有匹配的词条 (使用 word_lower 索引)
     * @param {string} word 
     * @returns {Promise<Array>}
     */
    async getEntriesByWord(word) {
        await this.ensureConnection();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_ENTRIES], 'readonly');
            const store = tx.objectStore(STORE_ENTRIES);
            const lower = word.toLowerCase().trim();
            
            let request;
            // 优先使用索引查找所有匹配项
            if (store.indexNames.contains('word_lower')) {
                const index = store.index('word_lower');
                request = index.getAll(lower);
            } else if (store.indexNames.contains('word')) {
                // Fallback to case-sensitive word index if lower not available
                const index = store.index('word');
                request = index.getAll(word);
            } else {
                // Fallback to primary key (ID)
                request = store.get(lower);
            }

            request.onsuccess = () => {
                const res = request.result;
                if (Array.isArray(res)) {
                    resolve(res);
                } else if (res) {
                    resolve([res]);
                } else {
                    resolve([]);
                }
            };
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
        await this.ensureConnection();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_QUEUE], 'readwrite');
            const store = tx.objectStore(STORE_QUEUE);
            const request = store.put(entry);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }

    async getTranslationQueue(limit = 20) {
        await this.ensureConnection();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_QUEUE], 'readonly');
            const store = tx.objectStore(STORE_QUEUE);
            const request = store.getAll(null, limit);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async removeFromQueue(ids) {
        await this.ensureConnection();
        return new Promise((resolve, reject) => {
            if (!Array.isArray(ids)) {
                console.warn('[DictDB] removeFromQueue expects an array of IDs');
                return resolve(false);
            }
            
            const tx = this.db.transaction([STORE_QUEUE], 'readwrite');
            const store = tx.objectStore(STORE_QUEUE);

            ids.forEach(id => {
                if (id) store.delete(id);
            });
            
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * 删除所有 Goethe 来源的词条
     * 用于清理旧数据
     */
    async deleteGoetheEntries() {
        await this.ensureConnection();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_ENTRIES], 'readwrite');
            const store = tx.objectStore(STORE_ENTRIES);
            let deletedCount = 0;

            const request = store.openCursor();
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const entry = cursor.value;
                    let isGoethe = false;
                    
                    // Check sources array
                    if (entry.sources && Array.isArray(entry.sources)) {
                        isGoethe = entry.sources.some(s => s.type === 'goethe');
                    }
                    // Compatibility check for potential old 'source' field
                    if (!isGoethe && entry.source === 'goethe') {
                        isGoethe = true;
                    }
                    
                    if (isGoethe) {
                        cursor.delete();
                        deletedCount++;
                    }
                    
                    cursor.continue();
                } else {
                    console.log(`[DictDB] Deleted ${deletedCount} Goethe entries`);
                    resolve(deletedCount);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 获取词条总数
     * @returns {Promise<number>}
     */
    async countEntries() {
        await this.ensureConnection();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([STORE_ENTRIES], 'readonly');
            const store = tx.objectStore(STORE_ENTRIES);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }



    // --- 新增：按 word_lower 查询 ---

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
        await this.ensureConnection();
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
        await this.ensureConnection();
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
        await this.ensureConnection();
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
        await this.ensureConnection();
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
        await this.ensureConnection();
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

    /**
     * 获取翻译任务
     */
    async getTask(taskId) {
        const db = await this.ensureConnection();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_TASKS, 'readonly');
            const store = tx.objectStore(STORE_TASKS);
            const request = store.get(taskId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ==========================================
    // Search Index Methods (v4)
    // ==========================================

    /**
     * 批量导入搜索索引 (分批处理以避免 UI 卡死)
     * @param {Object} indexData - { variant: lemma_id, ... }
     */
    async bulkPutSearchIndex(indexData) {
        const db = await this.ensureConnection();
        const keys = Object.keys(indexData);
        const total = keys.length;
        const BATCH_SIZE = 2000; // 每批 2000 条，适中

        console.log(`[DictDB] Starting bulk index import for ${total} items...`);

        // 使用 Promise.all 并不是好的选择，因为我们想要串行执行以减少瞬时内存压力
        // 并允许中间插入 setTimeout
        
        let processed = 0;

        for (let i = 0; i < total; i += BATCH_SIZE) {
            const batchKeys = keys.slice(i, i + BATCH_SIZE);
            
            await new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_SEARCH_INDEX, 'readwrite');
                const store = tx.objectStore(STORE_SEARCH_INDEX);
                
                tx.oncomplete = () => resolve();
                tx.onerror = (e) => {
                    console.error(`[DictDB] Batch import failed at ${i}:`, e);
                    // Continue anyway? Or reject? 
                    // Rejecting stops the whole process. Let's try to resolve to skip bad batch.
                    resolve(); 
                };

                batchKeys.forEach(key => {
                    store.put(indexData[key], key);
                });
            });

            processed += batchKeys.length;
            
            // 每处理一批，稍微休息一下，让出主线程给 UI (如进度条、动画)
            if (i + BATCH_SIZE < total) {
                await new Promise(r => setTimeout(r, 20));
            }
        }
        
        console.log(`[DictDB] Indexed ${processed} variants successfully`);
        return processed;
    }

    /**
     * 查询变位原型 ID
     * @param {string} variant 
     * @returns {Promise<number|undefined>} lemma_id
     */
    async getLemmaId(variant) {
        const db = await this.ensureConnection();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_SEARCH_INDEX, 'readonly');
            const store = tx.objectStore(STORE_SEARCH_INDEX);
            const request = store.get(variant); // key is variant
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 检查索引是否已填充
     */
    async isSearchIndexPopulated() {
        const db = await this.ensureConnection();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_SEARCH_INDEX, 'readonly');
            const store = tx.objectStore(STORE_SEARCH_INDEX);
            const request = store.count();
            
            request.onsuccess = () => resolve(request.result > 0);
            request.onerror = () => resolve(false);
        });
    }
}

export const localDictDB = new LocalDictionaryDB();

