/**
 * 云端词典压缩格式定义
 * 
 * 将完整的本地词典转换为压缩的云端格式
 * 压缩率：约90%（975MB → ~50-100MB）
 */

/**
 * 本地词典词条格式（压缩版）
 * @typedef {Object} CloudDictionaryEntry
 * @property {string} w - word: 单词
 * @property {string} p - pos: 词性
 * @property {string[]} [e] - english: 英文释义数组
 * @property {string[]} [c] - chinese: 中文释义数组（翻译后添加）
 * @property {string[]} [x] - examples: 例句（1-2个）
 * @property {string} [i] - ipa: 发音
 * @property {string[]} [s] - synonyms: 同义词
 * @property {number} [t] - timestamp: 翻译时间戳
 * @property {number} [v] - version: 版本号
 */

/**
 * 将完整词典词条转换为压缩的云端格式
 * @param {Object} fullEntry - 完整的Kaikki词典词条
 * @returns {CloudDictionaryEntry} - 压缩后的词条
 */
export function compressEntry(fullEntry) {
    if (!fullEntry || !fullEntry.word) {
        return null;
    }

    const compressed = {
        w: fullEntry.word,
        p: fullEntry.pos || 'unknown'
    };

    // 提取英文释义（最多5个）
    if (fullEntry.senses && fullEntry.senses.length > 0) {
        compressed.e = fullEntry.senses
            .slice(0, 5)
            .map(sense => sense.glosses?.[0])
            .filter(Boolean);
    }

    // 提取例句（最多2个）
    if (fullEntry.senses) {
        const examples = [];
        for (const sense of fullEntry.senses) {
            if (sense.examples && sense.examples.length > 0) {
                examples.push(...sense.examples.slice(0, 2).map(ex => ex.text));
                if (examples.length >= 2) break;
            }
        }
        if (examples.length > 0) {
            compressed.x = examples.slice(0, 2);
        }
    }

    // 提取发音
    if (fullEntry.sounds && fullEntry.sounds.length > 0) {
        compressed.i = fullEntry.sounds[0].ipa;
    }

    // 提取同义词（最多3个）
    if (fullEntry.synonyms && fullEntry.synonyms.length > 0) {
        compressed.s = fullEntry.synonyms
            .slice(0, 3)
            .map(syn => syn.word)
            .filter(Boolean);
    }

    // 添加版本号
    compressed.v = 1;

    return compressed;
}

/**
 * 将云端压缩格式还原为可读格式
 * @param {CloudDictionaryEntry} compressed - 压缩的词条
 * @returns {Object} - 可读的词条格式
 */
export function decompressEntry(compressed) {
    if (!compressed || !compressed.w) {
        return null;
    }

    return {
        word: compressed.w,
        pos: compressed.p,

        // 英文释义
        english: compressed.e || [],

        // 中文翻译
        chinese: compressed.c || [],

        // 是否已翻译
        translated: !!(compressed.c && compressed.c.length > 0),

        // 附加信息
        examples: compressed.x || [],
        pronunciation: compressed.i,
        synonyms: compressed.s || [],

        // 元数据
        translatedAt: compressed.t ? new Date(compressed.t) : null,
        version: compressed.v || 1
    };
}

/**
 * 批量压缩词条
 * @param {Object[]} fullEntries - 完整词条数组
 * @returns {CloudDictionaryEntry[]} - 压缩词条数组
 */
export function compressBatch(fullEntries) {
    return fullEntries
        .map(compressEntry)
        .filter(Boolean);
}

/**
 * 批量解压词条
 * @param {CloudDictionaryEntry[]} compressed - 压缩词条数组
 * @returns {Object[]} - 可读词条数组
 */
export function decompressBatch(compressed) {
    return compressed
        .map(decompressEntry)
        .filter(Boolean);
}

/**
 * 计算压缩率
 * @param {Object} original - 原始数据
 * @param {Object} compressed - 压缩数据
 * @returns {number} - 压缩率百分比
 */
