/**
 * 本地词形还原功能测试
 *
 * 在浏览器控制台使用：
 *   window.testLocalLemma()
 *   window.searchWithLemma('lernten')
 *   window.showInflections('lernen')
 */

import { unifiedSearch } from './unifiedDictionarySearch';
import { localLemmatization } from './localLemmatization';

/**
 * 完整功能测试
 */
export async function testLocalLemma() {
    console.log('🧪 测试本地词形还原功能\n');
    console.log('='.repeat(60));

    // 1. 测试基础词（精确匹配）
    console.log('\n1️⃣ 测试基础词（精确匹配）...');
    const basicWords = ['Haus', 'lernen', 'und'];

    for (const word of basicWords) {
        const result = await unifiedSearch.search(word);
        console.log(`  ${word}: ${result.found ? '✅' : '❌'}`);
        console.log(`    来源: ${result.source}, 方法: ${result.searchMethod}`);
        if (result.found && result.entries[0]) {
            const entry = result.entries[0];
            console.log(`    译: ${entry.c?.[0] || entry.e?.[0] || '无'}`);
        }
    }

    // 2. 测试名词复数
    console.log('\n2️⃣ 测试名词复数还原...');
    const plurals = [
        { variant: 'Häuser', expected: 'Haus' },
        { variant: 'Bücher', expected: 'Buch' },
        { variant: 'Kinder', expected: 'Kind' }
    ];

    for (const test of plurals) {
        const result = await unifiedSearch.search(test.variant);
        if (result.found) {
            const lemma = result.lemmas?.[0] || result.entries[0]?.w;
            const isCorrect = lemma?.toLowerCase() === test.expected.toLowerCase();
            console.log(`  ${test.variant} → ${lemma}: ${isCorrect ? '✅' : '⚠️'}`);
            console.log(`    方法: ${result.searchMethod}, 来源: ${result.source}`);
        } else {
            console.log(`  ${test.variant} → ❌ 未找到`);
        }
    }

    // 3. 测试动词变位
    console.log('\n3️⃣ 测试动词变位还原...');
    const verbs = [
        { variant: 'lernten', expected: 'lernen' },
        { variant: 'lernt', expected: 'lernen' },
        { variant: 'gingen', expected: 'gehen' },
        { variant: 'ging', expected: 'gehen' }
    ];

    for (const test of verbs) {
        const result = await unifiedSearch.search(test.variant);
        if (result.found) {
            const lemma = result.lemmas?.[0] || result.entries[0]?.w;
            const isCorrect = lemma?.toLowerCase() === test.expected.toLowerCase();
            console.log(`  ${test.variant} → ${lemma}: ${isCorrect ? '✅' : '⚠️'}`);
            console.log(`    方法: ${result.searchMethod}, 来源: ${result.source}`);
        } else {
            console.log(`  ${test.variant} → ❌ 未找到`);
        }
    }

    // 4. 测试变位表查询
    console.log('\n4️⃣ 测试变位表查询...');
    const testWords = ['lernen', 'sein', 'haben'];

    for (const word of testWords) {
        const forms = await localLemmatization.getWordForms(word);
        if (forms) {
            console.log(`  ${word}: ✅ ${forms.length || 0} 个变位条目`);
            if (forms.length > 0) {
                const sample = forms.slice(0, 5).map(f => f.form).join(', ');
                console.log(`    示例: ${sample}...`);
            }
        } else {
            console.log(`  ${word}: ❌ 未找到变位表`);
        }
    }

    // 5. 性能测试
    console.log('\n5️⃣ 性能测试...');
    const perfTestWords = ['lernten', 'Häuser', 'ging', 'war'];
    const startTime = performance.now();

    for (const word of perfTestWords) {
        await localLemmatization.findLemma(word);
    }

    const endTime = performance.now();
    const avgTime = ((endTime - startTime) / perfTestWords.length).toFixed(2);
    console.log(`  平均查询时间: ${avgTime}ms`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ 测试完成\n');
}

/**
 * 搜索单个词（带详细信息）
 */
export async function searchWithLemma(word) {
    console.log(`\n🔍 搜索: "${word}"\n`);

    // 1. 检查是否为变位
    const isInflected = await localLemmatization.isInflected(word);
    console.log(`📝 变位检查: ${isInflected ? '是变位形式' : '是原型或未知'}`);

    // 2. 查找原型
    const lemma = await localLemmatization.findLemma(word);
    if (lemma !== word.toLowerCase()) {
        console.log(`🔄 原型: ${lemma}`);
    }

    // 3. 统一搜索
    const result = await unifiedSearch.search(word);

    if (result.found) {
        console.log(`\n✅ 找到 ${result.entries.length} 个结果`);
        console.log(`📍 来源: ${result.source}`);
        console.log(`🔧 方法: ${result.searchMethod}`);

        if (result.lemmas && result.lemmas.length > 0) {
            console.log(`📚 原型: ${result.lemmas.join(', ')}`);
        }

        console.log(`\n词条详情:`);
        result.entries.forEach((entry, idx) => {
            console.log(`\n${idx + 1}. ${entry.w} (${entry.p})`);
            if (entry.a) console.log(`   冠词: ${entry.a}`);
            if (entry.pl) console.log(`   复数: ${entry.pl}`);
            if (entry.c && entry.c.length > 0) console.log(`   中文: ${entry.c.join('; ')}`);
            if (entry.e && entry.e.length > 0) console.log(`   英文: ${entry.e[0]}`);
        });
    } else {
        console.log(`\n❌ 未找到结果`);
        if (result.message) {
            console.log(result.message);
        }
    }

    return result;
}

/**
 * 显示变位表
 */
export async function showInflections(word) {
    console.log(`\n📋 ${word} 的变位表\n`);

    const forms = await localLemmatization.getWordForms(word);

    if (!forms) {
        console.log('❌ 未找到变位信息');
        return null;
    }

    console.log(`变位条目数: ${forms.length || 0}\n`);

    if (forms && forms.length > 0) {
        console.log('详细变位信息 (前 20 个):');
        forms.slice(0, 20).forEach((form, idx) => {
            console.log(`${idx + 1}. ${form.form}`);
            if (form.tags && form.tags.length > 0) {
                console.log(`   标签: ${form.tags.join(', ')}`);
            }
        });
    }

    return forms;
}

/**
 * 快速测试
 */
export async function quickTest() {
    console.log('⚡ 快速测试\n');

    const tests = [
        { word: 'lernten', type: '动词变位' },
        { word: 'Häuser', type: '名词复数' },
        { word: 'Haus', type: '名词原型' }
    ];

    for (const test of tests) {
        const result = await unifiedSearch.search(test.word);
        console.log(
            `${result.found ? '✅' : '❌'} ${test.word} (${test.type}): ${
                result.found ? result.searchMethod : '未找到'
            }`
        );
    }
}

// 在开发环境自动挂载到 window
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    window.testLocalLemma = testLocalLemma;
    window.searchWithLemma = searchWithLemma;
    window.showInflections = showInflections;
    window.quickTest = quickTest;

    console.log('💡 已挂载本地词形还原测试函数:');
    console.log('  - window.testLocalLemma()        // 完整测试');
    console.log('  - window.searchWithLemma("lernten")  // 搜索单词');
    console.log('  - window.showInflections("lernen")   // 显示变位表');
    console.log('  - window.quickTest()             // 快速测试');
}

export default {
    testLocalLemma,
    searchWithLemma,
    showInflections,
    quickTest
};
