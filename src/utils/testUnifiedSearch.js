/**
 * 测试统一搜索服务
 *
 * 在浏览器控制台使用：
 *   import { testUnifiedSearch } from './utils/testUnifiedSearch'
 *   testUnifiedSearch()
 */

import { unifiedSearch } from './unifiedDictionarySearch';

export async function testUnifiedSearch() {
    console.log('🧪 测试统一搜索服务\n');
    console.log('='.repeat(60));

    // 1. 检查服务状态
    console.log('\n1️⃣ 检查服务状态...');
    const status = await unifiedSearch.checkStatus();
    console.log('服务状态:');
    console.log(`  本地 Common 词典: ${status.localCommon ? '✅' : '❌'}`);
    console.log(`  云端 Dictionary: ${status.cloudDictionary ? '✅' : '❌'}`);
    console.log(`  词形还原服务: ${status.cloudLemmatization ? '✅' : '❌'}`);

    // 2. 测试基础词搜索（应该在本地找到）
    console.log('\n2️⃣ 测试基础词搜索（本地）...');
    const testBasic = ['und', 'in', 'Haus'];
    for (const word of testBasic) {
        const result = await unifiedSearch.search(word);
        console.log(`  ${word}: ${result.found ? '✅' : '❌'} (${result.source}, ${result.entries.length} 个结果)`);
        if (result.found && result.entries[0]) {
            console.log(`    → ${result.entries[0].w} (${result.entries[0].p}): ${result.entries[0].c?.[0] || result.entries[0].e?.[0] || '无翻译'}`);
        }
    }

    // 3. 测试词形还原
    console.log('\n3️⃣ 测试词形还原...');
    const testLemma = [
        { variant: 'Auffahrten', expected: 'Auffahrt' },
        { variant: 'Häuser', expected: 'Haus' },
        { variant: 'lernten', expected: 'lernen' }
    ];

    for (const test of testLemma) {
        const result = await unifiedSearch.search(test.variant);
        if (result.found) {
            const foundLemma = result.entries[0]?.w;
            const isCorrect = foundLemma && foundLemma.toLowerCase() === test.expected.toLowerCase();
            console.log(`  ${test.variant} → ${foundLemma}: ${isCorrect ? '✅' : '⚠️'}`);
            console.log(`    来源: ${result.source}, 方法: ${result.searchMethod}`);
            if (result.lemmas) {
                console.log(`    原型: ${result.lemmas.join(', ')}`);
            }
        } else {
            console.log(`  ${test.variant} → ❌ 未找到`);
        }
    }

    // 4. 测试不存在的词
    console.log('\n4️⃣ 测试不存在的词...');
    const result = await unifiedSearch.search('asdfghjkl');
    console.log(`  asdfghjkl: ${result.found ? '意外找到' : '✅ 正确返回未找到'}`);
    if (result.message) {
        console.log(`    提示: ${result.message}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 测试完成\n');
}

/**
 * 测试单个词
 */
export async function searchWord(word) {
    console.log(`\n🔍 搜索: "${word}"\n`);
    const result = await unifiedSearch.search(word);

    if (result.found) {
        console.log(`✅ 找到 ${result.entries.length} 个结果`);
        console.log(`来源: ${result.source}`);
        console.log(`方法: ${result.searchMethod}`);

        if (result.originalWord && result.lemmas) {
            console.log(`\n📝 词形还原:`);
            console.log(`  输入: ${result.originalWord}`);
            console.log(`  原型: ${result.lemmas.join(', ')}`);
        }

        console.log(`\n词条详情:`);
        result.entries.forEach((entry, idx) => {
            console.log(`\n${idx + 1}. ${entry.w} (${entry.p})`);
            if (entry.a) console.log(`   冠词: ${entry.a}`);
            if (entry.pl) console.log(`   复数: ${entry.pl}`);
            if (entry.e && entry.e.length > 0) console.log(`   英文: ${entry.e.join('; ')}`);
            if (entry.c && entry.c.length > 0) console.log(`   中文: ${entry.c.join('; ')}`);
            if (entry.i) console.log(`   音标: ${entry.i}`);
            if (entry.x && entry.x.length > 0) {
                console.log(`   例句: ${entry.x[0]}`);
                if (entry.xc && entry.xc[0]) {
                    console.log(`         ${entry.xc[0]}`);
                }
            }
        });
    } else {
        console.log(`❌ 未找到结果`);
        if (result.message) {
            console.log(`${result.message}`);
        }
    }

    return result;
}

// 在开发环境自动挂载到 window
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    window.testUnifiedSearch = testUnifiedSearch;
    window.searchWord = searchWord;
    console.log('💡 已挂载测试函数到 window:');
    console.log('  - window.testUnifiedSearch()');
    console.log('  - window.searchWord("Auffahrten")');
}

export default {
    testUnifiedSearch,
    searchWord
};
