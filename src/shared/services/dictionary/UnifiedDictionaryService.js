
import { localDictDB } from './LocalDictionaryDB';
import { unifiedSearch } from '../../../utils/unifiedDictionarySearch';
import { localDict } from '../../../utils/localDictionary';

class UnifiedDictionaryService {
    constructor() {
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

    /**
     * 从冠词提取性别
     * @param {string} article - 冠词 (der, die, das)
     * @returns {string} - 'm', 'f', 'n', 或 ''
     */
    extractGender(article) {
        if (!article) return '';
        const art = article.toLowerCase().trim();
        if (art === 'der' || art === 'm') return 'm';
        if (art === 'die' || art === 'f') return 'f';
        if (art === 'das' || art === 'n') return 'n';
        return '';
    }

    /**
     * 格式化例句
     * @param {Array} deExamples - 德语例句数组
     * @param {Array} cnExamples - 中文例句数组
     * @returns {Array} - 格式化的例句对象数组
     */
    formatExamples(deExamples, cnExamples) {
        if (!deExamples || !Array.isArray(deExamples)) return [];
        return deExamples.map((de, i) => ({
            de: de,
            cn: cnExamples && cnExamples[i] ? cnExamples[i] : ''
        }));
    }

    async lookup(word) {
        const normalizedWord = word.trim();

        // 0. 检查是否正在初始化词典
        if (window._dictInitializing) {
            console.log(`[Dict] Dictionary initializing, waiting to query ${word}...`);
            await this.waitForInitialization();
        }

        // 1. 查预置词典 (localDict - 内存缓存)
        try {
            const localEntries = await localDict.lookup(normalizedWord);
            if (localEntries && localEntries.length > 0) {
                console.log(`[Dict] Local dictionary hit for ${word} (${localEntries.length} entries found)`);

                // 转换格式为统一的 Entry 格式
                const convertedEntries = localEntries.map(e => ({
                    id: e.w.toLowerCase(),
                    word: e.w,
                    pos: e.p || 'unknown',
                    gender: this.extractGender(e.a),
                    article: e.a,
                    plural: e.pl,
                    translation: e.c ? e.c.join('; ') : '',
                    translation_cn: e.c ? e.c.join('; ') : '',
                    definition_en: e.e ? e.e.join('; ') : '',
                    ipa: e.i,
                    audio: e.audio,           // 音频 URL
                    audio_url: e.audio,       // 兼容字段
                    audioUrl: e.audio,        // 兼容字段
                    examples: this.formatExamples(e.x, e.xc),
                    source: 'local_common',
                    has_chinese: !!(e.c && e.c.length > 0)
                }));

                // 尝试找到与输入词完全匹配的条目（区分大小写）
                const exactMatchEntries = convertedEntries.filter(e => e.word === word);

                let targetEntries = convertedEntries;
                if (exactMatchEntries.length > 0 && exactMatchEntries.length < convertedEntries.length) {
                    console.log(`[Dict] Filtering exact case matches for "${word}"`);
                    targetEntries = exactMatchEntries;
                }

                const merged = this.mergeEntries(targetEntries);

                // 注入独立存储的例句（如果有）
                try {
                    const extraExamples = await localDictDB.getExamples(normalizedWord);
                    if (extraExamples && extraExamples.length > 0) {
                        merged.examples = [...(merged.examples || []), ...extraExamples];
                    }
                } catch (e) {
                    // IndexedDB 查询失败不影响主流程
                    console.warn('[Dict] Failed to load extra examples:', e);
                }

                return merged;
            }
        } catch (e) {
            console.error('[Dict] Local dictionary lookup failed:', e);
        }

        // 1.5 查本地数据库 (IndexedDB - 用户导入/缓存)
        try {
            const dbEntries = await localDictDB.getEntriesByWord(normalizedWord);
            if (dbEntries && dbEntries.length > 0) {
                console.log(`[Dict] Local DB hit for ${word} (${dbEntries.length} entries found)`);

                // 标记来源
                dbEntries.forEach(e => {
                    if (!e.source_tags) e.source_tags = ['local_db'];
                    // 确保有必要的字段用于合并
                    if (!e.translation && e.translation_cn) e.translation = e.translation_cn;
                });

                // 尝试找到与输入词完全匹配的条目（区分大小写）
                const exactMatchEntries = dbEntries.filter(e => e.word === word);
                let targetEntries = dbEntries;
                if (exactMatchEntries.length > 0 && exactMatchEntries.length < dbEntries.length) {
                    targetEntries = exactMatchEntries;
                }

                const merged = this.mergeEntries(targetEntries);

                // 注入独立存储的例句（如果有）
                try {
                    const extraExamples = await localDictDB.getExamples(normalizedWord);
                    if (extraExamples && extraExamples.length > 0) {
                        merged.examples = [...(merged.examples || []), ...extraExamples];
                    }
                } catch (e) {
                    console.warn('[Dict] Failed to load extra examples for DB entry:', e);
                }

                return merged;
            }
        } catch (e) {
            console.warn('[Dict] Local DB lookup failed:', e);
        }

        // 2. 查统一词典 (本地 Common + Cloud + Lemmatization)
        console.log(`[Dict] Local/DB miss for ${word}, querying Unified Dictionary...`);
        try {
            const result = await unifiedSearch.search(normalizedWord);

            if (result.found && result.entries.length > 0) {
                console.log(`[Dict] Unified Search hit: ${result.source}`);

                // 转换所有 entries 为统一格式
                const convertedEntries = result.entries.map(e => ({
                    id: e.w.toLowerCase(), // 使用原型ID
                    word: e.w,
                    pos: e.p || 'unknown',
                    translation: e.c ? e.c.join('; ') : '',
                    definition_en: e.e ? e.e.join('; ') : '',
                    source: result.source,
                    has_chinese: !!(e.c && e.c.length > 0)
                }));

                // 同样的精确匹配过滤逻辑
                const exactMatchEntries = convertedEntries.filter(e => e.word === word);
                let targetEntries = convertedEntries;
                if (exactMatchEntries.length > 0 && exactMatchEntries.length < convertedEntries.length) {
                    targetEntries = exactMatchEntries;
                }

                const merged = this.mergeEntries(targetEntries);
                
                // 补充搜索元数据
                merged.original_search = normalizedWord;
                merged.is_lemma_result = result.searchMethod.includes('lemmatization');
                merged.lemmas = result.lemmas || [];

                // 3. 处理翻译逻辑
                // 检查合并后的结果是否有中文翻译
                const hasChinese = merged.translation && /[\u4e00-\u9fa5]/.test(merged.translation);

                if (hasChinese) {
                    // A. 有中文 -> 注入例句并返回
                    const extraExamples = await localDictDB.getExamples(normalizedWord);
                    if (extraExamples && extraExamples.length > 0) {
                        merged.examples = [...(merged.examples || []), ...extraExamples];
                    }
                    return merged;
                } else {
                    // B. 只有英文 -> 加入翻译队列
                    console.log(`[Dict] Result has English only. Queuing translation...`);
                    
                    // 我们需要保存一个具体的条目到本地数据库以供翻译
                    // 选择最匹配的一个条目进行保存
                    if (targetEntries.length > 0) {
                        const candidate = { ...targetEntries[0] };
                        candidate.source = 'cloud_pending_translation';
                        
                        // 存入本地并加入队列
                        await Promise.all([
                            localDictDB.saveEntry(candidate),
                            localDictDB.addToTranslationQueue(candidate)
                        ]);

                        this.triggerBatchTranslation();
                    }
                    
                    return merged;
                }
            }
        } catch (e) {
            console.error('[Dict] Unified lookup failed:', e);
        }

        return null;
    }

    async waitForInitialization() {
        let checks = 0;
        while (window._dictInitializing && checks < 60) { // 30s timeout
            await new Promise(resolve => setTimeout(resolve, 500));
            checks++;
        }
        if (window._dictInitializing) {
            console.warn('[Dict] Initialization timed out, proceeding anyway...');
        }
    }

    /**
     * 搜索词典并返回所有匹配结果列表（区分大小写）
     * 用于 LibraryView 等列表展示
     * @param {string} word 
     * @returns {Promise<Array>}
     */
    async search(word) {
        // 0. 检查是否正在初始化词典
        if (window._dictInitializing) {
            console.log(`[Dict] Dictionary initializing, waiting to search ${word}...`);
            await this.waitForInitialization();
        }

        const normalizedWord = word.trim();
        let allEntries = [];

        // 1. 查统一词典 (Common + Cloud + Lemma)
        try {
            const result = await unifiedSearch.search(normalizedWord);
            if (result.found && result.entries.length > 0) {
                const converted = result.entries.map(e => {
                    // 解析性别 (简单映射)
                    let gender = '';
                    let article = e.a || '';
                    if (article) {
                        const art = article.toLowerCase().trim();
                        if (art === 'der' || art === 'm') gender = 'm';
                        else if (art === 'die' || art === 'f') gender = 'f';
                        else if (art === 'das' || art === 'n') gender = 'n';
                    }

                    return {
                        id: `dict_${e.w}_${e.p || 'unk'}_${gender}`, // 临时 ID (包含性别以区分)
                        word: e.w,
                        pos: e.p || 'unknown',
                        article: article,
                        gender: gender,
                        translation: e.c ? e.c.join('; ') : '',
                        definition_en: e.e ? e.e.join('; ') : '',
                        source: result.source,
                        has_chinese: !!(e.c && e.c.length > 0),
                        source_tags: [result.source]
                    };
                });
                allEntries = [...allEntries, ...converted];
            }
        } catch (e) {
            console.warn('[Dict] Search unified failed:', e);
        }

        // 2. 查本地数据库 (User DB)
        try {
            const localEntries = await localDictDB.getEntriesByWord(normalizedWord);
            if (localEntries && localEntries.length > 0) {
                // 标记来源
                localEntries.forEach(e => {
                    if (!e.source_tags) e.source_tags = ['local_db'];
                });
                allEntries = [...allEntries, ...localEntries];
            }
        } catch (e) {
            console.warn('[Dict] Search local DB failed:', e);
        }

        // 3. 分组并合并
        const grouped = {};
        allEntries.forEach(e => {
            // 区分大小写 + 词性 + 性别 分组
            // 这样可以区分:
            // - "morgen" (adv) vs "Morgen" (noun)
            // - "Band" (noun, f) vs "Band" (noun, n)
            
            const wordKey = (e.word || e.headword || '').trim();
            const posKey = (e.pos || 'unknown').toLowerCase();
            const genderKey = (e.gender || '').toLowerCase();
            
            // 构造唯一键
            const key = `${wordKey}|${posKey}|${genderKey}`;
            
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(e);
        });

        const displayList = [];
        Object.values(grouped).forEach(group => {
            const merged = this.mergeEntries(group);
            if (merged) {
                // 确保有 ID
                if (!merged.id) merged.id = `merged_${merged.word}_${merged.pos || 'unk'}_${merged.gender || ''}`;
                displayList.push(merged);
            }
        });

        return displayList;
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
                    if (item.id) {
                        await localDictDB.removeFromQueue([item.id]);
                    }

                    console.log(`[Dict] Translated and updated: ${item.word}`);

                } catch (err) {
                    console.error(`[Dict] Failed to translate ${item.word}`, err);
                    // CRITICAL FIX: Remove failed item to prevent infinite retry loop
                    if (item.id) {
                        try {
                            await localDictDB.removeFromQueue([item.id]);
                            console.log(`[Dict] Removed failed item from queue: ${item.word}`);
                        } catch (remErr) {
                            console.error(`[Dict] Failed to remove broken item ${item.id}`, remErr);
                        }
                    }
                }
            }
        } finally {
            this.isProcessingQueue = false;

            // 如果队列里还有，继续处理 (Add delay to prevent UI freeze)
            const remaining = await localDictDB.getTranslationQueue(1);
            if (remaining.length > 0) {
                setTimeout(() => this.triggerBatchTranslation(), 200);
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
