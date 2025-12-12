
import { localDictDB } from './LocalDictionaryDB';
import { aiService } from '../ai/AIService';

// 模拟云端 API (实际开发中替换为真实的 fetch 调用)
class MockCloudAPI {
    async lookup(word) {
        // 模拟延迟
        await new Promise(r => setTimeout(r, 500));
        
        // 模拟云端数据库中只有英文释义的情况
        // 实际场景：fetch('https://api.starvocab.com/dict?w=' + word)
        return {
            found: true,
            entry: {
                id: word.toLowerCase(),
                word: word,
                definition_en: `(Cloud) English definition for ${word}...`,
                pos: 'unknown',
                has_chinese: false, // 标记：云端还没有中文
                source: 'cloud'
            }
        };
    }
}

class UnifiedDictionaryService {
    constructor() {
        this.cloudAPI = new MockCloudAPI();
        this.isProcessingQueue = false;
    }

    /**
     * 核心查询方法
     * @param {string} word - 要查询的单词
     * @returns {Promise<Object|null>} - 返回词条对象
     */
    async lookup(word) {
        const normalizedWord = word.trim();
        const id = normalizedWord.toLowerCase();

        // 1. 查本地数据库
        try {
            const localEntry = await localDictDB.getEntry(id);
            if (localEntry) {
                // 如果本地有，且有中文（或者本来就是纯英文词典），直接返回
                if (localEntry.has_chinese || localEntry.source.startsWith('local_')) {
                    console.log(`[Dict] Local hit for ${word}`);
                    return localEntry;
                }
                // 如果本地有但只有英文（之前缓存的云端结果），也可以返回，
                // 但可以在后台尝试触发翻译（如果还没在队列里）
                return localEntry;
            }
        } catch (e) {
            console.error('[Dict] Local DB lookup failed:', e);
        }

        // 2. 查云端 (Fallback)
        console.log(`[Dict] Local miss for ${word}, querying cloud...`);
        try {
            const cloudResult = await this.cloudAPI.lookup(normalizedWord);
            
            if (cloudResult && cloudResult.found) {
                const entry = cloudResult.entry;

                // 3. 处理云端结果
                if (entry.has_chinese) {
                    // A. 云端已有中文 -> 完美，存入本地，返回
                    await localDictDB.saveEntry(entry);
                    return entry;
                } else {
                    // B. 云端只有英文 -> 
                    //    a. 存入本地缓存（用户下次查能立刻看到英文）
                    //    b. 加入待翻译队列
                    //    c. 返回英文版给用户（秒回体验）
                    
                    console.log(`[Dict] Cloud returned English only. Queuing translation...`);
                    
                    // 标记来源
                    entry.source = 'cloud_pending_translation';
                    
                    // 并行执行：存缓存 + 加队列
                    await Promise.all([
                        localDictDB.saveEntry(entry),
                        localDictDB.addToTranslationQueue(entry)
                    ]);

                    // 触发后台翻译任务（不阻塞当前返回）
                    this.triggerBatchTranslation();

                    return entry;
                }
            }
        } catch (e) {
            console.error('[Dict] Cloud lookup failed:', e);
        }

        return null;
    }

    /**
     * 触发批处理翻译
     * 建议在空闲时或积累了一定数量后调用
     */
    async triggerBatchTranslation() {
        if (this.isProcessingQueue) return;

        // 简单策略：检查队列是否有 5 个以上，或者直接开始处理
        const queue = await localDictDB.getTranslationQueue(10);
        if (queue.length === 0) return;

        this.isProcessingQueue = true;
        console.log(`[Dict] Starting batch translation for ${queue.length} items...`);

        try {
            // 这里演示逐个翻译，实际可以打包发给 AI
            for (const item of queue) {
                try {
                    // 调用 AI 翻译
                    // const translated = await aiService.translate(item.word, context...);
                    
                    // 模拟 AI 翻译结果
                    const mockTranslation = `[AI翻译] ${item.word} 的中文意思`;
                    
                    // 更新词条
                    const updatedEntry = {
                        ...item,
                        translation: mockTranslation,
                        has_chinese: true,
                        source: 'cloud_translated' // 标记为已翻译
                    };

                    // 1. 更新主词库
                    await localDictDB.saveEntry(updatedEntry);
                    
                    // 2. 移出队列
                    await localDictDB.removeFromQueue([item.id]);
                    
                    console.log(`[Dict] Translated and updated: ${item.word}`);
                    
                } catch (err) {
                    console.error(`[Dict] Failed to translate ${item.word}`, err);
                }
            }
        } finally {
            this.isProcessingQueue = false;
            
            // 如果队列里还有，继续处理
            const remaining = await localDictDB.getTranslationQueue(1);
            if (remaining.length > 0) {
                this.triggerBatchTranslation();
            }
        }
    }

    /**
     * 导入数据工具函数
     * @param {Array} commonDictItems - 常用词典数组
     * @param {Array} goetheItems - 歌德词汇数组
     */
    async importData(commonDictItems, goetheItems) {
        console.log('Starting dictionary import...');
        const entries = [];

        // 1. 处理常用词典
        if (commonDictItems) {
            for (const item of commonDictItems) {
                entries.push({
                    id: item.word.toLowerCase().trim(),
                    word: item.word,
                    translation: item.wordTranslation, // 对应您的 wordTranslation
                    definition_en: item.definition_en || '',
                    pos: item.partOfSpeech,
                    article: item.article,
                    plural: item.plural,
                    ipa: item.ipa,
                    audio_url: item.audio_url,
                    frequency: item.frequency_score,
                    source: 'local_common',
                    has_chinese: !!item.wordTranslation
                });
            }
        }

        // 2. 处理歌德词汇 (假设有 level 字段)
        if (goetheItems) {
            for (const item of goetheItems) {
                // 如果已存在（常用词典里有），则合并 tag
                // 这里为了简化，直接覆盖或添加
                entries.push({
                    id: item.word.toLowerCase().trim(),
                    word: item.word,
                    translation: item.translation,
                    tags: [item.level], // e.g., 'A1', 'B1'
                    source: 'local_goethe',
                    has_chinese: true
                });
            }
        }

        // 批量写入 IndexedDB
        const result = await localDictDB.bulkSaveEntries(entries);
        console.log(`Import finished. Saved: ${result.saved}, Errors: ${result.errors}`);
        return result;
    }

    /**
     * 导入独立例句库
     * @param {Array} examples - [{ word: 'Haus', sentence: '...', translation: '...' }]
     */
    async importExamples(examples) {
        if (!examples || !Array.isArray(examples)) return 0;
        console.log(`Importing ${examples.length} examples...`);
        const count = await localDictDB.bulkSaveExamples(examples);
        console.log(`Examples import finished. Count: ${count}`);
        return count;
    }
}

export const unifiedDictService = new UnifiedDictionaryService();
