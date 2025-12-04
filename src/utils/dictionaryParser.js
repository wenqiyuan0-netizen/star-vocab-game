/**
 * Kaikki.org 德语词典解析工具
 * 
 * 用于从JSONL格式的德语词典中提取关键信息
 */

/**
 * 从完整的词条中提取用于AI翻译的核心信息
 * @param {Object} entry - 完整的词典词条
 * @returns {Object} - 提取的核心信息
 */
export function extractKeyInfo(entry) {
    if (!entry) return null;

    return {
        // 基本信息
        word: entry.word,
        pos: entry.pos || 'unknown', // 词性: noun, verb, adj, adv等

        // 释义（英文）
        definitions: entry.senses?.map(sense => ({
            gloss: sense.glosses?.[0] || '',
            // 提取标签（如果有）
            tags: sense.tags || [],
            // 例句（最多2个）
            examples: sense.examples?.slice(0, 2)?.map(ex => ({
                text: ex.text,
                translation: ex.english || ex.translation
            })) || []
        })) || [],

        // 发音
        pronunciation: {
            ipa: entry.sounds?.[0]?.ipa,
            audioUrl: entry.sounds?.[0]?.mp3_url || entry.sounds?.[0]?.ogg_url
        },

        // 词形变化（仅提取最重要的几个）
        forms: entry.forms?.slice(0, 5)?.map(form => ({
            form: form.form,
            tags: form.tags
        })) || [],

        // 词源（缩短版）
        etymology: entry.etymology_text?.substring(0, 200),

        // 同义词
        synonyms: entry.synonyms?.slice(0, 5)?.map(s => s.word) || [],

        // 反义词
        antonyms: entry.antonyms?.slice(0, 5)?.map(s => s.word) || [],

        // 派生词
        derived: entry.derived?.slice(0, 5)?.map(d => d.word) || [],

        // 相关词
        related: entry.related?.slice(0, 5)?.map(r => r.word) || []
    };
}

/**
 * 生成用于AI翻译的提示词
 * @param {Object} wordInfo - 提取的核心信息
 * @returns {string} - AI提示词
 */
export function generateAIPrompt(wordInfo) {
    if (!wordInfo) return '';

    let prompt = `请将以下德语单词翻译成中文，并提供详细的学习信息：

**单词**: ${wordInfo.word}
**词性**: ${translatePOS(wordInfo.pos)}
**发音**: ${wordInfo.pronunciation.ipa || '未提供'}

**英文释义**:
`;

    // 添加释义
    wordInfo.definitions.forEach((def, i) => {
        prompt += `${i + 1}. ${def.gloss}\n`;
        if (def.tags.length > 0) {
            prompt += `   (标签: ${def.tags.join(', ')})\n`;
        }
    });

    // 添加例句
    const allExamples = wordInfo.definitions
        .flatMap(d => d.examples)
        .filter(e => e.text);

    if (allExamples.length > 0) {
        prompt += `\n**例句**:\n`;
        allExamples.forEach(ex => {
            prompt += `- ${ex.text}\n`;
            if (ex.translation) {
                prompt += `  译: ${ex.translation}\n`;
            }
        });
    }

    // 添加同义词/反义词
    if (wordInfo.synonyms.length > 0) {
        prompt += `\n**同义词**: ${wordInfo.synonyms.join(', ')}`;
    }
    if (wordInfo.antonyms.length > 0) {
        prompt += `\n**反义词**: ${wordInfo.antonyms.join(', ')}`;
    }

    // 添加词形变化（如果是名词或动词）
    if (['noun', 'verb'].includes(wordInfo.pos) && wordInfo.forms.length > 0) {
        prompt += `\n\n**重要词形**:\n`;
        wordInfo.forms.forEach(form => {
            if (form.tags.length > 0) {
                prompt += `- ${form.form} (${form.tags.join(', ')})\n`;
            }
        });
    }

    // 添加词源（如果有）
    if (wordInfo.etymology) {
        prompt += `\n**词源**: ${wordInfo.etymology}`;
    }

    prompt += `

请提供：
1. **中文释义**: 准确的中文翻译（可以有多个义项）
2. **用法说明**: 常用搭配和使用场景
3. **记忆技巧**: 帮助记忆的方法（比如词根、联想等）
4. **注意事项**: 使用时需要注意的语法或用法要点

请用清晰的markdown格式回复。`;

    return prompt;
}

/**
 * 将英文词性翻译成中文
 * @param {string} pos - 英文词性
 * @returns {string} - 中文词性
 */
function translatePOS(pos) {
    const posMap = {
        'noun': '名词',
        'verb': '动词',
        'adj': '形容词',
        'adv': '副词',
        'prep': '介词',
        'conj': '连词',
        'pron': '代词',
        'det': '限定词',
        'num': '数词',
        'interj': '感叹词',
        'prefix': '前缀',
        'suffix': '后缀',
        'phrase': '短语',
        'name': '专有名词'
    };
    return posMap[pos] || pos;
}

/**
 * 过滤和合并同一单词的多个词条
 * @param {Array} entries - 同一单词的多个词条
 * @returns {Array} - 按词性分组的词条
 */
export function mergeEntries(entries) {
    if (!entries || entries.length === 0) return [];

    // 按词性分组
    const byPos = entries.reduce((acc, entry) => {
        const pos = entry.pos || 'unknown';
        if (!acc[pos]) {
            acc[pos] = [];
        }
        acc[pos].push(entry);
        return acc;
    }, {});

    return Object.entries(byPos).map(([pos, items]) => {
        // 如果同一词性有多个词条，合并它们的senses
        if (items.length === 1) {
            return items[0];
        }

        return {
            ...items[0],
            senses: items.flatMap(item => item.senses || [])
        };
    });
}

/**
 * 示例：如何使用这些函数
 */
export function exampleUsage() {
    // 假设从词典中读取到了词条
    const exampleEntry = {
        "word": "Haus",
        "pos": "noun",
        "senses": [
            {
                "glosses": ["house, building"],
                "examples": [
                    { "text": "Ich gehe nach Hause.", "english": "I go home." }
                ]
            }
        ],
        "sounds": [
            { "ipa": "/haʊ̯s/" }
        ],
        "forms": [
            { "form": "Hauses", "tags": ["genitive", "singular"] },
            { "form": "Häuser", "tags": ["plural"] }
        ]
    };

    // 1. 提取核心信息
    const keyInfo = extractKeyInfo(exampleEntry);
    console.log('提取的信息:', keyInfo);

    // 2. 生成AI提示词
    const prompt = generateAIPrompt(keyInfo);
    console.log('AI提示词:', prompt);

    // 3. 然后将prompt发送给AI进行翻译...
}
