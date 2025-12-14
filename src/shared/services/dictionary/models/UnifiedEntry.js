/**
 * 统一词典词条模型
 * 
 * 所有来源的词典数据最终都需要转换为此格式
 */

// ============ 常量定义 ============

/**
 * 词性映射表
 */
export const POS_MAP = {
    noun: '名词',
    verb: '动词',
    adj: '形容词',
    adv: '副词',
    prep: '介词',
    conj: '连词',
    pron: '代词',
    det: '限定词',
    num: '数词',
    intj: '感叹词',
    interj: '感叹词',
    prefix: '前缀',
    suffix: '后缀',
    phrase: '短语',
    name: '专有名词',
    article: '冠词',
    particle: '小品词',
    contraction: '缩写',
    unknown: '未知'
};

/**
 * 翻译状态
 */
export const TRANSLATION_STATUS = {
    COMPLETE: 'complete',
    PENDING: 'pending',
    PROCESSING: 'processing',
    FAILED: 'failed'
};

/**
 * 数据来源类型
 */
export const SOURCE_TYPES = {
    GOETHE: 'goethe',
    WIKTIONARY: 'wiktionary',
    TATOEBA: 'tatoeba',
    AI: 'ai_gen',
    USER: 'user_import',
    CLOUD: 'cloud'
};

/**
 * 来源 ID 标识
 */
export const SOURCE_IDS = {
    GOETHE_A1: 'goethe_a1',
    GOETHE_A2: 'goethe_a2',
    GOETHE_B1: 'goethe_b1',
    GOETHE_B2: 'goethe_b2',
    WIKT_2500: 'wikt_2500',
    WIKT_CLOUD: 'wikt_cloud',
    TATOEBA: 'tatoeba',
    AI_GEN: 'ai_gen',
    USER: 'user_import'
};

// ============ 模型工厂函数 ============

/**
 * 生成词条 ID
 * @param {string} word - 单词
 * @param {string} pos - 词性
 * @returns {string}
 */
export function generateEntryId(word, pos = 'unknown') {
    const normalizedWord = (word || '').toLowerCase().trim();
    const normalizedPos = (pos || 'unknown').toLowerCase().trim();
    return `${normalizedWord}_${normalizedPos}`;
}

/**
 * 创建空的统一词条
 * @param {Object} partial - 部分字段
 * @returns {Object} UnifiedEntry
 */
export function createUnifiedEntry(partial = {}) {
    const word = partial.word || '';
    const pos = partial.pos || 'unknown';

    return {
        // 核心标识
        id: partial.id || generateEntryId(word, pos),
        word: word,
        word_lower: word.toLowerCase().trim(),

        // 词汇信息
        pos: pos,
        article: partial.article || '',
        gender: partial.gender || '',
        plural: partial.plural || '',

        // 释义
        translation_cn: partial.translation_cn || null,
        translation_en: partial.translation_en || null,

        // 发音
        ipa: partial.ipa || '',
        audio_url: partial.audio_url || '',

        // 例句
        examples: Array.isArray(partial.examples) ? partial.examples : [],

        // 来源追踪
        sources: Array.isArray(partial.sources) ? partial.sources : [],

        // 元数据
        rank: partial.rank || null,
        level: partial.level || '',
        conjugations: Array.isArray(partial.conjugations) ? partial.conjugations : [],
        source_lemma: partial.source_lemma || '',

        // 翻译状态
        has_chinese: !!partial.translation_cn || partial.has_chinese || false,
        translation_status: partial.translation_status ||
            (partial.translation_cn ? TRANSLATION_STATUS.COMPLETE : TRANSLATION_STATUS.PENDING),

        // 扩展字段
        meta: partial.meta || {},
        tags: Array.isArray(partial.tags) ? partial.tags : [],
        premium_source: partial.premium_source || null,

        // 时间戳
        created_at: partial.created_at || Date.now(),
        updated_at: partial.updated_at || Date.now()
    };
}

/**
 * 创建例句对象
 * @param {string} de - 德语例句
 * @param {string} cn - 中文翻译
 * @param {string} source - 来源标识
 * @returns {Object}
 */
export function createExample(de, cn = '', source = SOURCE_IDS.USER) {
    return {
        de: de || '',
        cn: cn || '',
        source: source
    };
}

/**
 * 创建来源记录
 * @param {string} type - 来源类型
 * @param {string} id - 来源 ID
 * @returns {Object}
 */
