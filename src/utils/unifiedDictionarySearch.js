/**
 * 统一词典搜索服务
 *
 * 实现搜索优先级：
 * 1. 本地 Common 词汇（精确匹配）
 * 2. 云端 Rare 词汇（精确匹配）
 * 3. 云端词形还原（Supabase search_index）
 */

import { localDict } from './localDictionary';
import { localLemmatization } from './localLemmatization';
import { lemmatizationService } from './lemmatizationService';
import { supabase } from '../infrastructure/supabaseClient';

export class UnifiedDictionarySearch {
    /**
     * 统一搜索入口
     * @param {string} word - 要搜索的词
     * @param {Object} options - 搜索选项
     * @returns {Promise<Object>} - { found: boolean, source: string, entries: Array }
     */
    async search(word, options = {}) {
        const {
            enableLemmatization = true, // 是否启用词形还原
            enableCloud = true,          // 是否查询云端
            maxResults = 10              // 最大结果数
        } = options;

        const normalizedWord = word.trim();
        console.log(`[UnifiedSearch] 搜索: "${normalizedWord}"`);

        // 1. 本地精确匹配
        console.log('[UnifiedSearch] 步骤 1: 本地精确匹配...');
        try {
            const localResults = await localDict.lookup(normalizedWord);
            if (localResults && localResults.length > 0) {
                console.log(`[UnifiedSearch] ✅ 本地精确匹配找到 ${localResults.length} 个结果`);
                return {
                    found: true,
                    source: 'local_common',
                    entries: localResults.slice(0, maxResults),
                    searchMethod: 'exact',
                    originalWord: normalizedWord
                };
            }
        } catch (error) {
            console.warn('[UnifiedSearch] 本地精确匹配失败:', error);
        }

        // 2. 本地词形还原
        if (enableLemmatization) {
            console.log('[UnifiedSearch] 步骤 2: 本地词形还原...');
            try {
                const lemma = await localLemmatization.findLemma(normalizedWord);

                // 如果找到了不同的原型（说明是变位形式）
                // 注意：如果 lemma 与 normalizedWord 相同，且之前精确匹配没找到，
                // 那说明这个词可能就是原型但不在本地词典，或者本地词典没这个词。
                if (lemma) {
                    // 如果还原出的词和原词不一样，或者一样（可能是复数和单数同形），都去查一下原型
                    console.log(`[UnifiedSearch] 🔄 本地还原建议: "${normalizedWord}" → "${lemma}"`);

                    // 在本地词典中查找原型
                    const lemmaResults = await localDict.lookup(lemma);
                    if (lemmaResults && lemmaResults.length > 0) {
                        // 过滤出真正的原型匹配项
                        const exactMatches = lemmaResults.filter(e => e.w.toLowerCase() === lemma.toLowerCase());
                        
                        if (exactMatches.length > 0) {
                            console.log(`[UnifiedSearch] ✅ 本地找到原型 "${lemma}"`);
                            return {
                                found: true,
                                source: 'local_common',
                                entries: exactMatches.slice(0, maxResults),
                                searchMethod: 'lemmatization_local',
                                originalWord: normalizedWord,
                                lemmas: [lemma]
                            };
                        }
                    }
                }
            } catch (error) {
                console.warn('[UnifiedSearch] 本地词形还原失败:', error);
            }
        }

        if (!enableCloud) {
            console.log('[UnifiedSearch] 云端查询已禁用');
            return { found: false, source: 'none', entries: [], searchMethod: 'exact' };
        }

        // 3. 云端查询 (集成精确匹配 + 词形还原)
        // 使用 LemmatizationService 统一处理，它会自动处理精确匹配、索引查找和翻译解析
        console.log('[UnifiedSearch] 步骤 3: 云端智能查询...');
        try {
            const cloudResults = await lemmatizationService.findLemma(normalizedWord);
            
            if (cloudResults && cloudResults.length > 0) {
                console.log(`[UnifiedSearch] ✅ 云端找到 ${cloudResults.length} 个结果`);

                // 2.1 检查这些结果是否在本地词典中存在 (Cloud-assisted Local Lookup)
                // 例如: "lernten" -> 云端还原为 "lernen" -> 检查 "lernen" 是否在本地 Common 2500 中
                const localMatches = [];
                const localLemmas = new Set();
                
                for (const res of cloudResults) {
                    // res.word 是原型 (如 "lernen")
                    if (res.word) {
                        try {
                            const local = await localDict.lookup(res.word);
                            if (local && local.length > 0) {
                                // 验证是否为精确匹配本地词条 (避免循环引用)
                                const exactLocal = local.filter(l => l.w.toLowerCase() === res.word.toLowerCase());
                                if (exactLocal.length > 0) {
                                    localMatches.push(...exactLocal);
                                    localLemmas.add(res.word);
                                }
                            }
                        } catch (err) {
                            // 忽略本地查找错误
                        }
                    }
                }

                // 如果通过云端还原找到了本地词汇，优先返回本地结果
                if (localMatches.length > 0) {
                    console.log(`[UnifiedSearch] ✅ 通过云端还原发现本地词汇: ${Array.from(localLemmas).join(', ')}`);
                    return {
                        found: true,
                        source: 'local_common', // 标记为本地来源，满足用户期望
                        entries: localMatches.slice(0, maxResults),
                        searchMethod: 'lemmatization',
                        originalWord: normalizedWord,
                        lemmas: Array.from(localLemmas)
                    };
                }
                
                // 判断是精确匹配还是还原匹配
                const isExact = cloudResults.some(e => e.word.toLowerCase() === normalizedWord.toLowerCase());
                
                return {
                    found: true,
                    source: isExact ? 'cloud_rare_exact' : 'cloud_rare_lemma',
                    entries: this._normalizeCloudEntries(cloudResults.slice(0, maxResults)),
                    searchMethod: isExact ? 'exact' : 'lemmatization',
                    originalWord: normalizedWord,
                    lemmas: cloudResults.map(e => e.word)
                };
            }
        } catch (error) {
            console.warn('[UnifiedSearch] 云端查询失败:', error);
        }

        return { found: false, source: 'none', entries: [], searchMethod: 'exact' };
    }

