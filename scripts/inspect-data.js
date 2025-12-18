#!/usr/bin/env node
/**
 * 检查 Supabase 数据的实际结构
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
);

async function inspectData() {
    console.log('🔎 检查数据结构\n');

    // 1. 查看 search_index 表的实际数据
    console.log('1️⃣ search_index 表示例（auffahrten）:');
    const { data: indexData, error: indexError } = await supabase
        .from('search_index')
        .select('*')
        .eq('variant', 'auffahrten')
        .limit(5);

    if (indexError) {
        console.error('错误:', indexError);
    } else {
        console.log(JSON.stringify(indexData, null, 2));
    }

    // 2. 查看对应的 dictionary 记录
    if (indexData && indexData.length > 0) {
        console.log('\n2️⃣ 对应的 dictionary 记录:');
        const lemmaIds = indexData.map(item => item.lemma_id);

        const { data: dictData, error: dictError } = await supabase
            .from('dictionary')
            .select('*')
            .in('id', lemmaIds)
            .limit(5);

        if (dictError) {
            console.error('错误:', dictError);
        } else {
            console.log(JSON.stringify(dictData, null, 2));
        }
    }

    // 3. 直接搜索 Auffahrt
    console.log('\n3️⃣ 搜索 "Auffahrt" (不区分大小写):');
    const { data: auffahrtData, error: auffahrtError } = await supabase
        .from('dictionary')
        .select('*')
        .ilike('word', 'Auffahrt')
        .limit(3);

    if (auffahrtError) {
        console.error('错误:', auffahrtError);
    } else {
        console.log(JSON.stringify(auffahrtData, null, 2));
    }

    // 4. 检查 Haus 的所有变体
    console.log('\n4️⃣ 查找 "Haus" 在 dictionary 中:');
    const { data: hausDict, error: hausError } = await supabase
        .from('dictionary')
        .select('id, word, pos, translation_cn')
        .ilike('word', 'Haus')
        .limit(5);

    if (!hausError && hausDict) {
        console.log(JSON.stringify(hausDict, null, 2));

        // 查找指向 Haus 的所有变体
        if (hausDict.length > 0) {
            console.log('\n5️⃣ "Haus" 的所有词形变化:');
            const hausId = hausDict[0].id;

            const { data: hausVariants, error: varError } = await supabase
                .from('search_index')
                .select('variant')
                .eq('lemma_id', hausId)
                .limit(20);

            if (!varError && hausVariants) {
                console.log('变体:', hausVariants.map(v => v.variant).join(', '));
            }
        }
    }
}

inspectData().catch(console.error);