export function createSourceRecord(type, id) {
    return {
        type: type,
        id: id,
        imported_at: Date.now()
    };
}

// ============ 翻译任务模型 ============

/**
 * 翻译任务状态
 */
export const TASK_STATUS = {
    QUEUED: 'queued',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

/**
 * 创建翻译任务
 * @param {Object} entry - UnifiedEntry
 * @returns {Object} TranslationTask
 */
export function createTranslationTask(entry) {
    return {
        id: `task_${entry.id}_${Date.now()}`,
        entry_id: entry.id,
        word: entry.word,
        word_pos: entry.id,
        translation_en: entry.translation_en || '',

        // 状态
        status: TASK_STATUS.QUEUED,
        created_at: Date.now(),
        updated_at: Date.now(),
        retry_count: 0,

        // 结果
        translation_cn: null,
        error: null
    };
}

/**
 * 更新翻译任务状态
 * @param {Object} task - TranslationTask
 * @param {string} status - 新状态
 * @param {Object} updates - 其他更新
 * @returns {Object}
 */
export function updateTaskStatus(task, status, updates = {}) {
    return {
        ...task,
        ...updates,
        status: status,
        updated_at: Date.now()
    };
}

// ============ 验证函数 ============

/**
 * 验证词条完整性
 * @param {Object} entry - UnifiedEntry
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateEntry(entry) {
    const errors = [];
    const warnings = [];

    // 必需字段
    if (!entry.id) errors.push('缺少 id');
    if (!entry.word) errors.push('缺少 word');
    if (!entry.word_lower) errors.push('缺少 word_lower');

    // 推荐字段
    if (!entry.pos || entry.pos === 'unknown') {
        warnings.push('未指定词性 (pos)');
    }
    if (!entry.translation_cn && !entry.translation_en) {
        warnings.push('缺少释义');
    }
    if (!entry.sources || entry.sources.length === 0) {
        warnings.push('未记录来源');
    }

    // 数据类型
    if (entry.examples && !Array.isArray(entry.examples)) {
        errors.push('examples 应为数组');
    }
    if (entry.sources && !Array.isArray(entry.sources)) {
        errors.push('sources 应为数组');
    }
    if (entry.conjugations && !Array.isArray(entry.conjugations)) {
        errors.push('conjugations 应为数组');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * 检查是否需要翻译
 * @param {Object} entry - UnifiedEntry
 * @returns {boolean}
 */
export function needsTranslation(entry) {
    return !entry.has_chinese &&
        entry.translation_status !== TRANSLATION_STATUS.COMPLETE;
}

// ============ 辅助函数 ============

/**
 * 获取词性中文名称
 * @param {string} pos - 英文词性
 * @returns {string}
 */
export function getPOSChinese(pos) {
    return POS_MAP[pos] || pos || '未知';
}

/**
 * 合并同一单词的多个词条
 * @param {Object[]} entries - 同一单词的词条数组
 * @returns {Object} 合并后的词条
 */
export function mergeEntries(entries) {
    if (!entries || entries.length === 0) return null;
    if (entries.length === 1) return entries[0];

    // 按词性分组返回
    return entries;
}

/**
 * 从原始数据添加翻译
 * @param {Object} entry - UnifiedEntry
 * @param {string} translation - 中文翻译
 * @returns {Object}
 */
export function addTranslationToEntry(entry, translation) {
    return {
        ...entry,
        translation_cn: translation,
        has_chinese: true,
        translation_status: TRANSLATION_STATUS.COMPLETE,
        updated_at: Date.now()
    };
}

/**
 * 添加例句到词条
 * @param {Object} entry - UnifiedEntry
 * @param {Object} example - 例句对象
 * @returns {Object}
 */
export function addExampleToEntry(entry, example) {
    return {
        ...entry,
        examples: [...(entry.examples || []), example],
        updated_at: Date.now()
    };
}

/**
 * 添加来源记录
 * @param {Object} entry - UnifiedEntry
 * @param {string} type - 来源类型
 * @param {string} id - 来源 ID
 * @returns {Object}
 */
export function addSourceToEntry(entry, type, id) {
    const existingSource = (entry.sources || []).find(s => s.type === type && s.id === id);
    if (existingSource) return entry;

    return {
        ...entry,
        sources: [...(entry.sources || []), createSourceRecord(type, id)],
        updated_at: Date.now()
    };
}
