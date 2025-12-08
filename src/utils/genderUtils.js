/**
 * 性别代码转换工具
 * 统一管理 德语冠词(der/die/das) 和 性别代码(m/f/n) 的转换
 */

/**
 * 将完整冠词转换为缩写性别代码
 * @param {string} article - 冠词 (der/die/das)
 * @returns {string} 性别代码 (m/f/n) 或空字符串
 */
export function articleToGender(article) {
    const normalized = String(article || '').toLowerCase().trim();
    switch (normalized) {
        case 'der':
            return 'm';
        case 'die':
            return 'f';
        case 'das':
            return 'n';
        default:
            return '';
    }
}

/**
 * 将缩写性别代码转换为完整冠词
 * @param {string} gender - 性别代码 (m/f/n)
 * @returns {string} 冠词 (der/die/das) 或空字符串
 */
export function genderToArticle(gender) {
    const normalized = String(gender || '').toLowerCase().trim();
    switch (normalized) {
        case 'm':
            return 'der';
        case 'f':
            return 'die';
        case 'n':
            return 'das';
        // 如果已经是完整冠词，直接返回
        case 'der':
        case 'die':
        case 'das':
            return normalized;
        default:
            return '';
    }
}

/**
 * 标准化性别代码：确保返回值始终是 m/f/n 或空字符串
 * @param {string} input - 可能是冠词或性别代码
 * @returns {string} 标准化的性别代码 (m/f/n) 或空字符串
 */
export function normalizeGender(input) {
    const normalized = String(input || '').toLowerCase().trim();

    // 如果是缩写代码，直接返回
    if (normalized === 'm' || normalized === 'f' || normalized === 'n') {
        return normalized;
    }

    // 如果是完整冠词，转换为缩写
    return articleToGender(normalized);
}

/**
 * 从德语单词中提取冠词和基础词
 * @param {string} germanWord - 德语单词，可能包含冠词
 * @returns {Object} { article: string, base: string, gender: string }
 */
export function extractArticleFromWord(germanWord) {
    const trimmed = String(germanWord || '').trim();
    const tokens = trimmed.split(/\s+/);

    if (tokens.length < 2) {
        return { article: '', base: trimmed, gender: '' };
    }

    const firstToken = tokens[0].toLowerCase();
    const ARTICLES = ['der', 'die', 'das'];
    const GENDER_CODES = ['m', 'f', 'n'];

    // 检查第一个词是否是冠词或性别代码
    if (ARTICLES.includes(firstToken) || GENDER_CODES.includes(firstToken)) {
        const gender = normalizeGender(firstToken);
        const article = genderToArticle(gender);
        const base = tokens.slice(1).join(' ');
        return { article, base, gender };
    }

    return { article: '', base: trimmed, gender: '' };
}

/**
 * 获取带冠词的完整德语单词（用于显示和TTS）
 * @param {string} word - 基础单词
 * @param {string} gender - 性别代码 (m/f/n)
 * @returns {string} 完整单词，如 "der Hund"
 */
export function getFullGermanWord(word, gender) {
    const article = genderToArticle(gender);
    return article ? `${article} ${word}` : word;
}
