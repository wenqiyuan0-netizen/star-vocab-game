/**
 * 翻译服务 - 核心逻辑
 * 
 * 负责：
 * 1. 批量查询云端词典
 * 2. 调用AI翻译
 * 3. 降级处理
 * 4. 错误日志
 */

import { compressEntry, addTranslation, needsTranslation, generateTranslationJSON } from './cloudDictionaryFormat.js';
import { searchWord } from './dictionaryService.js';

// 配置
const CONFIG = {
    maxBatchSize: 50,           // 最大批量数
    smallBatchSize: 10,         // 小批量数（降级时使用）
    maxPromptLength: 8000,      // 最大提示词长度
    timeout: 30000,             // 超时时间（毫秒）
    retryAttempts: 3,           // 重试次数
    retryDelay: 1000,           // 重试延迟（毫秒）
    batchDelay: 1000            // 批次间延迟（毫秒）
};

/**
 * 翻译错误日志
 * @typedef {Object} TranslationError
 * @property {number} timestamp - 时间戳
 * @property {string} word - 单词
 * @property {Object} request - 请求内容
 * @property {Object} response - 响应内容
 * @property {number} retryCount - 重试次数
 * @property {string} stage - 失败阶段
 */

// 错误日志存储
const errorLogs = [];

/**
 * 主要翻译函数 - 批量查询和翻译
 * @param {string[]} words - 单词数组
 * @param {Object} cloudDict - 云端词典接口
 * @param {Function} aiTranslateFn - AI翻译函数
 * @returns {Promise<Object>} - 翻译结果
 */
export async function translateWords(words, cloudDict, aiTranslateFn) {
    console.log(`开始处理 ${words.length} 个单词...`);

    // 步骤1：查询云端词典
    const { translated, needTranslation } = await queryCloudDictionary(words, cloudDict);

    console.log(`已翻译: ${translated.length}, 需翻译: ${needTranslation.length}`);

    // 如果全部已翻译，直接返回
    if (needTranslation.length === 0) {
        return {
            success: true,
            results: translated,
            newTranslations: [],
            errors: []
        };
    }

    // 步骤2：从本地词典提取需要翻译的词条
    const entriesToTranslate = await extractFromLocalDictionary(needTranslation);

    // 步骤3：翻译（带降级机制）
    const translationResults = await translateWithFallback(
        entriesToTranslate,
        aiTranslateFn
    );

    // 步骤4：保存翻译结果
    const savedEntries = await saveTranslations(
        translationResults.success,
        cloudDict
    );

    // 返回完整结果
    return {
        success: true,
        results: [...translated, ...savedEntries],
        newTranslations: savedEntries,
        errors: translationResults.errors
    };
}

/**
 * 查询云端词典
 * @param {string[]} words - 单词数组
 * @param {Object} cloudDict - 云端词典接口
 * @returns {Promise<Object>} - 查询结果
 */
async function queryCloudDictionary(words, cloudDict) {
    try {
        // 批量查询
        const results = await cloudDict.getBatch(words);

        const translated = [];
        const needTranslation = [];

        words.forEach(word => {
            const entry = results[word];

            if (entry && !needsTranslation(entry)) {
                // 已有中文翻译
                translated.push(entry);
            } else {
                // 需要翻译（不存在或无中文）
                needTranslation.push(word);
            }
        });

        return { translated, needTranslation };
    } catch (error) {
        console.error('查询云端词典失败:', error);

        // 查询失败，全部视为需要翻译
        return {
            translated: [],
            needTranslation: words
        };
    }
}

/**
 * 从本地词典提取词条
 * @param {string[]} words - 单词数组
 * @returns {Promise<CloudDictionaryEntry[]>} - 压缩的词条数组
 */
async function extractFromLocalDictionary(words) {
    const entries = [];

    for (const word of words) {
        try {
            // 从本地JSONL词典查询
            const fullEntries = await searchWord(word);

            if (fullEntries && fullEntries.length > 0) {
                // 压缩词条（可能有多个词性）
                for (const fullEntry of fullEntries) {
                    const compressed = compressEntry(fullEntry);
                    if (compressed) {
                        entries.push(compressed);
                    }
                }
            } else {
                console.warn(`本地词典未找到: ${word}`);
            }
        } catch (error) {
            console.error(`提取词条失败 (${word}):`, error);
        }
    }

    return entries;
}

