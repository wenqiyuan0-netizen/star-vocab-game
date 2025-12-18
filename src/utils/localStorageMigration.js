/**
 * Local Storage Migration Utilities
 *
 * 用于将本地存储中的旧数据格式迁移到新格式：
 * - 旧格式：临时 ID (c_xxx) 或 UUID
 * - 新格式：稳定整数 ID + pos 字段
 */

import { generateStableId, isStableId, isTemporaryId, isUuid, getIdType } from './idUtils';

const STORAGE_KEY = 'vocab_game_db';
const MIGRATION_LOG_KEY = 'vocab_migration_log';

/**
 * 迁移本地存储的旧数据
 *
 * 迁移策略：
 * 1. 读取 localStorage 中的词条数据
 * 2. 对每个词条：
 *    - 如果没有 pos 字段，根据 gender 推断（有 gender 则为 noun，否则为 unknown）
 *    - 如果 ID 不是稳定 ID（是临时 ID 或 UUID），重新生成稳定 ID
 *    - 添加缺失的字段（proficiency, graduated, lastReview）
 * 3. 保存迁移后的数据
 * 4. 记录迁移日志
 *
 * @returns {Object} 迁移结果
 *   - success: boolean - 是否成功
 *   - migrated: boolean - 是否执行了迁移
 *   - wordCount: number - 处理的词条数
 *   - changedCount: number - 修改的词条数
 *   - errors: Array - 错误列表
 */
export const migrateLocalStorage = () => {
  const result = {
    success: false,
    migrated: false,
    wordCount: 0,
    changedCount: 0,
    errors: []
  };

  try {
    // 1. 读取数据
    const data = localStorage.getItem(STORAGE_KEY);

    if (!data) {
      console.log('ℹ️ No local data to migrate');
      result.success = true;
      return result;
    }

    let words;
    try {
      words = JSON.parse(data);
    } catch (parseError) {
      result.errors.push(`Failed to parse local data: ${parseError.message}`);
      return result;
    }

    if (!Array.isArray(words) || words.length === 0) {
      console.log('ℹ️ No words in local storage');
      result.success = true;
      return result;
    }

    result.wordCount = words.length;

    // 2. 迁移每个词条
    const updatedWords = words.map((word, index) => {
      let changed = false;
      const updates = {};

      // 2.1 推断并添加 pos 字段（如果缺失）
      if (!word.pos) {
        if (word.gender && ['m', 'f', 'n'].includes(word.gender)) {
          updates.pos = 'noun';
        } else {
          updates.pos = 'unknown';
        }
        changed = true;
      } else {
        updates.pos = word.pos;
      }

      // 2.2 检查并重新生成 ID（如果需要）
      const currentIdType = getIdType(word.id);

      if (currentIdType !== 'stable') {
        // ID 不是稳定 ID，需要重新生成
        try {
          const newId = generateStableId(word.de, updates.pos);
          updates.id = newId;
          changed = true;

          console.log(`🔄 Migrating ID for "${word.de}": ${currentIdType} (${word.id}) -> stable (${newId})`);
        } catch (idError) {
          result.errors.push(`Failed to generate ID for word[${index}] "${word.de}": ${idError.message}`);
          // 保留原 ID
          updates.id = word.id;
        }
      } else {
        updates.id = word.id;
      }

      // 2.3 添加缺失的字段
      if (word.proficiency === undefined) {
        updates.proficiency = 0;
        changed = true;
      }

      if (word.graduated === undefined) {
        updates.graduated = false;
        changed = true;
      }

      if (word.lastReview === undefined) {
        updates.lastReview = null;
        changed = true;
      }

      if (changed) {
        result.changedCount++;
      }

      return { ...word, ...updates };
    });

    // 3. 保存迁移后的数据
    if (result.changedCount > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedWords));
        result.migrated = true;
        result.success = true;

        // 4. 记录迁移日志
        const migrationLog = {
          timestamp: new Date().toISOString(),
          wordCount: result.wordCount,
          changedCount: result.changedCount,
          version: '2.0' // 新的数据格式版本
        };
        localStorage.setItem(MIGRATION_LOG_KEY, JSON.stringify(migrationLog));

        console.log(`✅ Local storage migrated successfully: ${result.changedCount}/${result.wordCount} words updated`);
      } catch (saveError) {
        result.errors.push(`Failed to save migrated data: ${saveError.message}`);
        result.success = false;
      }
    } else {
      // 没有需要迁移的数据
      result.success = true;
      console.log('✅ Local storage is already up-to-date');
    }

  } catch (error) {
    result.errors.push(`Migration failed: ${error.message}`);
    console.error('❌ Migration error:', error);
  }

  return result;
};

/**
 * 检查是否需要迁移
 *
 * @returns {boolean} 是否需要迁移
 */
export const needsMigration = () => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return false;

    const words = JSON.parse(data);
    if (!Array.isArray(words) || words.length === 0) return false;

    // 检查是否有任何词条需要迁移
    return words.some(word => {
      // 缺少 pos 字段
      if (!word.pos) return true;

      // ID 不是稳定 ID
      if (!isStableId(word.id)) return true;

      // 缺少必需字段
      if (word.proficiency === undefined || word.graduated === undefined) return true;

      return false;
    });
  } catch (error) {
    console.error('Error checking migration status:', error);
    return false;
  }
};

/**
 * 获取迁移日志
 *
 * @returns {Object|null} 迁移日志或 null
 */
export const getMigrationLog = () => {
  try {
    const log = localStorage.getItem(MIGRATION_LOG_KEY);
    return log ? JSON.parse(log) : null;
  } catch (error) {
    console.error('Error reading migration log:', error);
    return null;
  }
};

/**
 * 清除迁移日志（仅用于测试）
 */
export const clearMigrationLog = () => {
  localStorage.removeItem(MIGRATION_LOG_KEY);
};

/**
 * 验证数据完整性
 *
 * @returns {Object} 验证结果
 *   - valid: boolean - 数据是否有效
 *   - errors: Array - 错误列表
 *   - warnings: Array - 警告列表
 */
export const validateLocalData = () => {
  const validation = {
    valid: true,
    errors: [],
    warnings: []
  };

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      validation.warnings.push('No local data found');
      return validation;
    }

    const words = JSON.parse(data);
    if (!Array.isArray(words)) {
      validation.valid = false;
      validation.errors.push('Data is not an array');
      return validation;
    }

    words.forEach((word, index) => {
      // 检查必需字段
      if (!word.de) {
        validation.errors.push(`Word[${index}] missing 'de' field`);
        validation.valid = false;
      }

      if (!word.id) {
        validation.errors.push(`Word[${index}] "${word.de}" missing 'id' field`);
        validation.valid = false;
      }

      if (!word.pos) {
        validation.warnings.push(`Word[${index}] "${word.de}" missing 'pos' field`);
      }

      // 检查 ID 类型
      if (word.id && !isStableId(word.id)) {
        const idType = getIdType(word.id);
        validation.warnings.push(`Word[${index}] "${word.de}" has non-stable ID (${idType})`);
      }
    });

  } catch (error) {
    validation.valid = false;
    validation.errors.push(`Validation failed: ${error.message}`);
  }

  return validation;
};
