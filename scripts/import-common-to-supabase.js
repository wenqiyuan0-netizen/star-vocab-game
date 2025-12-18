#!/usr/bin/env node
/**
 * 将 Common 词汇导入到 Supabase
 *
 * 使用方法：
 *   node scripts/import-common-to-supabase.js
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 错误：缺少 Supabase 环境变量');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 生成稳定 ID（与 ETL 脚本一致）
function generateStableId(word, pos) {
    const signature = `${word}:${pos}`.toLowerCase();
    let hash = 0;

    for (let i = 0; i < signature.length; i++) {
        const char = signature.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash);
}

async function importCommonVocab() {
    console.log('📚 导入 Common 词汇到 Supabase\n');
    console.log('='.repeat(60));

    // 1. 读取 Common 词汇文件
    console.log('\n1️⃣ 读取 Common 词汇文件...');
    const commonPath = path.join(__dirname, '../src/shared/services/dictionary/dict/Common_Vocab_local.json');

    if (!fs.existsSync(commonPath)) {
        console.error('❌ 文件不存在:', commonPath);
        process.exit(1);
    }

    const commonData = JSON.parse(fs.readFileSync(commonPath, 'utf-8'));
    console.log(`✅ 读取完成: ${commonData.length.toLocaleString()} 条记录`);

    // 2. 转换数据格式
    console.log('\n2️⃣ 转换数据格式...');
    const records = [];
    const seenIds = new Set();

    for (const entry of commonData) {
        const id = generateStableId(entry.word, entry.pos);

        // 去重
        if (seenIds.has(id)) {
            continue;
        }
        seenIds.add(id);

        records.push({
            id: id,
            rank: entry.rank || null,
            word: entry.word,
            pos: entry.pos || 'unknown',
            translation: entry.translation || '',
            article: entry.article || '',
            plural: entry.plural || '',
            audio: entry.audio || '',
            ipa: entry.ipa || '',
            freq: entry.freq || null,
            translation_cn: entry.translation_cn || '',
            example_de: entry.example_de || '',
            example_cn: entry.example_cn || ''
        });
    }

    console.log(`✅ 转换完成: ${records.length.toLocaleString()} 条记录（去重后）`);

    // 3. 批量导入
    console.log('\n3️⃣ 批量导入到 Supabase...');
    const BATCH_SIZE = 1000;
    let imported = 0;
    let errors = 0;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);

        try {
            const { data, error } = await supabase
                .from('dictionary')
                .upsert(batch, {
                    onConflict: 'id',
                    ignoreDuplicates: false
                });

            if (error) {
                console.error(`❌ 批次 ${Math.floor(i / BATCH_SIZE) + 1} 失败:`, error.message);
                errors += batch.length;
            } else {
                imported += batch.length;
                const progress = ((imported / records.length) * 100).toFixed(1);
                process.stdout.write(`\r   进度: ${imported.toLocaleString()} / ${records.length.toLocaleString()} (${progress}%)`);
            }

            // 避免触发速率限制
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`\n❌ 批次 ${Math.floor(i / BATCH_SIZE) + 1} 异常:`, error.message);
            errors += batch.length;
        }
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ 导入完成');
    console.log(`   成功: ${imported.toLocaleString()}`);
    console.log(`   失败: ${errors.toLocaleString()}`);

    // 4. 验证导入结果
    console.log('\n4️⃣ 验证导入结果...');

    const testWords = ['Haus', 'und', 'in', 'Auffahrt'];
    for (const word of testWords) {
        const { data, error } = await supabase
            .from('dictionary')
            .select('word, pos, translation_cn')
            .ilike('word', word)
            .limit(1);

        if (error) {
            console.log(`   ❌ ${word}: 查询失败`);
        } else if (!data || data.length === 0) {
            console.log(`   ❌ ${word}: 未找到`);
        } else {
            console.log(`   ✅ ${data[0].word} (${data[0].pos}): ${data[0].translation_cn || '无翻译'}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 全部完成！\n');
}

// 运行导入
importCommonVocab().catch(error => {
    console.error('\n❌ 导入失败:', error);
    process.exit(1);
});
