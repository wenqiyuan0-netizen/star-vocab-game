/**
 * 词典诊断工具
 *
 * 用于检查词典系统状态和排查问题
 */

import { localDictDB } from './LocalDictionaryDB';
import { localDict } from '../../../utils/localDictionary';
import { initializeDictionary, verifyDictionary, forceReimportDictionary } from './DictionaryInit';

/**
 * 运行完整诊断
 */
export async function runDiagnostics() {
    console.log('========== 词典诊断工具 ==========');

    const results = {
        timestamp: new Date().toISOString(),
        checks: []
    };

    // 1. 检查 IndexedDB 连接
    try {
        await localDictDB.initPromise;
        results.checks.push({
            name: 'IndexedDB 连接',
            status: 'OK',
            message: '数据库连接正常'
        });
    } catch (e) {
        results.checks.push({
            name: 'IndexedDB 连接',
            status: 'ERROR',
            message: e.message
        });
    }

    // 2. 检查数据库版本
    const dbVersion = localDictDB.db?.version;
    results.checks.push({
        name: 'IndexedDB 版本',
        status: 'INFO',
        message: `当前版本: ${dbVersion}`
    });

    // 3. 检查本地存储版本标记
    const storedVersion = localStorage.getItem('star_vocab_dict_version');
    results.checks.push({
        name: '词典系统版本',
        status: 'INFO',
        message: `存储的版本: ${storedVersion || '未设置'}`
    });

    // 4. 检查内存词典（预置词典）
    try {
        await localDict.load();
        const stats = await localDict.stats();

        results.checks.push({
            name: '内存词典加载',
            status: 'OK',
            message: `已加载 ${stats.totalEntries.toLocaleString()} 个词条`
        });

        results.checks.push({
            name: '内存词典统计',
            status: 'INFO',
            message: `唯一单词: ${stats.uniqueWords}, 发音: ${stats.withPronunciation}, 例句: ${stats.withExamples}`,
            details: stats.byPartOfSpeech
        });
    } catch (e) {
        results.checks.push({
            name: '内存词典加载',
            status: 'ERROR',
            message: e.message
        });
    }

    // 5. 测试内存词典查询
    const testWords = ['und', 'in', 'der', 'die', 'das', 'Haus', 'sein', 'haben'];
    const testResults = [];

    for (const word of testWords) {
        try {
            const entries = await localDict.lookup(word.toLowerCase());
            testResults.push({
                word,
                found: entries.length > 0,
                count: entries.length,
                hasChinese: entries.some(e => e.c && e.c.length > 0)
            });
        } catch (e) {
            testResults.push({
                word,
                found: false,
                error: e.message
            });
        }
    }

    const foundCount = testResults.filter(r => r.found).length;
    const withChineseCount = testResults.filter(r => r.hasChinese).length;

    results.checks.push({
        name: '预置词典查询',
        status: foundCount > 0 ? 'OK' : 'ERROR',
        message: `找到 ${foundCount}/${testWords.length} 个测试单词`,
        details: testResults
    });

    results.checks.push({
        name: '中文翻译检查',
        status: withChineseCount > 0 ? 'OK' : 'WARNING',
        message: `${withChineseCount}/${foundCount} 个词条有中文翻译`
    });

    // 6. 检查 IndexedDB 索引（用户数据）
    try {
        const tx = localDictDB.db.transaction(['entries'], 'readonly');
        const store = tx.objectStore('entries');
        const indexNames = Array.from(store.indexNames);

        results.checks.push({
            name: 'IndexedDB 索引',
            status: 'INFO',
            message: `可用索引: ${indexNames.join(', ') || '(无)'}`
        });

        // 统计用户数据量
        const count = await localDictDB.countEntries();
        results.checks.push({
            name: 'IndexedDB 用户数据',
            status: 'INFO',
            message: `存储了 ${count} 个用户词条`
        });
    } catch (e) {
        results.checks.push({
            name: 'IndexedDB 索引',
            status: 'WARNING',
            message: e.message
        });
    }

    console.log('========== 诊断结果 ==========');
    results.checks.forEach(check => {
        console.log(`[${check.status}] ${check.name}: ${check.message}`);
        if (check.details) {
            console.log('  详情:', check.details);
        }
    });
    console.log('================================');

    return results;
}

/**
 * 检查特定单词
 */
