/**
 * 词典诊断工具
 *
 * 用于检查词典数据库状态和排查导入问题
 */

import { localDictDB } from './LocalDictionaryDB';
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
        return results;
    }

    // 2. 检查数据库版本
    const dbVersion = localDictDB.db?.version;
    results.checks.push({
        name: '数据库版本',
        status: 'INFO',
        message: `当前版本: ${dbVersion}`
    });

    // 3. 检查本地存储版本标记
    const storedVersion = localStorage.getItem('star_vocab_dict_version');
    results.checks.push({
        name: '词典版本标记',
        status: 'INFO',
        message: `存储的版本: ${storedVersion || '未设置'}`
    });

    // 4. 检查测试单词
    const testWords = ['und', 'in', 'der', 'die', 'das', 'Haus', 'sein', 'haben'];
    const testResults = [];

    for (const word of testWords) {
        try {
            const entries = await localDictDB.getEntriesByWord(word.toLowerCase());
            testResults.push({
                word,
                found: entries.length > 0,
                count: entries.length,
                hasChinese: entries.some(e => e.translation_cn || e.has_chinese)
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
        name: '测试单词查询',
        status: foundCount > 0 ? 'OK' : 'ERROR',
        message: `找到 ${foundCount}/${testWords.length} 个测试单词`,
        details: testResults
    });

    results.checks.push({
        name: '中文翻译检查',
        status: withChineseCount > 0 ? 'OK' : 'WARNING',
        message: `${withChineseCount}/${foundCount} 个词条有中文翻译`
    });

    // 5. 估算数据库大小
    try {
        const sampleEntries = await localDictDB.getEntriesByWord('a');
        results.checks.push({
            name: '数据库内容',
            status: 'INFO',
            message: `样本查询('a')返回 ${sampleEntries.length} 个词条`
        });
    } catch (e) {
        results.checks.push({
            name: '数据库内容',
            status: 'ERROR',
            message: e.message
        });
    }

    // 6. 检查索引
    try {
        const tx = localDictDB.db.transaction(['entries'], 'readonly');
        const store = tx.objectStore('entries');
        const indexNames = Array.from(store.indexNames);

        results.checks.push({
            name: '数据库索引',
            status: 'INFO',
            message: `可用索引: ${indexNames.join(', ')}`
        });
    } catch (e) {
        results.checks.push({
            name: '数据库索引',
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
        const entries = await localDictDB.getEntriesByWord(word.toLowerCase());

        if (entries.length === 0) {
            console.log(`[Diagnostic] ❌ 未找到 "${word}"`);
            return { found: false };
        }

        console.log(`[Diagnostic] ✅ 找到 ${entries.length} 个词条:`);
        entries.forEach((entry, i) => {
            console.log(`  ${i + 1}. ID: ${entry.id}`);
            console.log(`     word: ${entry.word}`);
            console.log(`     word_lower: ${entry.word_lower}`);
            console.log(`     pos: ${entry.pos}`);
            console.log(`     translation_cn: ${entry.translation_cn || '(无)'}`);
            console.log(`     translation_en: ${entry.translation_en || '(无)'}`);
            console.log(`     has_chinese: ${entry.has_chinese}`);
            console.log(`     sources: ${JSON.stringify(entry.sources)}`);
        });

        return { found: true, entries };
    } catch (e) {
        console.error(`[Diagnostic] 查询出错:`, e);
        return { found: false, error: e.message };
    }
}

/**
 * 强制重新导入词典
 */
export async function forceReimport() {
    console.log('[Diagnostic] 开始强制重新导入...');

    const result = await forceReimportDictionary((progress, message) => {
        console.log(`[Diagnostic] ${progress}%: ${message}`);
    });

    console.log('[Diagnostic] 导入完成:', result);
    return result;
}

/**
 * 清空数据库（谨慎使用！）
 */
export async function clearDatabase() {
    console.warn('[Diagnostic] ⚠️ 清空数据库...');

    try {
        await localDictDB.clearAll();
        localStorage.removeItem('star_vocab_dict_version');
        console.log('[Diagnostic] ✅ 数据库已清空');
        return { success: true };
    } catch (e) {
        console.error('[Diagnostic] ❌ 清空失败:', e);
        return { success: false, error: e.message };
    }
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
            verify: verifyDictionary
        };
        console.log('词典诊断工具已加载到 window.dictDiagnostic');
        console.log('可用命令:');
        console.log('  - dictDiagnostic.run()         // 运行完整诊断');
        console.log('  - dictDiagnostic.check("Haus") // 检查特定单词');
        console.log('  - dictDiagnostic.verify("Apfel") // 验证词典');
        console.log('  - dictDiagnostic.reimport()    // 强制重新导入');
        console.log('  - dictDiagnostic.clear()       // 清空数据库（谨慎！）');
    }
}

// 默认导出
export default {
    runDiagnostics,
    checkWord,
    forceReimport,
    clearDatabase,
    exposeToConsole
};
