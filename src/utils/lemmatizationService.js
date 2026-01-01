/**
 * 词形还原服务 (Hybrid)
 *
 * 1. 优先查询本地 IndexedDB (search_index)
 * 2. 如果 IndexedDB 未初始化，尝试下载 search_index.json 并缓存
 * 3. 拿到 lemma_id 后，查询本地词典或云端 dictionary 表
 */

import { supabase } from '../infrastructure/supabaseClient';
import { localDictDB } from '../shared/services/dictionary/LocalDictionaryDB';

const INDEX_FILE_URL = 'https://dodsisnlvmpvipgsvzid.supabase.co/storage/v1/object/public/dict-assets/search_index.json.gz';

export class LemmatizationService {
    constructor() {
        this.initPromise = null;
    }

    /**
     * 初始化：检查并加载索引
     */
    async ensureIndexLoaded() {
        if (this.initPromise) return this.initPromise;

        this.initPromise = (async () => {
            try {
                const hasIndex = await localDictDB.isSearchIndexPopulated();
                if (hasIndex) {
                    console.log('✅ [Lemmatization] Local index already populated.');
                    return;
                }

                console.log('📥 [Lemmatization] Downloading search index...');
                const response = await fetch(INDEX_FILE_URL);
                if (!response.ok) {
                    throw new Error(`Failed to fetch index: ${response.statusText}`);
                }

                let data;
                // 自动解压处理：无需 Supabase 配置 Content-Encoding
                if (INDEX_FILE_URL.endsWith('.gz') && typeof DecompressionStream !== 'undefined') {
                    console.log('🔄 [Lemmatization] Decompressing index client-side...');
                    const ds = new DecompressionStream('gzip');
                    const decompressedStream = response.body.pipeThrough(ds);
                    const newResponse = new Response(decompressedStream);
                    data = await newResponse.json();
                } else {
                    data = await response.json();
                }

                console.log(`💾 [Lemmatization] Index downloaded. Entries: ${Object.keys(data).length.toLocaleString()}`);

                await localDictDB.bulkPutSearchIndex(data);
                console.log('✅ [Lemmatization] Index populated successfully.');
            } catch (error) {
                console.error('❌ [Lemmatization] Initialization failed:', error);
                this.initPromise = null; // Allow retry
            }
        })();

        return this.initPromise;
    }

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

        // 1. 确保索引已加载
        await this.ensureIndexLoaded();

        try {
            // 2. 本地查询 Lemma ID
            const lemmaId = await localDictDB.getLemmaId(normalizedVariant);
            
            // 3. 无论是否找到 lemmaId，我们也尝试直接查询 dictionary (如果它是原型)
            // 但是为了效率，如果找到了 lemmaId，我们就用 lemmaId 查
            
            let idsToFetch = new Set();
            
            if (lemmaId) {
                idsToFetch.add(lemmaId);
            }

            // 4. 查询详细信息
            // 这里我们应该先查本地词典 (Common)，如果没找到再查云端
            // 但本服务只负责返回 CloudDictionaryEntry 格式
            
            const results = [];

            // 4.1 如果没有 ID，尝试直接用 variant 当作 word 去查云端 (可能它就是原型且不在 index 中?)
            // 或者 search_index 应该覆盖所有词? 通常是的。
            // 但为了保险，如果 index 没命中，我们可以 fallback 到 cloud fuzzy search? 
            // 不，这里是精确还原。

            if (idsToFetch.size === 0) {
                // 尝试直接查云端，以此词为原型
                const { data: directMatch } = await supabase
                    .from('dictionary')
                    .select('*')
                    .ilike('word', normalizedVariant)
                    .limit(5);
                
                if (directMatch) {
                    results.push(...directMatch);
                }
            } else {
                // 4.2 根据 ID 查询
                const { data: entries, error } = await supabase
                    .from('dictionary')
                    .select('*')
                    .in('id', Array.from(idsToFetch));

                if (error) {
                    console.error('[Lemmatization] Dictionary lookup error:', error);
                } else if (entries) {
                    results.push(...entries);
                }
            }

            return results;
        } catch (error) {
            console.error('[Lemmatization] Error:', error);
            return [];
        }
    }

    // Helper: Extract lemma from translation string (Legacy logic)
    _extractLemmaFromTranslation(translation) {
        if (!translation) return null;
        // Example: "plural of Haus" -> "Haus"
        const match = translation.match(/plural of ([a-zA-ZäöüÄÖÜß]+)/i);
        return match ? match[1] : null;
    }
}

export const lemmatizationService = new LemmatizationService();