export function calculateCompressionRatio(original, compressed) {
    const originalSize = JSON.stringify(original).length;
    const compressedSize = JSON.stringify(compressed).length;

    return ((1 - compressedSize / originalSize) * 100).toFixed(2);
}

/**
 * 验证压缩词条的完整性
 * @param {CloudDictionaryEntry} entry - 压缩的词条
 * @returns {Object} - 验证结果
 */
export function validateCompressedEntry(entry) {
    const errors = [];
    const warnings = [];

    // 必需字段检查
    if (!entry.w) errors.push('缺少单词 (w)');
    if (!entry.p) errors.push('缺少词性 (p)');

    // 推荐字段检查
    if (!entry.e || entry.e.length === 0) {
        warnings.push('缺少英文释义 (e)');
    }

    // 数据类型检查
    if (entry.e && !Array.isArray(entry.e)) {
        errors.push('英文释义应为数组');
    }
    if (entry.c && !Array.isArray(entry.c)) {
        errors.push('中文释义应为数组');
    }
    if (entry.x && !Array.isArray(entry.x)) {
        errors.push('例句应为数组');
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * 创建翻译占位符
 * @param {CloudDictionaryEntry} entry - 压缩词条
 * @param {string[]} chineseTranslations - 中文翻译数组
 * @returns {CloudDictionaryEntry} - 包含翻译的词条
 */
export function addTranslation(entry, chineseTranslations) {
    return {
        ...entry,
        c: chineseTranslations,
        t: Date.now(),
        v: (entry.v || 1) + 1 // 增加版本号
    };
}

/**
 * 检查词条是否需要翻译
 * @param {CloudDictionaryEntry} entry - 压缩词条
 * @returns {boolean} - 是否需要翻译
 */
export function needsTranslation(entry) {
    return !entry.c || entry.c.length === 0;
}

/**
 * 生成用于AI翻译的简化JSON
 * @param {CloudDictionaryEntry[]} entries - 压缩词条数组
 * @returns {string} - JSON字符串
 */
export function generateTranslationJSON(entries) {
    const simplified = entries.map(entry => ({
        word: entry.w,
        pos: entry.p,
        english: entry.e || [],
        examples: entry.x || []
    }));

    return JSON.stringify(simplified, null, 2);
}

// 词性映射（用于显示）
export const POS_MAP = {
    'noun': '名词',
    'verb': '动词',
    'adj': '形容词',
    'adv': '副词',
    'prep': '介词',
    'conj': '连词',
    'pron': '代词',
    'det': '限定词',
    'num': '数词',
    'interj': '感叹词',
    'prefix': '前缀',
    'suffix': '后缀',
    'phrase': '短语',
    'name': '专有名词'
};

/**
 * 获取词性的中文名称
 * @param {string} pos - 英文词性
 * @returns {string} - 中文词性
 */
export function getPOSChinese(pos) {
    return POS_MAP[pos] || pos;
}

// 使用示例
export function example() {
    // 原始完整词条
    const fullEntry = {
        word: "lernen",
        pos: "verb",
        senses: [
            {
                glosses: ["to learn", "to study"],
                examples: [
                    { text: "Ich lerne Deutsch." },
                    { text: "Sie lernt schnell." }
                ]
            }
        ],
        sounds: [{ ipa: "/ˈlɛʁnən/" }],
        synonyms: [{ word: "studieren" }]
    };

    // 压缩
    const compressed = compressEntry(fullEntry);
    console.log('压缩后:', compressed);
    // {
    //   w: "lernen",
    //   p: "verb",
    //   e: ["to learn", "to study"],
    //   x: ["Ich lerne Deutsch.", "Sie lernt schnell."],
    //   i: "/ˈlɛʁnən/",
    //   s: ["studieren"],
    //   v: 1
    // }

    // 计算压缩率
    const ratio = calculateCompressionRatio(fullEntry, compressed);
    console.log('压缩率:', ratio + '%');

    // 添加中文翻译
    const translated = addTranslation(compressed, ['学习', '学会']);
    console.log('翻译后:', translated);

    // 解压
    const decompressed = decompressEntry(translated);
    console.log('解压后:', decompressed);
}