    /**
     * 标准化云端词条格式
     * @param {Array} cloudEntries - Supabase 返回的词条
     * @returns {Array} - 统一格式的词条
     * @private
     */
    _normalizeCloudEntries(cloudEntries) {
        return cloudEntries.map(entry => ({
            // 统一字段名
            w: entry.word || entry.w,
            p: entry.pos || entry.p,
            e: entry.translation ? [entry.translation] : (entry.e || []),
            c: entry.translation_cn ? [entry.translation_cn] : (entry.c || []),
            a: entry.article || entry.a,
            pl: entry.plural || entry.pl,
            i: entry.ipa || entry.i,
            x: entry.example_de ? [entry.example_de] : (entry.x || []),
            xc: entry.example_cn ? [entry.example_cn] : (entry.xc || []),
            audio: entry.audio,
            freq: entry.freq,
            rank: entry.rank,
            id: entry.id,
            // 保留原始数据
            _raw: entry
        }));
    }

    /**
     * 批量搜索
     * @param {string[]} words - 单词数组
     * @returns {Promise<Object>} - { word: searchResult }
     */
    async batchSearch(words) {
        const results = {};
        for (const word of words) {
            results[word] = await this.search(word);
            // 避免请求过快
            await new Promise(r => setTimeout(r, 50));
        }
        return results;
    }

    /**
     * 模糊搜索（仅本地）
     * @param {string} pattern - 搜索模式
     * @param {number} limit - 限制数量
     * @returns {Promise<Array>} - 匹配的词条
     */
    async fuzzySearch(pattern, limit = 20) {
        try {
            const results = await localDict.search(pattern, limit);
            return results;
        } catch (error) {
            console.error('[UnifiedSearch] 模糊搜索失败:', error);
            return [];
        }
    }

    /**
     * 检查服务状态
     * @returns {Promise<Object>} - 各服务的可用性
     */
    async checkStatus() {
        const status = {
            localCommon: false,
            cloudDictionary: false,
            cloudLemmatization: false
        };

        // 检查本地词典
        try {
            await localDict.load();
            status.localCommon = true;
        } catch (error) {
            console.error('[UnifiedSearch] 本地词典不可用:', error);
        }

        // 检查云端 dictionary 表
        try {
            const { data, error } = await supabase
                .from('dictionary')
                .select('id')
                .limit(1);
            status.cloudDictionary = !error && data !== null;
        } catch (error) {
            console.error('[UnifiedSearch] 云端词典不可用:', error);
        }

        // 检查云端词形还原
        try {
            status.cloudLemmatization = await lemmatizationService.isAvailable();
        } catch (error) {
            console.error('[UnifiedSearch] 词形还原服务不可用:', error);
        }

        return status;
    }
}

// 导出单例
export const unifiedSearch = new UnifiedDictionarySearch();
export default unifiedSearch;
