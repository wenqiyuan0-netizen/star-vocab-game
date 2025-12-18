#!/usr/bin/env node
/**
 * 验证词形还原功能的数据完整性
 *
 * 使用方法：
 *   node scripts/verify-lemmatization.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ 错误：缺少 Supabase 环境变量');
    console.log('请在 .env 文件中设置：');
    console.log('  REACT_APP_SUPABASE_URL=...');
    console.log('  REACT_APP_SUPABASE_ANON_KEY=...');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTables() {
    console.log('🔍 验证词形还原功能\n');
    console.log('='.repeat(60));

    // 1. 检查 dictionary 表
    console.log('\n1️⃣ 检查 dictionary 表...');
    try {
        const { count: dictCount, error: dictError } = await supabase
            .from('dictionary')
            .select('*', { count: 'exact', head: true });

        if (dictError) {
            console.error('   ❌ 错误:', dictError.message);
        } else {
            console.log(`   ✅ dictionary 表存在，共 ${dictCount?.toLocaleString()} 条记录`);
        }
    } catch (error) {
        console.error('   ❌ 查询失败:', error.message);
    }

    // 2. 检查 search_index 表
    console.log('\n2️⃣ 检查 search_index 表...');
    try {
        const { count: indexCount, error: indexError } = await supabase
            .from('search_index')
            .select('*', { count: 'exact', head: true });

        if (indexError) {
            console.error('   ❌ 错误:', indexError.message);
            console.log('   💡 提示：可能需要运行 supabase_setup.sql 创建表');
        } else {
            console.log(`   ✅ search_index 表存在，共 ${indexCount?.toLocaleString()} 条索引`);
        }
    } catch (error) {
        console.error('   ❌ 查询失败:', error.message);
    }

    // 3. 测试词形还原
    console.log('\n3️⃣ 测试词形还原功能...');
    const testCases = [
        { variant: 'auffahrten', expectedLemma: 'Auffahrt' },
        { variant: 'häuser', expectedLemma: 'Haus' },
        { variant: 'lernten', expectedLemma: 'lernen' },
    ];

    for (const testCase of testCases) {
        try {
            const { data, error } = await supabase
                .from('search_index')
                .select(`
                    variant,
                    lemma_id,
                    dictionary:lemma_id (
                        word,
                        pos,
                        translation_cn
                    )
                `)
                .eq('variant', testCase.variant)
                .limit(5);

            if (error) {
                console.error(`   ❌ ${testCase.variant}: 查询失败 -`, error.message);
            } else if (!data || data.length === 0) {
                console.log(`   ⚠️  ${testCase.variant}: 未找到索引`);
            } else {
                const lemmas = data.map(item => item.dictionary?.word).filter(Boolean);
                const found = lemmas.some(w => w.toLowerCase() === testCase.expectedLemma.toLowerCase());
                console.log(
                    `   ${found ? '✅' : '⚠️'}  ${testCase.variant} → ${lemmas.join(', ')}`,
                    found ? '' : `(期望: ${testCase.expectedLemma})`
                );
            }
        } catch (error) {
            console.error(`   ❌ ${testCase.variant}: 出错 -`, error.message);
        }
    }

    // 4. 测试服务层逻辑 (模拟)
    console.log('\n4️⃣ 测试智能回退逻辑 (Service Layer Simulation)...');
    console.log('   由于数据源将变体作为独立词条，我们实现了"翻译解析"策略：');
    
    for (const testCase of testCases) {
        try {
            // 1. 查找变体词条
            const { data: variants } = await supabase
                .from('dictionary')
                .select('word, translation')
                .ilike('word', testCase.variant)
                .limit(1);

            if (variants && variants.length > 0) {
                const entry = variants[0];
                console.log(`   检查 "${entry.word}" 的翻译: "${entry.translation}"`);
                
                // 模拟 Service 中的正则提取
                const match = entry.translation.match(/(?:plural|singular|inflection|conjugation|participle|gerund|imperative|subjunctive|indicative|past|present|future|form|genitive|dative|accusative|nominative).*? of ([A-ZÄÖÜa-zäöüß]+)/i);
                
                if (match && match[1]) {
                    const extracted = match[1];
                    const isCorrect = extracted.toLowerCase() === testCase.expectedLemma.toLowerCase();
                    console.log(`   ✅ 成功提取原型: ${extracted} ${isCorrect ? '✅' : '❌'}`);
                } else {
                    console.log(`   ⚠️ 未能从翻译中提取原型`);
                }
            } else {
                console.log(`   ⚠️ 未找到变体词条: ${testCase.variant}`);
            }
        } catch (error) {
            console.error(`   ❌ 出错:`, error);
        }
    }

    // 5. 检查示例词条
    console.log('\n5️⃣ 检查示例词条...');
    const sampleWords = ['Haus', 'lernen', 'Auffahrt'];

    for (const word of sampleWords) {
        try {
            const { data, error } = await supabase
                .from('dictionary')
                .select('word, pos, translation_cn')
                .ilike('word', word)
                .limit(3);

            if (error) {
                console.error(`   ❌ ${word}: 查询失败 -`, error.message);
            } else if (!data || data.length === 0) {
                console.log(`   ⚠️  ${word}: 未找到`);
            } else {
                console.log(`   ✅ ${word}: 找到 ${data.length} 个结果`);
                data.forEach(entry => {
                    console.log(`      - ${entry.word} (${entry.pos}): ${entry.translation_cn || '无翻译'}`);
                });
            }
        } catch (error) {
            console.error(`   ❌ ${word}: 测试失败 -`, error.message);
        }
    }

    // 6. 统计信息
    console.log('\n6️⃣ 统计信息...');
    try {
        // 词性分布
        const { data: posData, error: posError } = await supabase
            .from('dictionary')
            .select('pos')
            .limit(1000);

        if (!posError && posData) {
            const posCounts = {};
            posData.forEach(row => {
                posCounts[row.pos] = (posCounts[row.pos] || 0) + 1;
            });

            console.log('   词性分布（前1000条）:');
            Object.entries(posCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .forEach(([pos, count]) => {
                    console.log(`      ${pos}: ${count}`);
                });
        }
    } catch (error) {
        console.error('   ❌ 统计失败:', error.message);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ 验证完成\n');
}

// 运行验证
verifyTables().catch(error => {
    console.error('❌ 验证过程出错:', error);
    process.exit(1);
});
