/**
 * 词形还原服务
 *
 * 通过 Supabase search_index 表实现词形变化查询
 * 例如：Auffahrten → Auffahrt
 */

import { supabase } from '../infrastructure/supabaseClient';

/**
 * 词形还原服务类
 */
export class LemmatizationService {
    /**
     * 根据词形变化查询原型词条
     * @param {string} variant - 词形变化（如 Auffahrten）
     * @returns {Promise<Array>} - 原型词条数组
     */
    async findLemma(variant) {
        if (!variant || typeof variant !== 'string') {
            return [];
        }

        const normalizedVariant = variant.toLowerCase().trim();

        try {
            // 1. 先尝试直接查询 dictionary 表（可能就是原型）
            const { data: directMatch, error: directError } = await supabase
                .from('dictionary')
                .select('*')
                .ilike('word', normalizedVariant)
                .limit(10);

            if (directError) {
                console.error('[Lemmatization] Direct query error:', directError);
            }

            // 2. 通过 search_index 表查询词形变化
            // 尝试使用两步查询以避免联表查询可能存在的问题
            let indexResults = [];
            
            // 步骤 2.1: 查找 lemma_id
            const { data: indexData, error: indexError } = await supabase
                .from('search_index')
                .select('lemma_id')
                .eq('variant', normalizedVariant);

            if (indexError) {
                console.error('[Lemmatization] Index query error:', indexError);
            } else if (indexData && indexData.length > 0) {
                // 步骤 2.2: 根据 lemma_id 查找详细信息
                const lemmaIds = [...new Set(indexData.map(item => item.lemma_id))];
                
                const { data: dictData, error: dictError } = await supabase
                    .from('dictionary')
                    .select('*')
                    .in('id', lemmaIds);

                if (dictError) {
                    console.error('[Lemmatization] Dictionary lookup error:', dictError);
                } else if (dictData) {
                    // 构造符合原有结构的 result (包含 dictionary 对象)
                    indexResults = dictData.map(entry => ({ dictionary: entry }));
                }
            }

            // 3. 合并结果并去重
            const results = [];
            const seenIds = new Set();
            const potentialLemmas = new Set(); // 用于收集可能的原型

            // 添加直接匹配的结果
            if (directMatch && directMatch.length > 0) {
                for (const entry of directMatch) {
                    if (!seenIds.has(entry.id)) {
                        results.push(entry);
                        seenIds.add(entry.id);
                        
                        // 检查是否指向原型
                        const extracted = this._extractLemmaFromTranslation(entry.translation);
                        if (extracted && extracted.toLowerCase() !== normalizedVariant) {
                            potentialLemmas.add(extracted);
                        }
                    }
                }
            }

            // 添加索引查询的结果
            if (indexResults && indexResults.length > 0) {
                for (const item of indexResults) {
                    const entry = item.dictionary;
                    if (entry && !seenIds.has(entry.id)) {
                        results.push(entry);
                        seenIds.add(entry.id);

                        // 检查是否指向原型
                        const extracted = this._extractLemmaFromTranslation(entry.translation);
                        if (extracted && extracted.toLowerCase() !== normalizedVariant) {
                            potentialLemmas.add(extracted);
                        }
                    }
                }
            }

            // 4. 如果发现了潜在的原型，进行二次查询
            if (potentialLemmas.size > 0) {
                console.log(`[Lemmatization] Found potential lemmas via translation: ${[...potentialLemmas].join(', ')}`);
                const { data: lemmaData, error: lemmaError } = await supabase
                    .from('dictionary')
                    .select('*')
                    .in('word', [...potentialLemmas]);

                if (!lemmaError && lemmaData) {
                    for (const entry of lemmaData) {
                        if (!seenIds.has(entry.id)) {
                            results.push(entry);
                            seenIds.add(entry.id);
                        }
                    }
                }
            }

            console.log(`[Lemmatization] Found ${results.length} entries for "${variant}"`);
            return results;

        } catch (error) {
            console.error('[Lemmatization] Lookup error:', error);
            return [];
        }
    }

    /**
     * 从翻译中提取原型
     * @param {string} translation 
     * @returns {string|null}
     */
    _extractLemmaFromTranslation(translation) {
        if (!translation) return null;
        
        // 匹配模式： "plural of X", "inflection of X", etc.
        // 忽略大小写
        const match = translation.match(/(?:plural|singular|inflection|conjugation|participle|gerund|imperative|subjunctive|indicative|past|present|future|form|genitive|dative|accusative|nominative).*? of ([A-ZÄÖÜa-zäöüß]+)/i);
        
        if (match && match[1]) {
            return match[1];
        }
        return null;
    }

    /**
     * 使用 Supabase 函数查询（如果可用）
     * @param {string} variant - 词形变化
     * @returns {Promise<Array>} - 原型词条数组
     */
    async findLemmaByFunction(variant) {
        if (!variant || typeof variant !== 'string') {
            return [];
        }

        try {
            const { data, error } = await supabase
                .rpc('search_by_variant', { search_term: variant });

            if (error) {
                console.error('[Lemmatization] RPC error:', error);
                return [];
            }

            return data || [];
        } catch (error) {
            console.error('[Lemmatization] RPC lookup error:', error);
            return [];
        }
    }

    /**
     * 批量查询词形还原
     * @param {string[]} variants - 词形变化数组
     * @returns {Promise<Object>} - { variant: [entries] }
     */
    async findLemmaBatch(variants) {
        if (!variants || !Array.isArray(variants) || variants.length === 0) {
            return {};
        }

        const normalizedVariants = variants.map(v => v.toLowerCase().trim());

        try {
            const { data, error } = await supabase
                .from('search_index')
                .select(`
                    variant,
                    lemma_id,
                    dictionary:lemma_id (
                        id,
                        word,
                        pos,
                        translation,
                        article,
                        plural,
                        audio,
                        ipa,
                        translation_cn,
                        example_de,
                        example_cn
                    )
                `)
                .in('variant', normalizedVariants);

            if (error) {
                console.error('[Lemmatization] Batch query error:', error);
                return {};
            }

            // 按变体组织结果
            const results = {};
            for (const item of data || []) {
                const variant = item.variant;
                if (!results[variant]) {
                    results[variant] = [];
                }
                if (item.dictionary) {
                    results[variant].push(item.dictionary);
                }
            }

            return results;
        } catch (error) {
            console.error('[Lemmatization] Batch lookup error:', error);
            return {};
        }
    }

    /**
     * 检查 search_index 表是否可用
     * @returns {Promise<boolean>}
     */
    async isAvailable() {
        try {
            const { data, error } = await supabase
                .from('search_index')
                .select('variant')
                .limit(1);

            return !error && data !== null;
        } catch (error) {
            console.error('[Lemmatization] Availability check failed:', error);
            return false;
        }
    }
}

// 导出单例
export const lemmatizationService = new LemmatizationService();
export default lemmatizationService;
