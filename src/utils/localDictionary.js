/**
 * 本地词典查询工具
 * 
 * 用于快速查询 cloud-dictionary.json
 */

class LocalDictionary {
    constructor() {
        this.dict = null;
        this.index = null;
        this.variantIndex = null;
        this.loading = null;
    }

    /**
     * 加载词典（带缓存）
     */
    async load() {
        // 如果已经在加载中，等待
        if (this.loading) {
            return this.loading;
        }

        // 如果已加载，直接返回
        if (this.dict) {
            return this.dict;
        }

        // 开始加载
        this.loading = (async () => {
            console.log('⏳ 正在加载本地词典...');
            const startTime = Date.now();

            try {
                // 加载 common_2500.json
                const response = await fetch('/dict/common_2500.json');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const rawData = await response.json();

                // 转换格式以匹配内部结构
                const entries = Array.isArray(rawData) ? rawData.map(item => ({
                    w: item.word,
                    p: item.pos,
                    a: item.article,
                    pl: item.plural,
                    e: item.translation ? [item.translation] : [],
                    c: item.translation_cn ? [item.translation_cn] : [],
                    i: item.ipa,
                    x: item.example_de ? [item.example_de] : [],
                    xc: item.example_cn ? [item.example_cn] : []
                })) : (rawData.entries || []);

                this.dict = {
                    entries: entries,
                    totalEntries: entries.length
                };

                // 构建索引（单词 -> 词条位置）
                this.buildIndex();

                const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`✅ 词典加载完成！`);
                console.log(`   词条数: ${this.dict.totalEntries.toLocaleString()}`);
                console.log(`   耗时: ${loadTime}秒`);

                return this.dict;
            } catch (error) {
                console.error('❌ 加载本地词典失败:', error);
                this.dict = { entries: [], totalEntries: 0 };
                this.index = new Map();
                this.variantIndex = new Map();
                return this.dict;
            }
        })();

        return this.loading;
    }

    /**
     * 构建索引（加快查询速度）
     */
    buildIndex() {
        console.log('📑 构建索引...');
        this.index = new Map();
        this.variantIndex = new Map();

        this.dict.entries.forEach((entry, idx) => {
            const key = entry.w.toLowerCase();

            // 1. 主索引
            if (!this.index.has(key)) {
                this.index.set(key, []);
            }
            this.index.get(key).push(idx);

            // 2. 变体索引 (例如复数)
            if (entry.pl && entry.pl.trim()) {
                const plural = entry.pl.toLowerCase().trim();
                // 只有当复数和单数不同时才添加，避免重复
                if (plural !== key) {
                    if (!this.variantIndex.has(plural)) {
                        this.variantIndex.set(plural, []);
                    }
                    this.variantIndex.get(plural).push(idx);
                }
            }
        });

        console.log(`✅ 索引构建完成：${this.index.size} 个唯一单词，${this.variantIndex.size} 个变体`);
    }

    /**
     * 查询单词
     * @param {string} word - 单词
     * @returns {Array} - 找到的词条数组
     */
    async lookup(word) {
        await this.load();

        const key = word.toLowerCase().trim();
        
        // 1. 尝试精确匹配
        let indices = this.index.get(key);

        // 2. 尝试变体匹配 (如果精确匹配失败)
        if (!indices && this.variantIndex) {
            indices = this.variantIndex.get(key);
        }

        if (!indices) {
            return [];
        }

        return indices.map(idx => this.dict.entries[idx]);
    }

    /**
     * 模糊搜索
     * @param {string} pattern - 搜索模式
     * @param {number} limit - 限制数量
     * @returns {Array} - 找到的词条
     */
    async search(pattern, limit = 20) {
        await this.load();

        const results = [];
        const lowerPattern = pattern.toLowerCase();

        for (const [word, indices] of this.index.entries()) {
            if (word.includes(lowerPattern)) {
                indices.forEach(idx => {
                    results.push(this.dict.entries[idx]);
                });

                if (results.length >= limit) {
                    break;
                }
            }
        }

        return results.slice(0, limit);
    }

    /**
     * 获取随机单词
     * @param {number} count - 数量
     * @returns {Array} - 随机词条
     */
    async random(count = 1) {
        await this.load();

        const results = [];
        const total = this.dict.entries.length;

        for (let i = 0; i < count; i++) {
            const randomIdx = Math.floor(Math.random() * total);
            results.push(this.dict.entries[randomIdx]);
        }

        return results;
    }

    /**
     * 按词性筛选
     * @param {string} pos - 词性
     * @param {number} limit - 限制数量
     * @returns {Array} - 词条数组
     */
    async filterByPos(pos, limit = 50) {
        await this.load();

        const results = [];
        for (const entry of this.dict.entries) {
            if (entry.p === pos) {
                results.push(entry);
                if (results.length >= limit) {
                    break;
                }
            }
        }

        return results;
    }

    /**
     * 统计信息
     * @returns {Object} - 统计数据
     */
    async stats() {
        await this.load();

        const posCount = {};
        const hasIpa = this.dict.entries.filter(e => e.i).length;
        const hasExamples = this.dict.entries.filter(e => e.x && e.x.length > 0).length;
        const hasSynonyms = this.dict.entries.filter(e => e.s && e.s.length > 0).length;

        this.dict.entries.forEach(entry => {
            posCount[entry.p] = (posCount[entry.p] || 0) + 1;
        });

        return {
            totalEntries: this.dict.totalEntries,
            uniqueWords: this.index.size,
            withPronunciation: hasIpa,
            withExamples: hasExamples,
            withSynonyms: hasSynonyms,
            byPartOfSpeech: posCount
        };
    }

    /**
     * 清除缓存
     */
    clear() {
        this.dict = null;
        this.index = null;
        this.loading = null;
        console.log('🗑️ 词典缓存已清除');
    }
}

// 创建单例
export const localDict = new LocalDictionary();

// 使用示例
export async function example() {
    // 1. 查询单词
    const hausEntries = await localDict.lookup('Haus');
    console.log('查询 "Haus":', hausEntries);

    // 2. 模糊搜索
    const searchResults = await localDict.search('haus', 10);
    console.log('搜索 "haus":', searchResults);

    // 3. 随机单词
    const randomWords = await localDict.random(5);
    console.log('随机5个单词:', randomWords);

    // 4. 按词性筛选
    const verbs = await localDict.filterByPos('verb', 10);
    console.log('前10个动词:', verbs);

    // 5. 统计信息
    const stats = await localDict.stats();
    console.log('词典统计:', stats);
}

// 如果需要在 React 组件中使用，请直接使用 localDict
// 例如：
// import { localDict } from './utils/localDictionary';
//
// useEffect(() => {
//   localDict.load().then(() => console.log('词典已加载'));
// }, []);
