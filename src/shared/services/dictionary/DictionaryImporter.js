/**
 * 词典数据导入服务
 * 
 * 提供将预处理的词典数据导入到 IndexedDB 的功能
 */

import { localDictDB } from './LocalDictionaryDB';
import { createGoetheAdapter } from './adapters/GoetheAdapter';
import {
  createUnifiedEntry,
  createSourceRecord,
  SOURCE_TYPES,
  SOURCE_IDS
} from './models/UnifiedEntry';

/**
 * 词典数据导入器
 */
class DictionaryImporter {
    constructor() {
        this.importProgress = {
            total: 0,
            processed: 0,
            errors: []
        };
        this.listeners = new Set();
    }

    /**
     * Helper to process entries in chunks to avoid blocking the main thread
     * @param {Array} entries - All entries to save
     * @param {Function} [onProgress] - Optional callback(percent)
     * @param {number} [batchSize] - Size of each chunk
     */
    async _processInChunks(entries, onProgress, batchSize = 500) {
        let savedTotal = 0;
        let errorTotal = 0;
        const total = entries.length;

        for (let i = 0; i < total; i += batchSize) {
            const chunk = entries.slice(i, i + batchSize);
            
            try {
                const result = await localDictDB.bulkSaveEntries(chunk);
                savedTotal += result.saved;
                errorTotal += result.errors;
            } catch (e) {
                console.error(`[DictionaryImporter] Batch error at index ${i}:`, e);
                errorTotal += chunk.length;
            }

            // Update internal progress state
            const currentProcessed = Math.min(total, i + batchSize);
            this.importProgress.processed = currentProcessed;
            
            // Report progress callback
            if (onProgress) {
                const percent = Math.round((currentProcessed / total) * 100);
                onProgress(percent);
            }

            // Yield to main thread to prevent UI freezing
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        return { saved: savedTotal, errors: errorTotal };
    }

    /**
     * 导入常用词典 (2500词)
     * @param {Object[]} processedData - 预处理后的词典数据
     * @param {Function} [onProgress] - Progress callback(percent)
     * @returns {Promise<{ success: number, errors: number }>}
     */
    async importCommonVocab(processedData, onProgress) {
        console.log(`[DictionaryImporter] Importing ${processedData.length} common vocab entries...`);

        this.importProgress = { total: processedData.length, processed: 0, errors: [] };

        const entries = processedData.map(item => this.convertProcessedEntry(item, SOURCE_IDS.WIKT_2500));

        // Use chunked processing instead of single bulk save
        const result = await this._processInChunks(entries, onProgress);

        console.log(`[DictionaryImporter] Common vocab import complete: ${result.saved} saved, ${result.errors} errors`);
        return result;
    }

    /**
     * 导入 Goethe 词汇表
     * @param {Object[]} goetheData - Goethe 词汇数据
     * @param {string} level - 等级 (A1, A2, B1, B2)
     * @param {Function} [onProgress] - Progress callback(percent)
     * @returns {Promise<{ success: number, errors: number }>}
     */
    async importGoetheVocab(goetheData, level = 'A1', onProgress) {
        console.log(`[DictionaryImporter] Importing ${goetheData.length} Goethe ${level} entries...`);

        const adapter = createGoetheAdapter(level);
        const entries = adapter.adaptBatch(goetheData);

        // Use chunked processing
        const result = await this._processInChunks(entries, onProgress);

        console.log(`[DictionaryImporter] Goethe ${level} import complete: ${result.saved} saved, ${result.errors} errors`);
        return result;
    }

    /**
     * 转换预处理后的词条为 UnifiedEntry 格式
     */
    convertProcessedEntry(item, sourceId) {
        const word = item.word;
        const pos = this.normalizePos(item.pos);

        // 提取冠词和性别
        const { article, gender } = this.extractArticleGender(item.article, pos);

        const entry = createUnifiedEntry({
            word: word,
            pos: pos,
            article: article,
            gender: gender,
            plural: item.plural || '',

            // 释义
            translation_cn: item.translation_cn || '',
            translation_en: item.translation || '',

            // 发音
            ipa: item.ipa || '',
            audio_url: item.audio || '',  // 标准字段
            audio: item.audio || '',      // 源数据字段（兼容性）

            // 例句
            examples: item.example_de ? [{
                de: item.example_de,
                cn: item.example_cn || '',
                source: sourceId
            }] : [],

            // 元数据
            rank: item.rank || null,

            // 来源
            sources: [createSourceRecord(SOURCE_TYPES.WIKTIONARY, sourceId)],

            // 状态
            has_chinese: true,
            translation_status: 'complete'
        });

        return entry;
    }

    /**
     * 标准化词性
     */
    normalizePos(pos) {
        if (!pos) return 'unknown';
        const posLower = pos.toLowerCase().trim();
        const mapping = {
            'intj': 'intj', 'interj': 'intj', 'interjection': 'intj',
            'n': 'noun', 'v': 'verb', 'a': 'adj',
            'adjective': 'adj', 'adverb': 'adv',
            'preposition': 'prep', 'conjunction': 'conj',
            'pronoun': 'pron', 'determiner': 'det'
        };
        return mapping[posLower] || posLower;
    }

    /**
     * 提取冠词和性别
     */
    extractArticleGender(articleRaw, pos) {
        if (!articleRaw || pos !== 'noun') {
            return { article: '', gender: '' };
        }
        const art = articleRaw.toLowerCase().trim();
        const mapping = {
            'der': { article: 'der', gender: 'm' },
            'die': { article: 'die', gender: 'f' },
            'das': { article: 'das', gender: 'n' },
            'm': { article: 'der', gender: 'm' },
            'f': { article: 'die', gender: 'f' },
            'n': { article: 'das', gender: 'n' }
        };
        return mapping[art] || { article: articleRaw, gender: '' };
    }

    /**
     * 从 JSON 文件导入 (用于浏览器环境)
     * @param {File} file - JSON 文件
     * @param {string} type - 'common' | 'goethe'
     * @param {string} level - Goethe 等级 (可选)
     */
    async importFromFile(file, type = 'common', level = 'A1') {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);

                    let result;
                    if (type === 'common') {
                        result = await this.importCommonVocab(data);
                    } else if (type === 'goethe') {
                        result = await this.importGoetheVocab(data, level);
                    } else {
                        throw new Error(`Unknown import type: ${type}`);
                    }

                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    /**
     * 从 URL 导入 (用于 App 内置词典)
     * @param {string} url - JSON 文件 URL
     * @param {string} type - 'common' | 'goethe'
     * @param {string} level - Goethe 等级
     */
    async importFromUrl(url, type = 'common', level = 'A1') {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.status}`);
        }

        const data = await response.json();

        if (type === 'common') {
            return await this.importCommonVocab(data);
        } else if (type === 'goethe') {
            return await this.importGoetheVocab(data, level);
        } else {
            throw new Error(`Unknown import type: ${type}`);
        }
    }

    /**
     * 获取当前导入统计
     */
    async getImportStats() {
        // TODO: 实现统计查询
        return {
            totalEntries: 0,
            bySource: {}
        };
    }
}

export const dictionaryImporter = new DictionaryImporter();
export { DictionaryImporter };
export default DictionaryImporter;
