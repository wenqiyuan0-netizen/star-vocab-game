/**
 * 词典查询服务
 * 
 * 封装所有词典查询逻辑，支持:
 * - 并行查询本地 + 云端
 * - 翻译队列管理
 * - 断点续传
 */

import { localDictDB } from './LocalDictionaryDB';
import { aiService } from '../ai/AIService';
import {
    createUnifiedEntry,
    createTranslationTask,
    updateTaskStatus,
    addTranslationToEntry,
    needsTranslation,
    TASK_STATUS,
    TRANSLATION_STATUS,
    SOURCE_TYPES
} from './models/UnifiedEntry';

/**
 * 模拟云端 API
 * 实际开发中替换为真实的 fetch 调用
 */
class CloudDictionaryAPI {
    async lookup(word) {
        // TODO: 替换为实际的云端 API
        // return fetch(`https://api.starvocab.com/dict?w=${word}`)
        await new Promise(r => setTimeout(r, 300));
        return { found: false, entries: [] };
    }
}

/**
 * 词典查询服务
 */
class LookupService {
    constructor() {
        this.cloudAPI = new CloudDictionaryAPI();
        this.isProcessingQueue = false;
        this.translationListeners = new Set();
    }

    // ============ 核心查询 ============

    /**
     * 查询单词
     * @param {string} word - 要查询的单词
     * @param {Object} options - 查询选项
     * @param {boolean} options.skipCloud - 是否跳过云端查询
     * @param {boolean} options.immediate - 是否立即返回（不等待翻译）
     * @returns {Promise<Object[]>} UnifiedEntry 数组
     */
    async lookup(word, options = {}) {
        const { skipCloud = false, immediate = true } = options;
        const normalizedWord = word.toLowerCase().trim();

        console.log(`[LookupService] Looking up: ${word}`);

        // 1. 查询本地数据库
        let localEntries = [];
        try {
            localEntries = await localDictDB.getEntriesByWord(normalizedWord);
            if (localEntries.length > 0) {
                console.log(`[LookupService] Local hit: ${localEntries.length} entries`);
            }
        } catch (e) {
            console.error('[LookupService] Local lookup error:', e);
        }

        // 2. 并行查询云端（即使本地有结果也查，获取补充信息）
        let cloudEntries = [];
        if (!skipCloud) {
            try {
                const cloudResult = await this.cloudAPI.lookup(normalizedWord);
                if (cloudResult.found && cloudResult.entries) {
                    cloudEntries = cloudResult.entries;
                    console.log(`[LookupService] Cloud hit: ${cloudEntries.length} entries`);
                }
            } catch (e) {
                console.error('[LookupService] Cloud lookup error:', e);
            }
        }

        // 3. 合并结果
        const merged = this.mergeResults(localEntries, cloudEntries);

        // 4. 处理需要翻译的条目
        const pendingTranslation = merged.filter(e => needsTranslation(e));
        if (pendingTranslation.length > 0) {
            console.log(`[LookupService] ${pendingTranslation.length} entries need translation`);

            // 添加到翻译队列
            for (const entry of pendingTranslation) {
                await this.queueForTranslation(entry);
            }

            // 触发后台翻译（不阻塞返回）
            if (!this.isProcessingQueue) {
                this.processTranslationQueue();
            }
        }

        // 5. 保存到本地缓存
        if (cloudEntries.length > 0) {
            await this.cacheEntries(cloudEntries);
        }

        return merged;
    }

    /**
     * 按来源类型查询
     * @param {string} word
     * @param {string} sourceType - goethe, wiktionary, etc.
     * @returns {Promise<Object[]>}
     */
    async lookupBySource(word, sourceType) {
        const normalizedWord = word.toLowerCase().trim();
        return await localDictDB.getEntriesByWordAndSource(normalizedWord, sourceType);
    }

    // ============ 翻译队列管理 ============

    /**
     * 添加到翻译队列
     * @param {Object} entry - UnifiedEntry
     */
    async queueForTranslation(entry) {
        const task = createTranslationTask(entry);

        // 检查是否已在队列中
        const existing = await localDictDB.getTranslationTask(entry.id);
        if (existing && existing.status !== TASK_STATUS.FAILED) {
            return existing;
        }

        await localDictDB.saveTranslationTask(task);
        console.log(`[LookupService] Queued for translation: ${entry.word}`);
        return task;
    }