/**
 * 翻译（带降级机制）
 * @param {CloudDictionaryEntry[]} entries - 词条数组
 * @param {Function} aiTranslateFn - AI翻译函数
 * @returns {Promise<Object>} - 翻译结果
 */
async function translateWithFallback(entries, aiTranslateFn) {
    const errors = [];

    try {
        // Level 1: 批量翻译（最多50个）
        console.log(`尝试批量翻译 ${entries.length} 个词条...`);
        const results = await batchTranslate(entries, aiTranslateFn, CONFIG.maxBatchSize);

        return { success: results, errors };
    } catch (error) {
        console.warn('批量翻译失败，降级到小批量...', error.message);

        logError({
            stage: 'batch_translate_level1',
            entries,
            error
        });

        try {
            // Level 2: 小批量（10个）
            const results = await batchTranslate(entries, aiTranslateFn, CONFIG.smallBatchSize);

            return { success: results, errors };
        } catch (error2) {
            console.warn('小批量翻译失败，降级到单个翻译...', error2.message);

            logError({
                stage: 'batch_translate_level2',
                entries,
                error: error2
            });

            // Level 3: 单个翻译
            const { success, failed } = await individualTranslate(entries, aiTranslateFn);

            // 记录失败的词条
            failed.forEach(f => errors.push(f));

            return { success, errors };
        }
    }
}

/**
 * 批量翻译
 * @param {CloudDictionaryEntry[]} entries - 词条数组
 * @param {Function} aiTranslateFn - AI翻译函数
 * @param {number} batchSize - 批量大小
 * @returns {Promise<CloudDictionaryEntry[]>} - 翻译后的词条
 */
async function batchTranslate(entries, aiTranslateFn, batchSize) {
    // 分批
    const batches = splitIntoBatches(entries, batchSize);
    console.log(`分为 ${batches.length} 批，每批最多 ${batchSize} 个`);

    const allResults = [];

    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(`处理批次 ${i + 1}/${batches.length} (${batch.length}个词条)...`);

        try {
            // 生成翻译JSON
            const translationJSON = generateTranslationJSON(batch);

            // 生成提示词
            const prompt = generateBatchPrompt(batch);

            // 调用AI翻译
            const aiResponse = await aiTranslateFn(prompt);

            // 解析AI返回的翻译
            const translations = parseAIResponse(aiResponse, batch);

            // 将翻译添加到词条
            const translatedBatch = batch.map((entry, idx) => {
                if (translations[idx]) {
                    return addTranslation(entry, translations[idx]);
                }
                return entry; // 翻译失败，保留原词条
            });

            allResults.push(...translatedBatch);

            // 批次间延迟（避免API限流）
            if (i < batches.length - 1) {
                await sleep(CONFIG.batchDelay);
            }
        } catch (error) {
            console.error(`批次 ${i + 1} 翻译失败:`, error);
            throw error; // 抛出错误，触发降级
        }
    }

    return allResults;
}

/**
 * 单个翻译（降级方案）
 * @param {CloudDictionaryEntry[]} entries - 词条数组
 * @param {Function} aiTranslateFn - AI翻译函数
 * @returns {Promise<Object>} - 成功和失败的词条
 */
async function individualTranslate(entries, aiTranslateFn) {
    const success = [];
    const failed = [];

    for (const entry of entries) {
        try {
            console.log(`单独翻译: ${entry.w}...`);

            const prompt = generateSinglePrompt(entry);
            const aiResponse = await aiTranslateFn(prompt);
            const translation = parseAIResponse(aiResponse, [entry])[0];

            if (translation) {
                success.push(addTranslation(entry, translation));
            } else {
                failed.push({
                    word: entry.w,
                    error: '无法解析AI返回'
                });
            }

            // 延迟
            await sleep(500);
        } catch (error) {
            console.error(`翻译失败 (${entry.w}):`, error);

            failed.push({
                word: entry.w,
                error: error.message,
                entry,
                response: error.response?.data
            });

            // 记录错误日志
            logError({
                stage: 'individual_translate',
                word: entry.w,
                entry,
                error
            });
        }
    }

    return { success, failed };
}

/**
 * 生成批量翻译提示词
 * @param {CloudDictionaryEntry[]} entries - 词条数组
 * @returns {string} - 提示词
 */
