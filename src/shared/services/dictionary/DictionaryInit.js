/**
 * 词典初始化服务
 * 
 * 在应用启动时检查并导入词典数据
 */

import { localDictDB } from './LocalDictionaryDB';
import { dictionaryImporter } from './DictionaryImporter';

const DICT_VERSION_KEY = 'star_vocab_dict_version';
// Bump version to force re-import for new Goethe data
const CURRENT_DICT_VERSION = '2.2.0';

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
        console.log(`[DictInit] Version mismatch (${storedVersion} vs ${CURRENT_DICT_VERSION}), needs import`);

        // 设置全局标志，阻止其他代码查询词典
        window._dictInitializing = true;

        // 强制关闭所有数据库连接
        localDictDB.close();

        // 等待所有异步查询完成
        console.log('[DictInit] Waiting for active queries to complete...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 尝试删除旧数据库
        const deleted = await deleteOldDatabase();
        if (!deleted) {
            console.warn('[DictInit] Failed to delete database. Using fallback: clearing all stores...');

            // 降级方案：清空所有表而不是删除数据库
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

        // 重新建立连接
        console.log('[DictInit] Re-establishing database connection...');
        await localDictDB.ensureConnection();

        return true;
    }

    // 检查是否有数据
    try {
        await localDictDB.ensureConnection();
        const testEntries = await localDictDB.getEntriesByWord('und');
        if (!testEntries || testEntries.length === 0) {
            console.log('[DictInit] No entries found, needs import');
            window._dictInitializing = true;
            return true;
        }
        console.log('[DictInit] Dictionary already initialized');
        return false;
    } catch (e) {
        console.log('[DictInit] Error checking, clearing and reimporting:', e);
        window._dictInitializing = true;
        try {
            await localDictDB.clearAll();
        } catch (clearError) {
            console.error('[DictInit] Clear failed:', clearError);
        }
        return true;
    }
}


/**
 * 初始化词典
 * @param {Function} onProgress - 进度回调 (percent, message)
 */
export async function initializeDictionary(onProgress = () => { }) {
    try {
        const shouldInit = await needsInitialization();
        if (!shouldInit) {
            onProgress(100, "词典已就绪");
            return { success: true, alreadyInitialized: true };
        }

        console.log('[DictInit] Starting dictionary import...');
        onProgress(0, "正在准备词典数据...");

        // 1. 导入常用词典 (25000词)
        onProgress(10, "正在下载常用词典...");
        let commonData;
        try {
            // 使用动态导入替代 fetch，直接从源码目录加载
            const commonModule = await import('./dict/Common_Vocab_local.json');
            commonData = commonModule.default || commonModule;
        } catch (e) {
            throw new Error('Failed to load common dictionary: ' + e.message);
        }

        onProgress(30, `正在导入常用词典 (${commonData.length} 条)...`);

        await dictionaryImporter.importCommonVocab(commonData);
        onProgress(60, "常用词典导入完成");

        // 2. 导入 Goethe 词典
        onProgress(65, "正在下载歌德词典...");
        try {
            const goetheModule = await import('./dict/Goethe_A1-B1_Levels_Combined.json');
            const goetheData = goetheModule.default || goetheModule;
            
            onProgress(75, `正在导入歌德词典 (${goetheData.length} 条)...`);
            // Use 'mixed' as level to indicate it contains multiple levels, 
            // though adapter handles internal 'level' field anyway.
            await dictionaryImporter.importGoetheVocab(goetheData, 'mixed');
        } catch (e) {
            console.warn('[DictInit] Failed to load Goethe dictionary:', e);
        }

        // 完成
        localStorage.setItem(DICT_VERSION_KEY, CURRENT_DICT_VERSION);
        onProgress(100, "所有词典导入完成");

        // 清除初始化标志，允许正常查询
        window._dictInitializing = false;
        console.log('[DictInit] Dictionary initialization complete, queries enabled');

        return { success: true };
    } catch (error) {
        console.error('[DictInit] Initialization failed:', error);
        onProgress(100, "词典导入失败: " + error.message);
        window._dictInitializing = false; // 即使失败也要清除标志
        throw error;
    }
}

/**
 * 强制重新导入 (用于调试)
 */
export async function forceReimportDictionary(onProgress = () => { }) {
    localStorage.removeItem(DICT_VERSION_KEY);
    await deleteOldDatabase();
    window.location.reload();
}

/**
 * 验证词典是否可用
 */
export async function verifyDictionary(word = 'Apfel') {
    try {
        await localDictDB.ensureConnection();
        const entries = await localDictDB.getEntriesByWord(word.toLowerCase());

        console.log(`[DictVerify] Testing word: ${word}`);
        console.log(`[DictVerify] Found ${entries.length} entries:`);

        entries.forEach((e, i) => {
            console.log(`  ${i + 1}. ${e.word} (${e.pos}): ${e.translation_cn || e.translation_en}`);
            if (e.examples?.length > 0) {
                console.log(`     Example: ${e.examples[0].de}`);
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