export async function checkWord(word) {
    console.log(`[Diagnostic] 检查单词: ${word}`);

    try {
        // 1. 检查内存词典
        const memEntries = await localDict.lookup(word.toLowerCase());

        console.log(`\n[内存词典] 找到 ${memEntries.length} 个词条:`);
        memEntries.forEach((entry, i) => {
            console.log(`  ${i + 1}. ${entry.w} (${entry.p})`);
            console.log(`     中文: ${entry.c?.join('; ') || '(无)'}`);
            console.log(`     英文: ${entry.e?.join('; ') || '(无)'}`);
            console.log(`     冠词: ${entry.a || '(无)'}`);
            console.log(`     复数: ${entry.pl || '(无)'}`);
        });

        // 2. 检查 IndexedDB（用户数据）
        const dbEntries = await localDictDB.getEntriesByWord(word.toLowerCase());

        console.log(`\n[IndexedDB 用户数据] 找到 ${dbEntries.length} 个词条:`);
        dbEntries.forEach((entry, i) => {
            console.log(`  ${i + 1}. ID: ${entry.id}`);
            console.log(`     word: ${entry.word}`);
            console.log(`     pos: ${entry.pos}`);
            console.log(`     translation_cn: ${entry.translation_cn || '(无)'}`);
            console.log(`     sources: ${JSON.stringify(entry.sources)}`);
        });

        return {
            found: memEntries.length > 0 || dbEntries.length > 0,
            memEntries,
            dbEntries
        };
    } catch (e) {
        console.error(`[Diagnostic] 查询出错:`, e);
        return { found: false, error: e.message };
    }
}

/**
 * 强制重新导入词典
 */
export async function forceReimport() {
    console.log('[Diagnostic] 开始强制重新初始化...');
    console.log('[Diagnostic] 注意：现在只会清理 IndexedDB，不会重新导入预置词典');
    console.log('[Diagnostic] 预置词典使用内存缓存，会在查询时自动加载');

    const result = await forceReimportDictionary((progress, message) => {
        console.log(`[Diagnostic] ${progress}%: ${message}`);
    });

    console.log('[Diagnostic] 初始化完成:', result);
    return result;
}

/**
 * 清空数据库（谨慎使用！）
 */
export async function clearDatabase() {
    console.warn('[Diagnostic] ⚠️ 清空 IndexedDB...');
    console.warn('[Diagnostic] 注意：这只会清除用户数据，不影响预置词典');

    try {
        await localDictDB.clearAll();
        localStorage.removeItem('star_vocab_dict_version');
        console.log('[Diagnostic] ✅ IndexedDB 已清空');
        return { success: true };
    } catch (e) {
        console.error('[Diagnostic] ❌ 清空失败:', e);
        return { success: false, error: e.message };
    }
}

/**
 * 清除内存词典缓存
 */
export async function clearMemoryCache() {
    console.log('[Diagnostic] 清除内存词典缓存...');
    localDict.clear();
    console.log('[Diagnostic] ✅ 内存缓存已清除，下次查询时会重新加载');
    return { success: true };
}

/**
 * 导出诊断工具到 window 对象（方便在控制台使用）
 */
export function exposeToConsole() {
    if (typeof window !== 'undefined') {
        window.dictDiagnostic = {
            run: runDiagnostics,
            check: checkWord,
            reimport: forceReimport,
            clear: clearDatabase,
            clearCache: clearMemoryCache,
            verify: verifyDictionary
        };
        console.log('✅ 词典诊断工具已加载到 window.dictDiagnostic');
        console.log('');
        console.log('📋 可用命令:');
        console.log('  - dictDiagnostic.run()              // 运行完整诊断');
        console.log('  - dictDiagnostic.check("Haus")      // 检查特定单词');
        console.log('  - dictDiagnostic.verify("Apfel")    // 验证词典');
        console.log('  - dictDiagnostic.clearCache()       // 清除内存缓存');
        console.log('  - dictDiagnostic.clear()            // 清空 IndexedDB（谨慎！）');
        console.log('  - dictDiagnostic.reimport()         // 强制重新初始化');
        console.log('');
    }
}

// 默认导出
export default {
    runDiagnostics,
    checkWord,
    forceReimport,
    clearDatabase,
    clearMemoryCache,
    exposeToConsole
};