    /**
     * 处理翻译队列（后台任务）
     * 支持断点续传
     */
    async processTranslationQueue() {
        if (this.isProcessingQueue) return;
        this.isProcessingQueue = true;

        console.log('[LookupService] Starting translation queue processing...');

        try {
            // 获取未完成任务
            let tasks = await localDictDB.getIncompleteTasks(10);

            while (tasks.length > 0) {
                for (const task of tasks) {
                    await this.processTranslationTask(task);
                }

                // 获取下一批
                tasks = await localDictDB.getIncompleteTasks(10);
            }

            console.log('[LookupService] Translation queue empty');
        } catch (e) {
            console.error('[LookupService] Queue processing error:', e);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * 处理单个翻译任务
     * @param {Object} task - TranslationTask
     */
    async processTranslationTask(task) {
        try {
            // 更新状态为处理中
            const processingTask = updateTaskStatus(task, TASK_STATUS.PROCESSING);
            await localDictDB.saveTranslationTask(processingTask);

            // 调用 AI 翻译
            let translation = null;
            if (aiService && aiService.apiKey) {
                try {
                    // 构建翻译上下文
                    const context = {
                        word: task.word,
                        english: task.translation_en,
                        pos: task.word_pos.split('_')[1] || 'unknown'
                    };

                    const result = await aiService.translateWord(context);
                    translation = result?.chinese || result?.cn || result;
                } catch (aiError) {
                    console.warn('[LookupService] AI translation failed:', aiError);
                }
            }

            if (translation) {
                // 翻译成功
                const completedTask = updateTaskStatus(task, TASK_STATUS.COMPLETED, {
                    translation_cn: translation
                });
                await localDictDB.saveTranslationTask(completedTask);

                // 更新主词条
                await this.updateEntryWithTranslation(task.entry_id, translation);

                // 通知监听者
                this.notifyTranslationComplete(task.entry_id, translation);

                console.log(`[LookupService] Translated: ${task.word} → ${translation}`);
            } else {
                // 翻译失败
                const failedTask = updateTaskStatus(task, TASK_STATUS.FAILED, {
                    error: 'Translation returned empty',
                    retry_count: task.retry_count + 1
                });
                await localDictDB.saveTranslationTask(failedTask);
            }
        } catch (e) {
            // 处理失败
            const failedTask = updateTaskStatus(task, TASK_STATUS.FAILED, {
                error: e.message,
                retry_count: task.retry_count + 1
            });
            await localDictDB.saveTranslationTask(failedTask);

            console.error(`[LookupService] Task failed: ${task.word}`, e);
        }
    }

    /**
     * 更新词条翻译
     * @param {string} entryId
     * @param {string} translation
     */
    async updateEntryWithTranslation(entryId, translation) {
        const entry = await localDictDB.getEntry(entryId);
        if (entry) {
            const updated = addTranslationToEntry(entry, translation);
            await localDictDB.saveEntry(updated);
        }
    }

    // ============ 事件监听 ============

    /**
     * 订阅翻译完成事件
     * @param {Function} callback - (entryId, translation) => void
     * @returns {Function} 取消订阅函数
     */
    onTranslationComplete(callback) {
        this.translationListeners.add(callback);
        return () => this.translationListeners.delete(callback);
    }

    /**
     * 通知翻译完成
     */
    notifyTranslationComplete(entryId, translation) {
        for (const listener of this.translationListeners) {
            try {
                listener(entryId, translation);
            } catch (e) {
                console.error('[LookupService] Listener error:', e);
            }
        }
    }

    // ============ 辅助方法 ============

    /**
     * 合并本地和云端结果
     * @param {Object[]} localEntries
     * @param {Object[]} cloudEntries
     * @returns {Object[]}
     */
    mergeResults(localEntries, cloudEntries) {
        const byId = new Map();

        // 本地优先
        for (const entry of localEntries) {
            byId.set(entry.id, entry);
        }

        // 云端补充
        for (const entry of cloudEntries) {
            if (!byId.has(entry.id)) {
                byId.set(entry.id, entry);
            } else {
                // 合并例句等信息
                const existing = byId.get(entry.id);
                const merged = this.mergeEntryData(existing, entry);
                byId.set(entry.id, merged);
            }
        }

        return Array.from(byId.values());
    }

    /**
     * 合并两个词条的数据
     * @param {Object} primary - 主词条（本地）
     * @param {Object} secondary - 辅助词条（云端）
     * @returns {Object}
     */
    mergeEntryData(primary, secondary) {
        return {
            ...primary,
            // 补充缺失字段
            ipa: primary.ipa || secondary.ipa,
            audio_url: primary.audio_url || secondary.audio_url,
            translation_en: primary.translation_en || secondary.translation_en,
            // 合并例句
            examples: [
                ...(primary.examples || []),
                ...(secondary.examples || []).filter(e =>
                    !(primary.examples || []).some(pe => pe.de === e.de)
                )
            ],
            // 合并来源
            sources: [
                ...(primary.sources || []),
                ...(secondary.sources || []).filter(s =>
                    !(primary.sources || []).some(ps => ps.id === s.id)
                )
            ],
            updated_at: Date.now()
        };
    }

    /**
     * 缓存词条到本地
     * @param {Object[]} entries
     */
    async cacheEntries(entries) {
        for (const entry of entries) {
            await localDictDB.saveEntry(entry);
        }
    }

    // ============ 导入接口 ============

    /**
     * 导入词典数据
     * @param {Object[]} entries - UnifiedEntry 数组
     * @returns {Promise<{ saved: number, errors: number }>}
     */
    async importEntries(entries) {
        console.log(`[LookupService] Importing ${entries.length} entries...`);
        const result = await localDictDB.bulkSaveEntries(entries);
        console.log(`[LookupService] Import complete: ${result.saved} saved, ${result.errors} errors`);
        return result;
    }

    /**
     * 导入例句
     * @param {Object[]} examples - 例句数组
     * @returns {Promise<number>}
     */
    async importExamples(examples) {
        return await localDictDB.bulkSaveExamples(examples);
    }

    /**
     * 恢复中断的翻译任务
     * 应在应用启动时调用
     */
    async resumeInterruptedTasks() {
        const processing = await localDictDB.getTasksByStatus(TASK_STATUS.PROCESSING);

        // 将处理中的任务重置为排队状态
        for (const task of processing) {
            const reset = updateTaskStatus(task, TASK_STATUS.QUEUED);
            await localDictDB.saveTranslationTask(reset);
        }

        if (processing.length > 0) {
            console.log(`[LookupService] Resumed ${processing.length} interrupted tasks`);
            this.processTranslationQueue();
        }
    }
}

export const lookupService = new LookupService();
export { LookupService };
export default LookupService;
