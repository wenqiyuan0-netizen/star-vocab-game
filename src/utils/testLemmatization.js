/**
 * 词形还原功能测试
 *
 * 使用方法：
 * 1. 在浏览器控制台中导入：
 *    import { testLemmatization } from './utils/testLemmatization'
 * 2. 运行测试：
 *    testLemmatization('Auffahrten')
 */

import { lemmatizationService } from './lemmatizationService';
import { cloudDict } from './cloudDictionaryStorage';

/**
 * 测试词形还原服务
 * @param {string} word - 要测试的词
 */
export async function testLemmatization(word = 'Auffahrten') {
    console.group(`🔍 测试词形还原: ${word}`);

    try {
        // 1. 检查服务是否可用
        console.log('1️⃣ 检查服务状态...');
        const isAvailable = await lemmatizationService.isAvailable();
        console.log(`   search_index 表可用: ${isAvailable ? '✅' : '❌'}`);

        if (!isAvailable) {
            console.warn('⚠️ search_index 表不可用，请确认已导入数据');
            console.groupEnd();
            return;
        }

        // 2. 测试直接查询词形还原服务
        console.log('\n2️⃣ 测试词形还原服务...');
        const lemmaResults = await lemmatizationService.findLemma(word);
        console.log(`   找到 ${lemmaResults.length} 个结果:`);
        lemmaResults.forEach((entry, idx) => {
            console.log(`   ${idx + 1}. ${entry.word} (${entry.pos})`);
            console.log(`      翻译: ${entry.translation_cn || entry.translation}`);
            if (entry.article) console.log(`      冠词: ${entry.article}`);
            if (entry.plural) console.log(`      复数: ${entry.plural}`);
        });

        // 3. 测试云端词典集成
        console.log('\n3️⃣ 测试云端词典集成...');
        const cloudResults = await cloudDict.get(word);
        console.log(`   找到 ${cloudResults.length} 个结果:`);
        cloudResults.forEach((entry, idx) => {
            console.log(`   ${idx + 1}. ${entry.word} (${entry.pos})`);
        });

        // 4. 测试批量查询
        console.log('\n4️⃣ 测试批量查询...');
        const testWords = [word, 'Häuser', 'lernten'];
        const batchResults = await lemmatizationService.findLemmaBatch(testWords);
        console.log(`   批量查询结果:`);
        Object.entries(batchResults).forEach(([variant, entries]) => {
            console.log(`   ${variant}: ${entries.length} 个结果`);
            entries.forEach(entry => {
                console.log(`      → ${entry.word} (${entry.pos})`);
            });
        });

        console.log('\n✅ 测试完成');
    } catch (error) {
        console.error('❌ 测试失败:', error);
    }

    console.groupEnd();
}

/**
 * 快速测试多个词
 */
export async function testMultipleWords() {
    const testCases = [
        { word: 'Auffahrten', expected: 'Auffahrt' },
        { word: 'Häuser', expected: 'Haus' },
        { word: 'lernten', expected: 'lernen' },
        { word: 'gegangen', expected: 'gehen' },
        { word: 'Bücher', expected: 'Buch' }
    ];

    console.group('🧪 批量测试词形还原');

    for (const testCase of testCases) {
        const results = await lemmatizationService.findLemma(testCase.word);
        const found = results.some(r => r.word.toLowerCase() === testCase.expected.toLowerCase());

        console.log(
            `${found ? '✅' : '❌'} ${testCase.word} → ${testCase.expected}`,
            found ? '' : `(找到: ${results.map(r => r.word).join(', ') || '无'})`
        );
    }

    console.groupEnd();
}

/**
 * 在控制台中显示使用说明
 */
export function showUsage() {
    console.log(`
========================================
📖 词形还原功能使用指南
========================================

1. 测试单个词：
   testLemmatization('Auffahrten')

2. 批量测试：
   testMultipleWords()

3. 直接使用服务：
   import { lemmatizationService } from './utils/lemmatizationService'
   const results = await lemmatizationService.findLemma('Auffahrten')

4. 通过云端词典查询（自动词形还原）：
   import { cloudDict } from './utils/cloudDictionaryStorage'
   const results = await cloudDict.get('Auffahrten')

========================================
    `);
}

// 如果在开发环境，自动挂载到 window
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    window.testLemmatization = testLemmatization;
    window.testMultipleWords = testMultipleWords;
    window.showLemmatizationUsage = showUsage;
}

export default {
    testLemmatization,
    testMultipleWords,
    showUsage
};
