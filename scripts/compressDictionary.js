/**
 * 压缩本地词典为云端格式
 * 
 * 将 kaikki.org-dictionary-German.jsonl (975MB)
 * 压缩为 cloud-dictionary.json (~50-100MB)
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 文件路径
const INPUT_FILE = path.join(__dirname, '../public/resources/kaikki.org-dictionary-German.jsonl');
const OUTPUT_FILE = path.join(__dirname, '../public/resources/cloud-dictionary.json');

/**
 * 压缩单个词条
 */
function compressEntry(fullEntry) {
    if (!fullEntry || !fullEntry.word) {
        return null;
    }

    const compressed = {
        w: fullEntry.word,
        p: fullEntry.pos || 'unknown'
    };

    // 提取英文释义（最多5个）
    if (fullEntry.senses && fullEntry.senses.length > 0) {
        compressed.e = fullEntry.senses
            .slice(0, 5)
            .map(sense => sense.glosses?.[0])
            .filter(Boolean);
    }

    // 提取例句（最多2个）
    if (fullEntry.senses) {
        const examples = [];
        for (const sense of fullEntry.senses) {
            if (sense.examples && sense.examples.length > 0) {
                examples.push(...sense.examples.slice(0, 2).map(ex => ex.text));
                if (examples.length >= 2) break;
            }
        }
        if (examples.length > 0) {
            compressed.x = examples.slice(0, 2);
        }
    }

    // 提取发音
    if (fullEntry.sounds && fullEntry.sounds.length > 0) {
        compressed.i = fullEntry.sounds[0].ipa;
    }

    // 提取同义词（最多3个）
    if (fullEntry.synonyms && fullEntry.synonyms.length > 0) {
        compressed.s = fullEntry.synonyms
            .slice(0, 3)
            .map(syn => syn.word)
            .filter(Boolean);
    }

    // 版本号
    compressed.v = 1;

    return compressed;
}

/**
 * 主压缩函数
 */
async function compressDictionary() {
    console.log('🚀 开始压缩词典...\n');

    // 检查输入文件
    if (!fs.existsSync(INPUT_FILE)) {
        console.error('❌ 错误: 找不到输入文件');
        console.error(`   路径: ${INPUT_FILE}`);
        return;
    }

    const inputStats = fs.statSync(INPUT_FILE);
    console.log(`📖 输入文件: ${path.basename(INPUT_FILE)}`);
    console.log(`   大小: ${(inputStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log();

    // 创建读取流
    const fileStream = fs.createReadStream(INPUT_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const compressed = {};
    let totalLines = 0;
    let validEntries = 0;
    let skippedEntries = 0;

    const startTime = Date.now();

    // 逐行处理
    for await (const line of rl) {
        totalLines++;

        try {
            const fullEntry = JSON.parse(line);
            const compressedEntry = compressEntry(fullEntry);

            if (compressedEntry) {
                // 使用 word+pos 作为唯一键
                const key = `${compressedEntry.w}__${compressedEntry.p}`;
                compressed[key] = compressedEntry;
                validEntries++;
            } else {
                skippedEntries++;
            }

            // 每1万行显示进度
            if (totalLines % 10000 === 0) {
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                console.log(`⏳ 已处理 ${totalLines.toLocaleString()} 行 (${elapsed}秒)`);
            }
        } catch (error) {
            skippedEntries++;
            // 跳过无效JSON行
        }
    }

    console.log('\n✅ 读取完成！');
    console.log(`   总行数: ${totalLines.toLocaleString()}`);
    console.log(`   有效词条: ${validEntries.toLocaleString()}`);
    console.log(`   跳过: ${skippedEntries.toLocaleString()}`);

    // 转换为数组格式（更节省空间）
    console.log('\n📦 转换为数组格式...');
    const compressedArray = Object.values(compressed);

    // 写入输出文件
    console.log('\n💾 写入压缩文件...');
    const outputData = {
        version: 1,
        generatedAt: new Date().toISOString(),
        totalEntries: compressedArray.length,
        entries: compressedArray
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputData, null, 2));

    const outputStats = fs.statSync(OUTPUT_FILE);
    const compressionRatio = ((1 - outputStats.size / inputStats.size) * 100).toFixed(2);

    console.log('\n🎉 压缩完成！\n');
    console.log('📊 统计信息:');
    console.log(`   输入大小: ${(inputStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   输出大小: ${(outputStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   压缩率: ${compressionRatio}%`);
    console.log(`   输出路径: ${OUTPUT_FILE}`);

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️  总耗时: ${totalTime}秒`);
}

// 运行
compressDictionary().catch(error => {
    console.error('❌ 压缩失败:', error);
    process.exit(1);
});
