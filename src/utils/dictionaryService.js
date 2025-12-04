/**
 * 词典查询服务
 * 
 * 负责从JSONL文件中查找单词并返回结构化数据
 * 注意：生产环境应该使用数据库或预建索引，这里提供基础实现
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';

const DICTIONARY_PATH = path.join(process.cwd(), 'public', 'resources', 'kaikki.org-dictionary-German.jsonl');

/**
 * 在JSONL文件中搜索单词
 * @param {string} word - 要查找的单词
 * @param {boolean} exactMatch - 是否精确匹配（默认true）
 * @returns {Promise<Array>} - 找到的所有词条
 */
export async function searchWord(word, exactMatch = true) {
    const results = [];
    const searchWord = word.toLowerCase().trim();

    // 创建逐行读取流（这样不会一次性加载整个文件到内存）
    const fileStream = fs.createReadStream(DICTIONARY_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    try {
        for await (const line of rl) {
            try {
                const entry = JSON.parse(line);
                const entryWord = (entry.word || '').toLowerCase();

                // 匹配逻辑
                const isMatch = exactMatch
                    ? entryWord === searchWord
                    : entryWord.includes(searchWord);

                if (isMatch) {
                    results.push(entry);
                }
            } catch (err) {
                // 跳过无效的JSON行
                console.error('Parse error:', err.message);
            }
        }
    } catch (error) {
        console.error('Error reading dictionary:', error);
        throw error;
    }

    return results;
}

/**
 * 批量查找多个单词
 * @param {Array<string>} words - 单词数组
 * @returns {Promise<Object>} - { word: [entries] } 格式的结果
 */
export async function searchMultipleWords(words) {
    const results = {};
    const wordsSet = new Set(words.map(w => w.toLowerCase().trim()));

    const fileStream = fs.createReadStream(DICTIONARY_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    try {
        for await (const line of rl) {
            try {
                const entry = JSON.parse(line);
                const entryWord = (entry.word || '').toLowerCase();

                if (wordsSet.has(entryWord)) {
                    if (!results[entry.word]) {
                        results[entry.word] = [];
                    }
                    results[entry.word].push(entry);
                }

                // 优化：如果已经找到所有单词，提前退出
                if (Object.keys(results).length === words.length) {
                    break;
                }
            } catch (err) {
                // 跳过无效行
            }
        }
    } catch (error) {
        console.error('Error reading dictionary:', error);
        throw error;
    }

    return results;
}

/**
 * 获取词典统计信息
 * @returns {Promise<Object>} - 统计信息
 */
export async function getDictionaryStats() {
    let totalEntries = 0;
    const posCount = {};
    const uniqueWords = new Set();

    const fileStream = fs.createReadStream(DICTIONARY_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        try {
            const entry = JSON.parse(line);
            totalEntries++;

            // 统计词性
            const pos = entry.pos || 'unknown';
            posCount[pos] = (posCount[pos] || 0) + 1;

            // 统计唯一单词
            if (entry.word) {
                uniqueWords.add(entry.word.toLowerCase());
            }
        } catch (err) {
            // 跳过无效行
        }
    }

    return {
        totalEntries,
        uniqueWords: uniqueWords.size,
        partOfSpeech: posCount,
        fileSize: fs.statSync(DICTIONARY_PATH).size,
        fileSizeMB: (fs.statSync(DICTIONARY_PATH).size / (1024 * 1024)).toFixed(2)
    };
}

/**
 * 建议：构建索引以提高查询速度
 * 这个函数会创建一个索引文件，将单词映射到文件中的行号
 * 
 * @returns {Promise<void>}
 */
export async function buildIndex() {
    console.log('开始构建索引...');
    const index = {}; // { word: [lineNumbers] }
    let lineNumber = 0;

    const fileStream = fs.createReadStream(DICTIONARY_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        lineNumber++;
        try {
            const entry = JSON.parse(line);
            if (entry.word) {
                const word = entry.word.toLowerCase();
                if (!index[word]) {
                    index[word] = [];
                }
                index[word].push({
                    line: lineNumber,
                    pos: entry.pos
                });
            }
        } catch (err) {
            // 跳过无效行
        }

        if (lineNumber % 10000 === 0) {
            console.log(`已处理 ${lineNumber} 行...`);
        }
    }

    // 保存索引
    const indexPath = path.join(process.cwd(), 'public', 'resources', 'dictionary-index.json');
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    console.log('索引构建完成！');
    console.log(`索引文件: ${indexPath}`);
    console.log(`索引了 ${Object.keys(index).length} 个唯一单词`);
}

/**
 * 使用索引快速查找（需要先运行buildIndex）
 * @param {string} word - 要查找的单词
 * @returns {Promise<Array>} - 找到的词条
 */
export async function searchWithIndex(word) {
    const indexPath = path.join(process.cwd(), 'public', 'resources', 'dictionary-index.json');

    // 检查索引文件是否存在
    if (!fs.existsSync(indexPath)) {
        console.log('索引文件不存在，请先运行 buildIndex()');
        return searchWord(word); // 降级到普通搜索
    }

    // 加载索引
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    const wordLower = word.toLowerCase();
    const lineInfo = index[wordLower];

    if (!lineInfo) {
        return []; // 未找到
    }

    // 根据行号读取文件
    const results = [];
    const fileStream = fs.createReadStream(DICTIONARY_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let currentLine = 0;
    const targetLines = new Set(lineInfo.map(info => info.line));

    for await (const line of rl) {
        currentLine++;
        if (targetLines.has(currentLine)) {
            try {
                results.push(JSON.parse(line));
            } catch (err) {
                console.error('Parse error at line', currentLine);
            }

            // 如果已经找到所有目标行，可以提前退出
            if (results.length === lineInfo.length) {
                break;
            }
        }
    }

    return results;
}

// 使用示例
if (import.meta.url === `file://${process.argv[1]}`) {
    // 如果直接运行此文件
    const command = process.argv[2];

    if (command === 'search') {
        const word = process.argv[3];
        if (!word) {
            console.log('使用方法: node dictionaryService.js search <单词>');
            process.exit(1);
        }

        console.log(`正在查找: ${word}...`);
        searchWord(word).then(results => {
            console.log(`找到 ${results.length} 个词条`);
            results.forEach((entry, i) => {
                console.log(`\n--- 词条 ${i + 1} ---`);
                console.log('单词:', entry.word);
                console.log('词性:', entry.pos);
                console.log('释义:', entry.senses?.[0]?.glosses?.[0] || '无');
            });
        });
    } else if (command === 'stats') {
        console.log('正在统计词典信息...');
        getDictionaryStats().then(stats => {
            console.log('\n=== 词典统计 ===');
            console.log('总词条数:', stats.totalEntries);
            console.log('唯一单词数:', stats.uniqueWords);
            console.log('文件大小:', stats.fileSizeMB, 'MB');
            console.log('\n词性分布:');
            Object.entries(stats.partOfSpeech)
                .sort((a, b) => b[1] - a[1])
                .forEach(([pos, count]) => {
                    console.log(`  ${pos}: ${count}`);
                });
        });
    } else if (command === 'build-index') {
        buildIndex();
    } else {
        console.log(`
使用方法:
  node dictionaryService.js search <单词>   - 查找单词
  node dictionaryService.js stats          - 显示统计信息
  node dictionaryService.js build-index    - 构建索引（推荐）
    `);
    }
}
