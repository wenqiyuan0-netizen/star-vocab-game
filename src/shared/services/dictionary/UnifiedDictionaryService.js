
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
     * @returns {Promise<Object|null>} - 返回词条对象 (优先返回有中文的)
     */
    /**
     * 合并多个词条为一个完整视图
     * @param {Array} entries 
     */
    mergeEntries(entries) {
        if (!entries || entries.length === 0) return null;
        if (entries.length === 1) return entries[0];

        // 1. 选出最佳的主词条 (优先选有词性的、有中文的)
        let mainEntry = entries.find(e => e.pos && e.pos !== 'unknown' && e.translation) ||
            entries.find(e => e.translation) ||
            entries[0];

        // 2. 也是深拷贝一份，避免修改原数据
        const merged = { ...mainEntry };

        // 3. 初始化合并容器
        const sources = new Set();
        const translations = new Set();
        const examples = [];
        const definitions = new Set();

        if (merged.source) sources.add(this.formatSource(merged.source));
        if (merged.translation) translations.add(merged.translation);
        if (merged.definition_en) definitions.add(merged.definition_en);

        // 4. 遍历所有词条进行合并
        entries.forEach(e => {
            // 合并来源
            if (e.source) sources.add(this.formatSource(e.source));

            // 合并中文翻译 (去重)
            if (e.translation) {
                // 简单的分号分割处理
                e.translation.split(/[;；]/).forEach(t => {
                    const cleanT = t.trim();
                    if (cleanT) translations.add(cleanT);
                });
            }
            if (e.translation_cn) {
                e.translation_cn.split(/[;；]/).forEach(t => {
                    const cleanT = t.trim();
                    if (cleanT) translations.add(cleanT);
                });
            }

            // 合并英文释义
            if (e.definition_en) definitions.add(e.definition_en);

            // 合并例句 (如果有) - 假设例句可能是 stored within 'examples' field or just implicit
            // 如果词条对象里有例句数组
            if (e.examples && Array.isArray(e.examples)) {
                examples.push(...e.examples);
            }
        });

        // 5. 应用合并结果

        // 来源标签
        merged.source_tags = Array.from(sources);

        // 格式化合并后的翻译
        merged.translation = Array.from(translations).join('; ');

        // 英文释义(选最长的或者合并)
        merged.definition_en = Array.from(definitions).join(' | ');

        // 统一例句 (去重可能比较难，先全部放进去)
        merged.examples = examples;

        // 标记为已合并
        merged._isMerged = true;
        merged._entryCount = entries.length;

        return merged;
    }

    formatSource(source) {
        if (!source) return 'Unknown';
        if (source.includes('common')) return '常用词表';
        if (source.includes('goethe')) return '歌德词汇';
        if (source.includes('cloud')) return '云端词典';
        return source;
    }

    async lookup(word) {
        const normalizedWord = word.trim();

        // 0. 检查是否正在初始化词典
        if (window._dictInitializing) {
            console.log(`[Dict] Dictionary initializing, skipping query for ${word}`);
            return null;
        }

        // 1. 查本地数据库 (使用 word_lower 索引)
        try {
            const localEntries = await localDictDB.getEntriesByWord(normalizedWord);
            if (localEntries && localEntries.length > 0) {
                console.log(`[Dict] Local hit for ${word} (${localEntries.length} entries found)`);

                // 执行合并逻辑
                const mergedEntry = this.mergeEntries(localEntries);
                return mergedEntry;
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
