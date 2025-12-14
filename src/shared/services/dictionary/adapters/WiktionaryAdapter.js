/**
 * Wiktionary 词典适配器
 * 
 * 将 Wiktionary 格式转换为统一词条格式
 * 
 * 输入格式:
 * {
 *   rank, word, pos, translation, article, plural, audio, ipa, freq, source_lemma
 * }
 * 
 * 输出格式: UnifiedEntry
 */

import {
    createUnifiedEntry,
    createSourceRecord,
    generateEntryId,
    SOURCE_TYPES,
    SOURCE_IDS,
    TRANSLATION_STATUS
} from '../models/UnifiedEntry';

/**
 * Wiktionary 词条适配器
 */
class WiktionaryAdapter {
    /**
     * @param {Object} options
     * @param {string} options.sourceId - 来源 ID (wikt_2500 或 wikt_cloud)
     * @param {boolean} options.hasChineseTranslation - 是否已有中文翻译
     */
    constructor(options = {}) {
        this.sourceId = options.sourceId || SOURCE_IDS.WIKT_2500;
        this.hasChineseTranslation = options.hasChineseTranslation || false;
    }

    /**
     * 转换单个词条
     * @param {Object} raw - 原始 Wiktionary 词条
     * @returns {Object} UnifiedEntry
     */
    adapt(raw) {
        if (!raw || !raw.word) {
            return null;
        }

        const word = raw.word;
        const pos = this.normalizePos(raw.pos);

        // 处理冠词和性别
        const { article, gender } = this.extractArticleGender(raw.article, pos);

        const entry = createUnifiedEntry({
            id: generateEntryId(word, pos),
            word: word,
            pos: pos,
            article: article,
            gender: gender,
            plural: raw.plural || '',

            // 释义
            translation_en: raw.translation || '',
            translation_cn: this.hasChineseTranslation ? raw.translation_cn : null,

            // 发音
            ipa: raw.ipa || '',
            audio_url: raw.audio || '',

            // 元数据
            rank: raw.rank || null,
            source_lemma: raw.source_lemma || '',

            // 来源
            sources: [createSourceRecord(SOURCE_TYPES.WIKTIONARY, this.sourceId)],

            // 翻译状态
            has_chinese: this.hasChineseTranslation && !!raw.translation_cn,
            translation_status: this.hasChineseTranslation && raw.translation_cn
                ? TRANSLATION_STATUS.COMPLETE
                : TRANSLATION_STATUS.PENDING
        });

        // 添加频率到 meta
        if (raw.freq) {
            entry.meta.frequency = raw.freq;
        }

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
     * 标准化词性
     * @param {string} pos
     * @returns {string}
     */
    normalizePos(pos) {
        if (!pos) return 'unknown';

        const posLower = pos.toLowerCase().trim();

        // 映射常见变体
        const mapping = {
            'intj': 'intj',
            'interj': 'intj',
            'interjection': 'intj',
            'n': 'noun',
            'v': 'verb',
            'a': 'adj',
            'adjective': 'adj',
            'adverb': 'adv',
            'preposition': 'prep',
            'conjunction': 'conj',
            'pronoun': 'pron',
            'determiner': 'det'
        };

        return mapping[posLower] || posLower;
    }

    /**
     * 提取冠词和性别
     * @param {string} articleRaw
     * @param {string} pos
     * @returns {{ article: string, gender: string }}
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
}

/**
 * 创建常用词适配器 (2500 词，已翻译)
 */
export function createCommonAdapter(hasChineseTranslation = true) {
    return new WiktionaryAdapter({
        sourceId: SOURCE_IDS.WIKT_2500,
        hasChineseTranslation
    });
}

/**
 * 创建云端词典适配器 (非常用词，待翻译)
 */
export function createCloudAdapter() {
    return new WiktionaryAdapter({
        sourceId: SOURCE_IDS.WIKT_CLOUD,
        hasChineseTranslation: false
    });
}

export { WiktionaryAdapter };
export default WiktionaryAdapter;
