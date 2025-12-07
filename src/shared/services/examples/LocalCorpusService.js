export class LocalCorpusService {
  constructor() {
    this.dbName = 'StarVocabCorpus';
    this.dbVersion = 2;
    this.db = null;
    this.readyPromise = this.initDB();
    // Catch initialization errors to prevent global "Uncaught (in promise)"
    this.readyPromise.catch(err => {
      console.warn("LocalCorpusService failed to initialize:", err);
    });
  }

  initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = (event) => {
        // Use event.target.error for clearer logging
        const error = event.target.error;
        console.error("LocalCorpusService: IndexedDB error", error);
        reject(error || new Error("IndexedDB request failed"));
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        let store;
        if (!db.objectStoreNames.contains('sentences')) {
          store = db.createObjectStore('sentences', { keyPath: 'id', autoIncrement: true });
          store.createIndex('words', 'words', { unique: false, multiEntry: true });
          store.createIndex('source', 'source', { unique: false });
        } else {
          store = event.target.transaction.objectStore('sentences');
        }

        // Version 2: Add unique index on text to prevent duplicates
        if (!store.indexNames.contains('text')) {
           // Note: If existing data has duplicates, this might fail. 
           // Ideally we should clean data, but for now we assume clean state or handle failure.
           try {
             store.createIndex('text', 'text', { unique: true });
           } catch (e) {
             console.warn("Could not create unique index on 'text', possibly due to duplicates. Trying non-unique.", e);
             try {
               store.createIndex('text', 'text', { unique: false });
             } catch (e2) {
               console.error("Failed to create index on 'text'", e2);
             }
           }
        }
      };
    });
  }

  async addArticle(title, content) {
    let dbReady = true;
    try {
      await this.readyPromise;
    } catch (e) {
      dbReady = false;
      console.warn('LocalCorpusService: IndexedDB unavailable, using in-memory count.');
    }

    const sentences = this._splitSentences(content);

    if (!dbReady || !this.db) {
      let count = 0;
      // In-memory fallback (no persistence, so no deduplication across sessions unless we implement it)
      // But we can deduplicate within the batch
      const seen = new Set();
      for (const sentence of sentences) {
        const cleanSentence = sentence.trim();
        if (cleanSentence.length < 10) continue;
        if (seen.has(cleanSentence)) continue;
        
        const words = cleanSentence.toLowerCase()
          .replace(/[.,/#!$%^&*;:{}=\-_`~()"?]/g, '')
          .split(/\s+/)
          .filter(w => w.length > 1);
        if (words.length === 0) continue;
        
        seen.add(cleanSentence);
        count++;
      }
      return count;
    }

    const transaction = this.db.transaction(['sentences'], 'readwrite');
    const store = transaction.objectStore('sentences');

    let count = 0;
    for (const sentence of sentences) {
      const cleanSentence = sentence.trim();
      if (cleanSentence.length < 10) continue;

      const words = cleanSentence.toLowerCase()
        .replace(/[.,/#!$%^&*;:{}=\-_`~()"?]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 1);

      if (words.length === 0) continue;

      const request = store.add({
        text: cleanSentence,
        words: [...new Set(words)],
        source: title,
        addedAt: Date.now()
      });

      request.onsuccess = () => {
        count++;
      };

      request.onerror = (e) => {
        // Prevent transaction abort on duplicate key error
        e.preventDefault();
        e.stopPropagation();
        // console.log('Duplicate sentence skipped:', cleanSentence);
      };
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve(count);
      transaction.onerror = (e) => reject(e);
    });
  }

  async findExamples(word) {
    try {
      await this.readyPromise;
    } catch (e) {
      return [];
    }
    if (!this.db) return [];
    const lowerWord = word.toLowerCase().trim();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sentences'], 'readonly');
      const store = transaction.objectStore('sentences');
      const index = store.index('words');

      const request = index.getAll(lowerWord);

      request.onsuccess = () => {
        const results = request.result.map(item => ({
          de: item.text,
          cn: `[本地库: ${item.source}]`,
          source: 'local'
        }));
        resolve(this._shuffleArray(results).slice(0, 5));
      };

      request.onerror = (event) => {
        console.error("LocalCorpusService findExamples error:", event.target.error);
        reject(event.target.error || new Error("IndexedDB request failed"));
      };
    });
  }

  async getStats() {
    try {
      await this.readyPromise;
    } catch (e) {
      return { count: 0 };
    }
    if (!this.db) return { count: 0 };
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['sentences'], 'readonly');
      const store = transaction.objectStore('sentences');
      const countRequest = store.count();
      countRequest.onsuccess = () => resolve({ count: countRequest.result });
      countRequest.onerror = (e) => reject(e);
    });
  }
    
  _shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  _splitSentences(text) {
    const out = [];
    let start = 0;
    const len = text.length;
    for (let i = 0; i < len; i++) {
      const ch = text[i];
      if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') {
        let j = i + 1;
        while (j < len && /\s/.test(text[j])) j++;
        const next = text[j];
        const isBoundary = ch === '\n' || !next || /[A-ZÄÖÜ]/.test(next);
        if (isBoundary) {
          out.push(text.slice(start, i + 1));
          start = i + 1;
        }
      }
    }
    if (start < len) out.push(text.slice(start));
    return out.filter(s => s && s.trim().length);
  }
}

export const localCorpusService = new LocalCorpusService();
