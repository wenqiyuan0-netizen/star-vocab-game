#!/usr/bin/env node
/**
 * 从 Kaikki 数据中提取词形变化信息
 *
 * 输入：kaikki.org-dictionary-German.jsonl
 * 输出：
 *   1. lemma_index.json - 变位 → 原型映射（用于搜索）
 *   2. word_forms.json - 原型 → 所有变位详情（用于显示变位表）
 *
 * 使用方法：
 *   node scripts/extract-word-forms.js
 */

import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置
const KAIKKI_PATH = 'C:\\Users\\Lenovo\\Downloads\\goethe-pdf-vocab-extractor\\kaikki.org-dictionary-German.jsonl';
const OUTPUT_DIR = path.join(__dirname, '../public/dict');
const LEMMA_INDEX_PATH = path.join(OUTPUT_DIR, 'lemma_index.json');
const WORD_FORMS_PATH = path.join(OUTPUT_DIR, 'word_forms.json');

// 加载 Common 词汇列表（只处理这些词的变位）
const COMMON_WORDS_PATH = path.join(OUTPUT_DIR, 'common_2500.json');

// 数据结构
const lemmaIndex = {}; // { "lernten": "lernen", "lernt": "lernen", ... }
const wordForms = {};  // { "lernen": { forms: [...], inflectionTable: {...} } }
const commonWords = new Set(); // Common 词汇集合

/**
 * 加载 Common 词汇列表
 */
async function loadCommonWords() {
    console.log('📚 加载 Common 词汇列表...');
    try {
        const data = JSON.parse(fs.readFileSync(COMMON_WORDS_PATH, 'utf-8'));
        data.forEach(entry => {
            if (entry.word) {
                commonWords.add(entry.word.toLowerCase());
            }
        });
        console.log(`✅ 已加载 ${commonWords.size.toLocaleString()} 个 Common 词汇`);
    } catch (error) {
        console.error('❌ 加载 Common 词汇失败:', error.message);
        process.exit(1);
    }
}

/**
 * 解析 Kaikki 条目，提取变位信息
 */
function parseKaikkiEntry(line) {
    try {
        const entry = JSON.parse(line);

        // 只处理德语词条
        if (entry.lang_code !== 'de' && entry.lang !== 'German') {
            return null;
        }

        const word = entry.word;
        if (!word) return null;

        // 提取原型（lemma）
        let lemma = word;
        const forms = []; // 变位形式列表

        // 1. 检查是否有 head_templates（原型信息）
        if (entry.head_templates && entry.head_templates.length > 0) {
            const headTemplate = entry.head_templates[0];
            if (headTemplate.args && headTemplate.args['1']) {
                lemma = headTemplate.args['1'];
            }
        }

        // 2. 提取词性
        const pos = entry.pos || 'unknown';

        // 3. 提取所有变位形式
        if (entry.forms && Array.isArray(entry.forms)) {
            entry.forms.forEach(form => {
                if (form.form && form.form !== word) {
                    forms.push({
                        form: form.form,
                        tags: form.tags || [],
                        source: form.source || ''
                    });
                }
            });
        }

        // 4. 检查是否是另一个词的变位形式
        if (entry.head_templates && entry.head_templates.length > 0) {
            const template = entry.head_templates[0];
            // 动词变位
            if (template.name && template.name.includes('head') && template.args) {
                // 从 args 中提取原型
                for (const key in template.args) {
                    const value = template.args[key];
                    if (typeof value === 'string' && value !== word && value.length > 0) {
                        // 可能是原型
                        if (key === 'head' || key === '1') {
                            lemma = value;
                            break;
                        }
                    }
                }
            }
        }

        // 5. 从 etymology_text 或 senses 中提取变位信息
        if (entry.senses && Array.isArray(entry.senses)) {
            entry.senses.forEach(sense => {
                if (sense.form_of && Array.isArray(sense.form_of)) {
                    sense.form_of.forEach(formOf => {
                        if (formOf.word && formOf.word !== word) {
                            lemma = formOf.word;
                        }
                    });
                }

                // 从 glosses 中提取（如 "plural of Haus"）
                if (sense.glosses && Array.isArray(sense.glosses)) {
                    sense.glosses.forEach(gloss => {
                        const match = gloss.match(/(?:plural|inflection|form|conjugation|declension) of (.+)/i);
                        if (match && match[1]) {
                            lemma = match[1].trim();
                        }
                    });
                }
            });
        }

        return {
            word,
            lemma: lemma.toLowerCase(),
            pos,
            forms,
            rawEntry: entry
        };

    } catch (error) {
        return null;
    }
}

/**
 * 处理 Kaikki 文件
 */
