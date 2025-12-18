/**
 * 本地词形还原服务
 *
 * 使用本地的 local_variants.json 和 conjugations/*.json 进行词形还原
 * 完全离线，速度快，支持分块加载
 */

class LocalLemmatization {
    constructor() {
        this.variantIndex = null;  // 变体 → 原型映射
        this.conjugationCache = new Map();   // 缓存已加载的变位表块
        this.loadingVariants = null;
    }

    /**
     * 加载变体映射数据 (local_variants.json)
     */
    async loadVariants() {
        if (this.loadingVariants) {
            return this.loadingVariants;
        }

        if (this.variantIndex) {
            return this.variantIndex;
        }

        this.loadingVariants = (async () => {
            console.log('📖 正在加载本地变体索引...');
            const startTime = Date.now();

            try {
                const response = await fetch('/dict/local_variants.json');
                if (!response.ok) throw new Error('Failed to load local_variants.json');
                
                this.variantIndex = await response.json();

                const loadTime = ((Date.now() - startTime) / 1000).toFixed(2);
                console.log(`✅ 变体索引加载完成！`);
                console.log(`   变体映射: ${Object.keys(this.variantIndex).length.toLocaleString()}`);
                console.log(`   耗时: ${loadTime}秒`);

                return this.variantIndex;
            } catch (error) {
                console.error('❌ 加载变体索引失败:', error);
                // 初始化为空，避免反复报错
                this.variantIndex = {};
                return this.variantIndex;
            }
        })();

        return this.loadingVariants;
    }

    /**
     * 加载特定首字母的变位表数据
     * @param {string} char - 首字母
     */
    async loadConjugationChunk(char) {
        if (!char) return null;
        
        // 简单的字符归一化
        let safeChar = char.toLowerCase().charAt(0);
        if (/[^a-z0-9]/.test(safeChar)) {
            const map = { 'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 's' };
            safeChar = map[safeChar] || 'other';
        }

        if (this.conjugationCache.has(safeChar)) {
            return this.conjugationCache.get(safeChar);
        }

        try {
            console.log(`📖 加载变位表块: ${safeChar}...`);
            const response = await fetch(`/dict/conjugations/${safeChar}.json`);
            if (!response.ok) {
                // 如果文件不存在（可能该字母没有变位词），返回空对象并缓存
                if (response.status === 404) {
                    this.conjugationCache.set(safeChar, {});
                    return {};
                }
                throw new Error(`Failed to load chunk ${safeChar}`);
            }
            
            const data = await response.json();
            this.conjugationCache.set(safeChar, data);
            return data;
        } catch (error) {
            console.warn(`⚠️ 无法加载变位表块 ${safeChar}:`, error);
            return null;
        }
    }

    /**
     * 查找原型（词形还原）
     * @param {string} word - 输入词（可能是变位形式）
     * @returns {Promise<string|null>} - 原型，如果找不到映射则返回 null (注意：这里逻辑变了，如果找不到映射返回null，调用者决定是否使用原词)
     */
    async findLemma(word) {
        await this.loadVariants();

        if (!word) return null;
        const normalizedWord = word.toLowerCase().trim();

        // 查找映射
        // local_variants.json 存储的是 lowerCaseVariant -> Prototype (Original Case)
        const lemma = this.variantIndex[normalizedWord];

        return lemma || null;
    }

    /**
     * 获取词的所有变位形式
     * @param {string} lemma - 原型词
     * @returns {Promise<Array|null>} - 变位详情数组
     */
    async getWordForms(lemma) {
        if (!lemma) return null;

        // 确定首字母以加载对应块
        const firstChar = lemma.charAt(0);
        const chunk = await this.loadConjugationChunk(firstChar);
        
        if (chunk && chunk[lemma]) {
            return chunk[lemma];
        }

        return null;
    }

    /**
     * 检查是否为变位形式
     * @param {string} word - 单词
     * @returns {Promise<boolean>} - 是否为变位形式
     */
    async isInflected(word) {
        await this.loadVariants();

        if (!word) return false;
        const normalizedWord = word.toLowerCase().trim();
        return this.variantIndex.hasOwnProperty(normalizedWord);
    }
}

// 创建单例
export const localLemmatization = new LocalLemmatization();
export default localLemmatization;
