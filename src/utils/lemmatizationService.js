/**
 * 词形还原服务 (Hybrid)
 *
 * 1. 优先查询本地 IndexedDB (search_index)
 * 2. 如果 IndexedDB 未初始化，尝试下载 search_index.json 并缓存
 * 3. 拿到 lemma_id 后，查询本地词典或云端 dictionary 表
 */

import { supabase } from '../infrastructure/supabaseClient';
import { localDictDB } from '../shared/services/dictionary/LocalDictionaryDB';

// Self-hosted with the app (web + desktop) so it never depends on a cloud bucket being online.
const INDEX_FILE_URL = `${process.env.PUBLIC_URL || ''}/dict/search_index.json.gz`;

// The cloud dictionary tables this service queries ("dictionary", "search_index") were never
// populated (0 rows / table absent), so every lookup was a wasted round-trip — or a timeout when
// the free-tier project is paused — and the 430k-entry index import blocked IndexedDB on first
// visit. Local lemmatization (localLemmatization.js) covers word forms instead.
const CLOUD_DICTIONARY_ENABLED = false;

export class LemmatizationService {
    constructor() {
        this.initPromise = null;
    }

    /**
     * 初始化：检查并加载索引
     * (在后台运行，不阻塞)
     */
    async ensureIndexLoaded() {
        if (!CLOUD_DICTIONARY_ENABLED) return;
        // 如果已经在加载中，直接返回 promise
        if (this.initPromise) return this.initPromise;

        // 标记开始加载
        this.initPromise = (async () => {
            try {
                // 1. 检查本地 IndexedDB 是否已有数据
                const hasIndex = await localDictDB.isSearchIndexPopulated();
                if (hasIndex) {
                    console.log('✅ [Lemmatization] Local index already populated.');
                    return;
                }

                // 2. 如果没有，开始下载
                console.log('📥 [Lemmatization] Downloading search index in background...');
                const response = await fetch(INDEX_FILE_URL);
                if (!response.ok) {
                    throw new Error(`Failed to fetch index: ${response.statusText}`);
                }

                let data;
                // 自动解压处理
                if (INDEX_FILE_URL.endsWith('.gz') && typeof DecompressionStream !== 'undefined') {
                    console.log('🔄 [Lemmatization] Decompressing index client-side...');
                    const ds = new DecompressionStream('gzip');
                    const decompressedStream = response.body.pipeThrough(ds);
                    const newResponse = new Response(decompressedStream);
                    data = await newResponse.json();
                } else {
                    data = await response.json();
                }

                const total = Object.keys(data).length;
                console.log(`💾 [Lemmatization] Index downloaded. Entries: ${total.toLocaleString()}`);

                // 3. 分批存入 IndexedDB (这会花一点时间，但不会卡死 UI)
                await localDictDB.bulkPutSearchIndex(data);
                console.log('✅ [Lemmatization] Index populated successfully.');
                
                // 释放内存
                data = null; 

            } catch (error) {
                console.error('❌ [Lemmatization] Initialization failed:', error);
                this.initPromise = null; // 允许重试
                // 不抛出错误，允许降级到云端查询
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
        if (!CLOUD_DICTIONARY_ENABLED || !variant || typeof variant !== 'string') {
            return [];
        }

        const normalizedVariant = variant.toLowerCase().trim();

        // 策略更新：
        // 1. 尝试本地查询 (如果索引已加载)
        // 2. 如果本地未加载完成或未找到 -> 降级到云端直接查询 (不等待下载)
        
        let lemmaId = null;
        
        // 检查索引是否就绪 (不await initPromise，因为下载可能很慢)
        const hasIndex = await localDictDB.isSearchIndexPopulated();

        if (hasIndex) {
            // 2. 本地查询 Lemma ID
            lemmaId = await localDictDB.getLemmaId(normalizedVariant);
        } else {
            // 3. 云端直接查询 (Fallback / During Download)
            // 当索引正在后台下载时，我们使用这个降级方案
            try {
                // 如果正在下载中，我们可以记录一下日志
                if (this.initPromise) {
                     console.log('[Lemmatization] Index downloading, using cloud fallback for:', normalizedVariant);
                }

                const { data, error } = await supabase
                    .from('search_index')
                    .select('lemma_id')
                    .eq('variant', normalizedVariant)
                    .maybeSingle();
                
                if (data) {
                    lemmaId = data.lemma_id;
                }
            } catch (err) {
                console.warn('[Lemmatization] Cloud fallback lookup failed:', err);
            }
        }
            
        // 4. 无论是否找到 lemmaId，我们也尝试直接查询 dictionary (如果它是原型)
        // 但是为了效率，如果找到了 lemmaId，我们就用 lemmaId 查
        
        let idsToFetch = new Set();
        
        if (lemmaId) {
            idsToFetch.add(lemmaId);
        }

        // 5. 查询详细信息
        // 这里我们应该先查本地词典 (Common)，如果没找到再查云端
        // 但本服务只负责返回 CloudDictionaryEntry 格式
        
        const results = [];

        try {
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

    /**
     * 检查服务是否可用 (Supabase 连接检查)
     */
    async isAvailable() {
        if (!CLOUD_DICTIONARY_ENABLED) return false;
        try {
            // 简单检查 Supabase 连接
            const { data, error } = await supabase
                .from('search_index')
                .select('lemma_id')
                .limit(1);
            return !error;
        } catch (e) {
            return false;
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
