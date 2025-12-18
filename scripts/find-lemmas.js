#!/usr/bin/env node
/**
 * 搜索真正的原型词条
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function findLemmas() {
    console.log('🔍 搜索原型词条\n');

    // 搜索所有包含 "auffahrt" 的词条
    console.log('1️⃣ 所有包含 "Auffahrt" 的词条:');
    const { data: allAuffahrt, error } = await supabase
        .from('dictionary')
        .select('id, word, pos, translation, article, plural')
        .ilike('word', '%auffahrt%')
        .limit(20);

    if (error) {
        console.error('错误:', error);
    } else {
        allAuffahrt.forEach(entry => {
            console.log(`  ${entry.word.padEnd(20)} (${entry.pos.padEnd(8)}) - ${entry.translation?.substring(0, 50) || '无翻译'}`);
            if (entry.article) console.log(`    冠词: ${entry.article}，复数: ${entry.plural}`);
        });
    }

    // 搜索所有包含 "haus" 的词条
    console.log('\n2️⃣ 所有包含 "Haus" 的词条:');
    const { data: allHaus } = await supabase
        .from('dictionary')
        .select('id, word, pos, translation, article, plural')
        .ilike('word', '%haus%')
        .limit(20);

    if (allHaus) {
        allHaus.forEach(entry => {
            console.log(`  ${entry.word.padEnd(20)} (${entry.pos.padEnd(8)}) - ${entry.translation?.substring(0, 50) || '无翻译'}`);
            if (entry.article) console.log(`    冠词: ${entry.article}，复数: ${entry.plural}`);
        });
    }

    // 查找特定词性的词条
    console.log('\n3️⃣ 搜索名词 "Auffahrt":');
    const { data: nounAuffahrt } = await supabase
        .from('dictionary')
        .select('*')
        .ilike('word', 'auffahrt')
        .eq('pos', 'noun')
        .limit(5);

    if (nounAuffahrt && nounAuffahrt.length > 0) {
        console.log('✅ 找到名词:', JSON.stringify(nounAuffahrt, null, 2));
    } else {
        console.log('❌ 未找到名词 "Auffahrt"');
    }

    // 查找名词 Haus
    console.log('\n4️⃣ 搜索名词 "Haus":');
    const { data: nounHaus } = await supabase
        .from('dictionary')
        .select('*')
        .ilike('word', 'haus')
        .eq('pos', 'noun')
        .limit(5);

    if (nounHaus && nounHaus.length > 0) {
        console.log('✅ 找到名词:', JSON.stringify(nounHaus, null, 2));

        // 查找该名词的所有变体
        const hausId = nounHaus[0].id;
        const { data: hausVariants } = await supabase
            .from('search_index')
            .select('variant')
            .eq('lemma_id', hausId)
            .limit(50);

        if (hausVariants) {
            console.log('\n   该词的所有变体:');
            console.log('  ', hausVariants.map(v => v.variant).join(', '));
        }
    } else {
        console.log('❌ 未找到名词 "Haus"');
    }
}

findLemmas().catch(console.error);
