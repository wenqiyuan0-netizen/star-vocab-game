/**
 * Goethe 词汇表适配器
 * 
 * 将 Goethe 官方词汇表格式转换为统一词条格式
 * 
 * 输入格式:
 * {
 *   level, word, article, plural, partOfSpeech, wordTranslation,
 *   examples: [{ sentence, translation }],
 *   grammarTags: []
 * }
 * 
 * 输出格式: UnifiedEntry
 */

import {
    createUnifiedEntry,
    createExample,
    createSourceRecord,
    generateEntryId,
    SOURCE_TYPES,
    SOURCE_IDS,
    TRANSLATION_STATUS
} from '../models/UnifiedEntry';

/**
 * Goethe 词条适配器
 */
class GoetheAdapter {
    /**
     * @param {Object} options
     * @param {string} options.defaultLevel - 默认等级 (A1, A2, B1, B2)
     */
    constructor(options = {}) {
        this.defaultLevel = options.defaultLevel || 'A1';
    }

    /**
     * 转换单个词条
     * @param {Object} raw - 原始 Goethe 词条
     * @returns {Object} UnifiedEntry
     */
    adapt(raw) {
        if (!raw || !raw.word) {
            return null;
        }

        const word = raw.word;
        const pos = this.normalizePos(raw.partOfSpeech);
        const level = (raw.level || this.defaultLevel).toUpperCase();

        // 处理冠词和性别
        const { article, gender } = this.extractArticleGender(raw.article, pos);

        // 确定来源 ID
        const sourceId = this.getSourceId(level);

        const entry = createUnifiedEntry({
            id: generateEntryId(word, pos),
            word: word,
            pos: pos,
            article: article,
            gender: gender,
            plural: raw.plural || '',

            // 释义 (Goethe 已有中文)
            translation_cn: raw.wordTranslation || '',
            translation_en: '',

            // 例句
            examples: this.adaptExamples(raw.examples, sourceId),

            // 语法
            conjugations: this.adaptGrammarTags(raw.grammarTags),

            // 元数据
            level: level,

            // 来源
            sources: [createSourceRecord(SOURCE_TYPES.GOETHE, sourceId)],

            // 翻译状态 (Goethe 数据已完成)
            has_chinese: true,
            translation_status: TRANSLATION_STATUS.COMPLETE
        });

        return entry;
    }

    /**
     * 批量转换
     * @param {Object[]} rawEntries - 原始词条数组
     * @returns {Object[]} UnifiedEntry 数组
     */
    adaptBatch(rawEntries) {
        if (!Array.isArray(rawEntries)) return [];
        return rawEntries
            .map(raw => this.adapt(raw))
            .filter(Boolean);
    }

    /**
     * 转换例句数组
     * @param {Array} examples - 原始例句
     * @param {string} sourceId - 来源 ID
     * @returns {Array}
     */
    adaptExamples(examples, sourceId) {
        if (!Array.isArray(examples)) return [];

        return examples
            .filter(ex => ex && (ex.sentence || ex.de))
            .map(ex => createExample(
                ex.sentence || ex.de || '',
                ex.translation || ex.cn || '',
                sourceId
            ));
    }

    /**
     * 转换语法标签
     * @param {Array} grammarTags
     * @returns {Array}
     */
    adaptGrammarTags(grammarTags) {
        if (!Array.isArray(grammarTags)) return [];
        return grammarTags.filter(tag => tag && typeof tag === 'string');
    }

    /**
     * 标准化词性
     * @param {string} pos
     * @returns {string}
     */
    normalizePos(pos) {
        if (!pos) return 'unknown';

        const posLower = pos.toLowerCase().trim();

        // Goethe 格式中的词性映射
        const mapping = {
            'nomen': 'noun',
            'substantiv': 'noun',
            'verb': 'verb',
            'adjektiv': 'adj',
            'adverb': 'adv',
            'präposition': 'prep',
            'konjunktion': 'conj',
            'pronomen': 'pron',
            'artikel': 'article',
            'partikel': 'particle'
        };

        return mapping[posLower] || posLower || 'unknown';
    }

    /**
     * 提取冠词和性别
     * @param {string} articleRaw
     * @param {string} pos
     * @returns {{ article: string, gender: string }}
     */
    extractArticleGender(articleRaw, pos) {
        if (!articleRaw) {
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
     * 根据等级获取来源 ID
     * @param {string} level
     * @returns {string}
     */
    getSourceId(level) {
        const levelUpper = (level || '').toUpperCase();
        const mapping = {
            'A1': SOURCE_IDS.GOETHE_A1,
            'A2': SOURCE_IDS.GOETHE_A2,
            'B1': SOURCE_IDS.GOETHE_B1,
            'B2': SOURCE_IDS.GOETHE_B2
        };
        return mapping[levelUpper] || SOURCE_IDS.GOETHE_A1;
    }
}

/**
 * 创建指定等级的适配器
 * @param {string} level - A1, A2, B1, B2
 */
export function createGoetheAdapter(level = 'A1') {
    return new GoetheAdapter({ defaultLevel: level });
}

export { GoetheAdapter };
export default GoetheAdapter;
