#!/usr/bin/env node
/**
 * 检查 Goethe 词汇数据
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function checkGoetheData() {
    console.log('🔍 检查 Goethe 词汇数据\n');

    // 检查是否有rank字段（Goethe数据通常有rank）
    console.log('1️⃣ 查找有 rank 的记录（通常是常用词）:');
    const { data: rankedWords, error } = await supabase
        .from('dictionary')
        .select('id, rank, word, pos, translation, translation_cn, article, plural')
        .not('rank', 'is', null)
        .order('rank', { ascending: true })
        .limit(20);

    if (error) {
        console.error('错误:', error);
    } else {
        console.log(`找到 ${rankedWords.length} 条有 rank 的记录:\n`);
        rankedWords.forEach(w => {
            console.log(`  [${w.rank}] ${w.word} (${w.pos})`);
            if (w.article) console.log(`      ${w.article} ${w.word}, 复数: ${w.plural || '无'}`);
            console.log(`      译: ${w.translation_cn || w.translation || '无'}`);
        });
    }

    // 搜索一些常见的基础词
    console.log('\n2️⃣ 搜索常见基础词:');
    const commonWords = ['Haus', 'Buch', 'Mann', 'Frau', 'Kind'];

    for (const word of commonWords) {
        const { data } = await supabase
            .from('dictionary')
            .select('word, pos, article, plural, translation_cn')
            .ilike('word', word)
            .eq('pos', 'noun')
            .limit(1);

        if (data && data.length > 0) {
            const entry = data[0];
            console.log(`  ✅ ${entry.word} (${entry.article || '无冠词'}, pl: ${entry.plural || '无'})`);
        } else {
            console.log(`  ❌ ${word} - 未找到`);
        }
    }

    // 统计不同来源的数据
    console.log('\n3️⃣ 统计数据来源:');

    // 有翻译的（可能来自 Common/Goethe）
    const { count: withTranslation } = await supabase
        .from('dictionary')
        .select('*', { count: 'exact', head: true })
        .not('translation_cn', 'is', null)
        .neq('translation_cn', '');

    // 有冠词的（应该是名词）
    const { count: withArticle } = await supabase
        .from('dictionary')
        .select('*', { count: 'exact', head: true })
        .not('article', 'is', null)
        .neq('article', '');

    // 有 rank 的（常用词）
    const { count: withRank } = await supabase
        .from('dictionary')
        .select('*', { count: 'exact', head: true })
        .not('rank', 'is', null);

    console.log(`  有中文翻译: ${withTranslation?.toLocaleString() || 0}`);
    console.log(`  有冠词: ${withArticle?.toLocaleString() || 0}`);
    console.log(`  有排名: ${withRank?.toLocaleString() || 0}`);
}

checkGoetheData().catch(console.error);
