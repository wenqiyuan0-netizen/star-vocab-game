/**
 * 词典初始化服务
 *
 * IndexedDB 现在仅用于用户数据存储，不再存储预置词典
 * 预置词典使用 localDictionary.js (内存缓存)
 */

import { localDictDB } from './LocalDictionaryDB';

const DICT_VERSION_KEY = 'star_vocab_dict_version';
// 版本 3.0.0: 移除 IndexedDB 中的预置词典，改用内存缓存
const CURRENT_DICT_VERSION = '3.0.0';

/**
 * 删除旧的 IndexedDB 数据库（带重试）
 */
async function deleteOldDatabase(retryCount = 0) {
    const maxRetries = 3;

    console.log(`[DictInit] Attempting to delete database (attempt ${retryCount + 1}/${maxRetries + 1})...`);

    return new Promise((resolve) => {
        const request = indexedDB.deleteDatabase('StarVocabDictionaryDB');

        let timeoutId = setTimeout(() => {
            console.warn('[DictInit] Delete timeout after 5 seconds');
            resolve(false);
        }, 5000);

        request.onsuccess = () => {
            clearTimeout(timeoutId);
            console.log('[DictInit] Old database deleted successfully');
            resolve(true);
        };

        request.onerror = (e) => {
            clearTimeout(timeoutId);
            console.error('[DictInit] Error deleting database:', e);
            resolve(false);
        };

        request.onblocked = () => {
            clearTimeout(timeoutId);
            console.warn('[DictInit] Delete blocked - database still in use');

            if (retryCount < maxRetries) {
                console.log(`[DictInit] Waiting 1 second before retry...`);
                setTimeout(async () => {
                    const result = await deleteOldDatabase(retryCount + 1);
                    resolve(result);
                }, 1000);
            } else {
                console.error('[DictInit] Delete blocked after multiple retries. Please close all other tabs.');
                resolve(false);
            }
        };
    });
}

/**
 * 检查词典是否需要初始化
 */
async function needsInitialization() {
    // 检查版本
    const storedVersion = localStorage.getItem(DICT_VERSION_KEY);
    if (storedVersion !== CURRENT_DICT_VERSION) {
        console.log(`[DictInit] Version upgrade (${storedVersion} → ${CURRENT_DICT_VERSION})`);
        console.log('[DictInit] Cleaning IndexedDB (removing old dictionary data)...');

        // 设置全局标志
        window._dictInitializing = true;

        // 强制关闭所有数据库连接
        localDictDB.close();

        // 等待所有异步查询完成
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 尝试删除旧数据库（清理旧版本的词典数据）
        const deleted = await deleteOldDatabase();
        if (!deleted) {
            console.warn('[DictInit] Failed to delete database. Using fallback: clearing all stores...');

            // 降级方案：清空所有表
            try {
                await localDictDB.ensureConnection();
                await localDictDB.clearAll();
                console.log('[DictInit] All stores cleared successfully');
            } catch (e) {
                console.error('[DictInit] Fallback also failed:', e);
            }
        }

        // 等待确保操作完成
        await new Promise(resolve => setTimeout(resolve, 500));

        // 重新建立连接（为用户数据做准备）
        console.log('[DictInit] Re-establishing database connection for user data...');
        await localDictDB.ensureConnection();

        return true;
    }

    // 版本匹配，无需初始化
    // IndexedDB 现在只用于用户数据，不需要检查词条数量
    try {
        await localDictDB.ensureConnection();
        console.log('[DictInit] IndexedDB ready for user data storage');
        return false;
    } catch (e) {
        console.log('[DictInit] IndexedDB connection error, will reinitialize:', e);
        window._dictInitializing = true;
        return true;
    }
}


/**
 * 初始化词典系统
 * @param {Function} onProgress - 进度回调 (percent, message)
 */
export async function initializeDictionary(onProgress = () => { }) {
    try {
        const shouldInit = await needsInitialization();
        if (!shouldInit) {
            onProgress(100, "词典系统已就绪");
            return { success: true, alreadyInitialized: true };
        }

        console.log('[DictInit] Starting dictionary system initialization...');
        onProgress(10, "正在初始化 IndexedDB...");

        // IndexedDB 现在只用于存储：
        // - 用户添加的单词 (user_words)
        // - 翻译缓存
        // - AI 生成的例句
        // 预置词典使用 localDictionary.js (内存缓存)

        onProgress(50, "正在清理旧数据...");

        // 确保数据库结构正确
        await localDictDB.ensureConnection();

        onProgress(80, "IndexedDB 初始化完成");

        // 标记版本
        localStorage.setItem(DICT_VERSION_KEY, CURRENT_DICT_VERSION);
        onProgress(100, "词典系统就绪");

        // 清除初始化标志
        window._dictInitializing = false;
        console.log('[DictInit] Dictionary system initialization complete');
        console.log('[DictInit] Note: Pre-built dictionary now uses memory cache (localDict)');

        return { success: true };
    } catch (error) {
        console.error('[DictInit] Initialization failed:', error);

        // 即使失败也标记为已初始化，避免无限重试
        localStorage.setItem(DICT_VERSION_KEY, CURRENT_DICT_VERSION);
        onProgress(100, "词典系统初始化遇到问题: " + error.message);
        window._dictInitializing = false;

        return { success: false, error: error.message };
    }
}

/**
 * 强制重新初始化 (用于调试)
 */
export async function forceReimportDictionary(onProgress = () => { }) {
    localStorage.removeItem(DICT_VERSION_KEY);
    await deleteOldDatabase();
    window.location.reload();
}

/**
 * 验证词典是否可用
 * 现在使用 localDict (内存缓存) 而不是 IndexedDB
 */
export async function verifyDictionary(word = 'Apfel') {
    try {
        // 动态导入以避免循环依赖
        const { localDict } = await import('../../../utils/localDictionary');

        const entries = await localDict.lookup(word.toLowerCase());

        console.log(`[DictVerify] Testing word: ${word}`);
        console.log(`[DictVerify] Found ${entries.length} entries in memory cache:`);

        entries.forEach((e, i) => {
            console.log(`  ${i + 1}. ${e.w} (${e.p}): ${e.c?.join('; ') || e.e?.join('; ')}`);
            if (e.x && e.x.length > 0) {
                console.log(`     Example: ${e.x[0]}`);
            }
        });

        return {
            found: entries.length > 0,
            count: entries.length,
            entries
        };
    } catch (e) {
        console.error('[DictVerify] Error:', e);
        return { found: false, error: e.message };
    }
}

export default { initializeDictionary, forceReimportDictionary, verifyDictionary };
