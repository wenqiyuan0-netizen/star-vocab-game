/**
 * ID Generation Utilities
 *
 * 生成基于词条和词性的稳定整数 ID，确保跨端一致性
 *
 * 核心原则：
 * - 相同的 (word, pos) 组合始终生成相同的 ID
 * - 不区分大小写
 * - 与 Python ETL 脚本使用相同的哈希算法
 * - 生成正整数，适合数据库 bigint 类型
 */

/**
 * 生成稳定的整数 ID
 *
 * 算法说明：
 * 1. 组合 word 和 pos 生成签名字符串（小写）
 * 2. 使用 32 位字符串哈希函数
 * 3. 确保 ID 为正整数（取绝对值）
 *
 * 此算法与 JavaScript 中常用的简单哈希算法一致，
 * 也易于在 Python 中复现，确保 ETL 和前端生成的 ID 相同。
 *
 * @param {string} word - 词条（如 "Haus"）
 * @param {string} pos - 词性（如 "noun", "verb", "adj" 等）
 * @returns {number} - 稳定的正整数 ID
 *
 * @example
 * generateStableId("Haus", "noun")     // 总是返回相同的整数，如 1234567890
 * generateStableId("haus", "noun")     // 与上面相同（不区分大小写）
 * generateStableId("Haus", "NOUN")     // 与上面相同（不区分大小写）
 * generateStableId("laufen", "verb")   // 不同于下面的
 * generateStableId("laufen", "noun")   // 不同的词性，不同的 ID
 */
export const generateStableId = (word, pos) => {
  // 标准化输入：转小写
  const signature = `${word}:${pos}`.toLowerCase();

  // 简单的 32 位字符串哈希算法
  // 这是一个常用的哈希函数，与 Java 的 String.hashCode() 类似
  let hash = 0;
  for (let i = 0; i < signature.length; i++) {
    const char = signature.charCodeAt(i);
    hash = ((hash << 5) - hash) + char; // hash * 31 + char
    hash = hash & hash; // Convert to 32bit integer
  }

  // 确保为正整数
  return Math.abs(hash);
};

/**
 * 检测是否为临时 ID
 *
 * 临时 ID 格式：c_<timestamp>_<random>
 * 例如：c_1702838400000_a1b2c3d4e
 *
 * @param {string|number} id
 * @returns {boolean}
 *
 * @example
 * isTemporaryId('c_1702838400000_a1b2c3d4e')  // true
 * isTemporaryId(1234567890)                    // false
 * isTemporaryId('550e8400-e29b-41d4-a716-446655440000')  // false
 */
export const isTemporaryId = (id) => {
  return typeof id === 'string' && id.startsWith('c_');
};

/**
 * 检测是否为 UUID（旧格式）
 *
 * UUID 格式：xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * 例如：550e8400-e29b-41d4-a716-446655440000
 *
 * @param {string|number} id
 * @returns {boolean}
 *
 * @example
 * isUuid('550e8400-e29b-41d4-a716-446655440000')  // true
 * isUuid(1234567890)                              // false
 * isUuid('c_1702838400000_a1b2c3d4e')            // false
 */
export const isUuid = (id) => {
  if (typeof id !== 'string') return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(id);
};

/**
 * 检测是否为稳定整数 ID（新格式）
 *
 * 稳定 ID 是正整数
 *
 * @param {string|number} id
 * @returns {boolean}
 *
 * @example
 * isStableId(1234567890)              // true
 * isStableId('1234567890')            // false（必须是数字类型）
 * isStableId(-123)                    // false（必须为正数）
 * isStableId('c_123')                 // false
 * isStableId('550e8400-e29b...')     // false
 */
export const isStableId = (id) => {
  return typeof id === 'number' && Number.isInteger(id) && id > 0;
};

/**
 * 获取 ID 类型（用于调试和日志）
 *
 * @param {string|number} id
 * @returns {string} - 'stable' | 'temporary' | 'uuid' | 'unknown'
 *
 * @example
 * getIdType(1234567890)                           // 'stable'
 * getIdType('c_1702838400000_a1b2c3d4e')         // 'temporary'
 * getIdType('550e8400-e29b-41d4-a716-446655440000')  // 'uuid'
 * getIdType('invalid')                            // 'unknown'
 */
export const getIdType = (id) => {
  if (isStableId(id)) return 'stable';
  if (isTemporaryId(id)) return 'temporary';
  if (isUuid(id)) return 'uuid';
  return 'unknown';
};

/**
 * 批量生成稳定 ID
 *
 * @param {Array<{de: string, pos: string}>} words - 词条数组
 * @returns {Array<{...word, id: number}>} - 带 ID 的词条数组
 *
 * @example
 * const words = [
 *   { de: 'Haus', pos: 'noun', cn: '房子' },
 *   { de: 'laufen', pos: 'verb', cn: '跑' }
 * ];
 * const wordsWithIds = batchGenerateIds(words);
 * // [
 * //   { de: 'Haus', pos: 'noun', cn: '房子', id: 1234567890 },
 * //   { de: 'laufen', pos: 'verb', cn: '跑', id: 9876543210 }
 * // ]
 */
export const batchGenerateIds = (words) => {
  return words.map(word => ({
    ...word,
    id: generateStableId(word.de, word.pos || 'unknown')
  }));
};