async function processKaikki() {
    console.log('\n📖 处理 Kaikki 数据...');
    console.log(`文件: ${KAIKKI_PATH}\n`);

    if (!fs.existsSync(KAIKKI_PATH)) {
        console.error('❌ 文件不存在:', KAIKKI_PATH);
        process.exit(1);
    }

    const fileStream = fs.createReadStream(KAIKKI_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let lineCount = 0;
    let processedCount = 0;
    let variantCount = 0;

    for await (const line of rl) {
        lineCount++;

        if (lineCount % 100000 === 0) {
            process.stdout.write(`\r处理中: ${lineCount.toLocaleString()} 行, ${variantCount.toLocaleString()} 个变位...`);
        }

        const parsed = parseKaikkiEntry(line);
        if (!parsed) continue;

        const { word, lemma, pos, forms } = parsed;
        const wordLower = word.toLowerCase();
        const lemmaLower = lemma.toLowerCase();

        // 只处理 Common 词汇及其变位
        const isCommonLemma = commonWords.has(lemmaLower);
        const isCommonWord = commonWords.has(wordLower);

        if (!isCommonLemma && !isCommonWord) {
            continue;
        }

        processedCount++;

        // 如果当前词是变位形式（不等于原型）
        if (wordLower !== lemmaLower) {
            // 添加到 lemmaIndex
            if (!lemmaIndex[wordLower]) {
                lemmaIndex[wordLower] = lemmaLower;
                variantCount++;
            }
        }

        // 初始化 wordForms
        if (!wordForms[lemmaLower]) {
            wordForms[lemmaLower] = {
                lemma: lemma,
                pos: pos,
                variants: new Set(),
                forms: []
            };
        }

        // 添加当前词作为变体
        if (wordLower !== lemmaLower) {
            wordForms[lemmaLower].variants.add(wordLower);
        }

        // 添加所有变位形式
        forms.forEach(form => {
            const formLower = form.form.toLowerCase();
            if (formLower !== lemmaLower) {
                wordForms[lemmaLower].variants.add(formLower);

                // 添加到索引
                if (!lemmaIndex[formLower]) {
                    lemmaIndex[formLower] = lemmaLower;
                    variantCount++;
                }

                // 添加详情
                wordForms[lemmaLower].forms.push({
                    form: form.form,
                    tags: form.tags
                });
            }
        });
    }

    console.log(`\n\n✅ 处理完成`);
    console.log(`   总行数: ${lineCount.toLocaleString()}`);
    console.log(`   Common 词条: ${processedCount.toLocaleString()}`);
    console.log(`   变位总数: ${variantCount.toLocaleString()}`);
}

/**
 * 保存结果
 */
function saveResults() {
    console.log('\n💾 保存结果...');

    // 确保输出目录存在
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 1. 保存 lemmaIndex（变位 → 原型）
    console.log(`\n1️⃣ 保存变位索引: ${LEMMA_INDEX_PATH}`);
    fs.writeFileSync(LEMMA_INDEX_PATH, JSON.stringify(lemmaIndex, null, 2));
    console.log(`   ✅ ${Object.keys(lemmaIndex).length.toLocaleString()} 个映射`);

    // 2. 保存 wordForms（原型 → 变位详情）
    console.log(`\n2️⃣ 保存变位详情: ${WORD_FORMS_PATH}`);

    // 转换 Set 为 Array
    const wordFormsArray = {};
    Object.keys(wordForms).forEach(lemma => {
        const data = wordForms[lemma];
        wordFormsArray[lemma] = {
            lemma: data.lemma,
            pos: data.pos,
            variants: Array.from(data.variants).sort(),
            forms: data.forms
        };
    });

    fs.writeFileSync(WORD_FORMS_PATH, JSON.stringify(wordFormsArray, null, 2));
    console.log(`   ✅ ${Object.keys(wordFormsArray).length.toLocaleString()} 个词条`);

    // 3. 统计信息
    console.log('\n📊 统计信息:');
    const stats = {
        totalLemmas: Object.keys(wordFormsArray).length,
        totalVariants: Object.keys(lemmaIndex).length,
        avgVariantsPerLemma: 0,
        maxVariants: 0,
        maxVariantsWord: ''
    };

    let totalVariants = 0;
    Object.entries(wordFormsArray).forEach(([lemma, data]) => {
        const count = data.variants.length;
        totalVariants += count;
        if (count > stats.maxVariants) {
            stats.maxVariants = count;
            stats.maxVariantsWord = lemma;
        }
    });

    stats.avgVariantsPerLemma = (totalVariants / stats.totalLemmas).toFixed(2);

    console.log(`   原型总数: ${stats.totalLemmas.toLocaleString()}`);
    console.log(`   变位总数: ${stats.totalVariants.toLocaleString()}`);
    console.log(`   平均变位数: ${stats.avgVariantsPerLemma}`);
    console.log(`   最多变位: ${stats.maxVariantsWord} (${stats.maxVariants} 个)`);
}

/**
 * 主函数
 */
async function main() {
    console.log('🚀 从 Kaikki 提取词形变化数据');
    console.log('='.repeat(60));

    try {
        await loadCommonWords();
        await processKaikki();
        saveResults();

        console.log('\n' + '='.repeat(60));
        console.log('✅ 全部完成！\n');
        console.log('生成的文件:');
        console.log(`  - ${LEMMA_INDEX_PATH}`);
        console.log(`  - ${WORD_FORMS_PATH}\n`);

    } catch (error) {
        console.error('\n❌ 错误:', error);
        process.exit(1);
    }
}

// 运行
main();