function generateBatchPrompt(entries) {
    const wordsJSON = generateTranslationJSON(entries);

    return `请将以下德语单词批量翻译成中文。返回JSON数组格式，每个元素包含该单词的中文释义数组。

**输入格式**:
\`\`\`json
${wordsJSON}
\`\`\`

**要求**:
1. 返回格式必须是JSON数组
2. 数组长度与输入相同
3. 每个元素是字符串数组，包含1-3个中文释义
4. 释义要准确、简洁、常用
5. 根据词性提供合适的翻译

**返回格式示例**:
\`\`\`json
[
  ["学习", "学会"],
  ["房子", "住宅", "家"],
  ["书", "书籍"]
]
\`\`\`

请只返回JSON数组，不要包含其他解释文字。`;
}

/**
 * 生成单个翻译提示词
 * @param {CloudDictionaryEntry} entry - 词条
 * @returns {string} - 提示词
 */
function generateSinglePrompt(entry) {
    return `请将以下德语单词翻译成中文：

**单词**: ${entry.w}
**词性**: ${entry.p}
**英文释义**: ${(entry.e || []).join(', ')}
${entry.x ? `**例句**: ${entry.x.join(' / ')}` : ''}

请提供1-3个最常用的中文释义，以JSON字符串数组格式返回：
\`\`\`json
["释义1", "释义2", "释义3"]
\`\`\``;
}

/**
 * 解析AI返回的翻译
 * @param {string} aiResponse - AI返回内容
 * @param {CloudDictionaryEntry[]} entries - 原词条数组
 * @returns {string[][]} - 中文释义数组
 */
function parseAIResponse(aiResponse, entries) {
    try {
        // 尝试提取JSON
        const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('未找到JSON数组');
        }

        const translations = JSON.parse(jsonMatch[0]);

        // 验证长度
        if (!Array.isArray(translations)) {
            throw new Error('返回格式不是数组');
        }

        if (translations.length !== entries.length) {
            console.warn(`翻译数量不匹配: 期望${entries.length}, 实际${translations.length}`);
        }

        return translations;
    } catch (error) {
        console.error('解析AI返回失败:', error);
        throw error;
    }
}

/**
 * 保存翻译结果到云端词典
 * @param {CloudDictionaryEntry[]} entries - 翻译后的词条
 * @param {Object} cloudDict - 云端词典接口
 * @returns {Promise<CloudDictionaryEntry[]>} - 保存成功的词条
 */
async function saveTranslations(entries, cloudDict) {
    if (!entries || entries.length === 0) {
        return [];
    }

    try {
        console.log(`保存 ${entries.length} 个翻译到云端...`);

        await cloudDict.setBatch(entries);

        console.log('保存成功！');
        return entries;
    } catch (error) {
        console.error('保存翻译失败:', error);
        throw error;
    }
}

/**
 * 记录错误日志
 * @param {Object} errorInfo - 错误信息
 */
function logError(errorInfo) {
    const log = {
        timestamp: Date.now(),
        ...errorInfo
    };

    errorLogs.push(log);

    // 同时打印到控制台
    console.error('[Translation Error]', log);
}

/**
 * 获取错误日志
 * @returns {TranslationError[]} - 错误日志数组
 */
export function getErrorLogs() {
    return [...errorLogs];
}

/**
 * 清空错误日志
 */
export function clearErrorLogs() {
    errorLogs.length = 0;
}

/**
 * 导出错误日志为JSON
 * @returns {string} - JSON字符串
 */
export function exportErrorLogs() {
    return JSON.stringify(errorLogs, null, 2);
}

// 工具函数

/**
 * 分批
 * @param {Array} items - 项目数组
 * @param {number} batchSize - 批量大小
 * @returns {Array[]} - 批次数组
 */
function splitIntoBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
    }
    return batches;
}

/**
 * 延迟
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 使用示例
export function exampleUsage() {
    // 模拟云端词典接口
    const mockCloudDict = {
        async getBatch(words) {
            // 返回已有翻译的词条
            return {
                'Hallo': {
                    w: 'Hallo',
                    p: 'noun',
                    e: ['hello', 'hi'],
                    c: ['你好', '嗨'], // 已有中文
                    t: Date.now()
                }
            };
        },
        async setBatch(entries) {
            console.log('保存到云端:', entries);
        }
    };

    // 模拟AI翻译函数
    const mockAI = async (prompt) => {
        // 模拟返回
        return `[["学习", "学会"], ["书", "书籍"]]`;
    };

    // 使用
    const words = ['Hallo', 'lernen', 'Buch'];
    translateWords(words, mockCloudDict, mockAI)
        .then(result => {
            console.log('翻译完成:', result);
        });
}
