/**
 * AI翻译服务使用示例和测试
 */

import translateWithAI, {
    translateWithRetry,
    translateWithStream,
    getUsageStats
} from '../utils/aiTranslation.js';
import { translateWords } from '../utils/translationService.js';
import { cloudDict } from '../utils/cloudDictionaryStorage.js';

// ==================== 示例1: 基础翻译 ====================

export async function example1_basicTranslation() {
    console.log('\n=== 示例1: 基础翻译 ===\n');

    const prompt = `请将以下德语单词翻译成中文，返回JSON数组格式：

\`\`\`json
[
  {
    "word": "lernen",
    "pos": "verb",
    "english": ["to learn", "to study"],
    "examples": ["Ich lerne Deutsch."]
  }
]
\`\`\`

返回格式：
\`\`\`json
[["学习", "学会"]]
\`\`\``;

    try {
        const result = await translateWithAI(prompt);
        console.log('翻译结果:', result);

        // 解析JSON
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const translations = JSON.parse(jsonMatch[0]);
            console.log('解析后的翻译:', translations);
        }
    } catch (error) {
        console.error('翻译失败:', error.message);
    }
}

// ==================== 示例2: 批量翻译 ====================

export async function example2_batchTranslation() {
    console.log('\n=== 示例2: 批量翻译 ===\n');

    const words = [
        {
            "word": "Haus",
            "pos": "noun",
            "english": ["house", "building"],
            "examples": ["Das ist mein Haus."]
        },
        {
            "word": "Buch",
            "pos": "noun",
            "english": ["book"],
            "examples": ["Ich lese ein Buch."]
        },
        {
            "word": "schreiben",
            "pos": "verb",
            "english": ["to write"],
            "examples": ["Ich schreibe einen Brief."]
        }
    ];

    const prompt = `请将以下德语单词批量翻译成中文，返回JSON数组格式，每个单词提供1-3个中文释义：

输入词条：
\`\`\`json
${JSON.stringify(words, null, 2)}
\`\`\`

请返回格式（只返回JSON数组，不要其他文字）：
\`\`\`json
[
  ["房子", "住宅", "家"],
  ["书", "书籍"],
  ["写", "书写"]
]
\`\`\``;

    try {
        const result = await translateWithRetry(prompt);
        console.log('翻译结果:', result);

        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const translations = JSON.parse(jsonMatch[0]);

            console.log('\n翻译对照:');
            words.forEach((word, i) => {
                console.log(`${word.word} → ${translations[i]?.join(', ')}`);
            });
        }
    } catch (error) {
        console.error('批量翻译失败:', error.message);
    }
}

// ==================== 示例3: 流式翻译 ====================

export async function example3_streamTranslation() {
    console.log('\n=== 示例3: 流式翻译（实时显示）===\n');

    const prompt = `请详细解释德语单词 "lernen" 的用法，并提供例句。`;

    let accumulated = '';

    try {
        const result = await translateWithStream(
            prompt,
            (chunk) => {
                // 实时接收到的内容
                accumulated += chunk;
                process.stdout.write(chunk); // 实时输出
            }
        );

        console.log('\n\n完整结果:', result);
    } catch (error) {
        console.error('流式翻译失败:', error.message);
    }
}

// ==================== 示例4: 集成完整工作流 ====================

export async function example4_completeWorkflow() {
    console.log('\n=== 示例4: 完整工作流（查询+翻译+保存）===\n');

    const wordsToAdd = ['lernen', 'Haus', 'schreiben'];

    try {
        // 使用完整的翻译服务
        const result = await translateWords(
            wordsToAdd,
            cloudDict,
            translateWithRetry
        );

        console.log(`\n处理完成:`);
        console.log(`- 总计: ${result.results.length} 个词条`);
        console.log(`- 新翻译: ${result.newTranslations.length} 个`);
        console.log(`- 错误: ${result.errors.length} 个\n`);

        // 显示结果
        result.results.forEach(entry => {
            console.log(`\n${entry.w} (${entry.p})`);
            console.log(`  英文: ${(entry.e || []).join(', ')}`);
            console.log(`  中文: ${(entry.c || []).join(', ')}`);
            if (entry.x) {
                console.log(`  例句: ${entry.x[0]}`);
            }
        });

        // 显示使用统计
        const stats = getUsageStats();
        console.log(`\nAI使用统计:`);
        console.log(`  请求次数: ${stats.requestCount}`);
        console.log(`  总Token: ${stats.totalTokens}`);
        console.log(`  平均Token/请求: ${stats.averageTokensPerRequest}`);
        console.log(`  总成本: $${stats.totalCost.toFixed(6)}`);

    } catch (error) {
        console.error('工作流失败:', error.message);
    }
}

// ==================== 示例5: 错误处理 ====================

export async function example5_errorHandling() {
    console.log('\n=== 示例5: 错误处理和重试 ===\n');

    // 故意使用一个会失败的提示（测试）
    const prompt = 'x'.repeat(100000); // 超长提示

    try {
        await translateWithRetry(prompt, {
            maxRetries: 3,
            retryDelay: 500
        });
    } catch (error) {
        console.log('预期的错误:', error.message);
        console.log('重试机制正常工作！');
    }
}

// ==================== 示例6: 不同AI提供商对比 ====================

export async function example6_compareProviders() {
    console.log('\n=== 示例6: 对比不同AI提供商 ===\n');

    const prompt = `翻译德语单词 "Freundschaft" 成中文，返回1-3个释义的JSON数组。`;

    const providers = [
        { name: 'GPT-4o-mini', model: 'gpt-4o-mini' },
        { name: 'Claude Haiku', model: 'claude-3-haiku-20240307' },
        { name: 'Gemini Flash', model: 'gemini-1.5-flash' }
    ];

    for (const provider of providers) {
        try {
            console.log(`\n测试 ${provider.name}...`);

            const startTime = Date.now();
            const result = await translateWithAI(prompt, {
                model: provider.model
            });
            const duration = Date.now() - startTime;

            console.log(`结果: ${result}`);
            console.log(`耗时: ${duration}ms`);
        } catch (error) {
            console.error(`${provider.name} 失败:`, error.message);
        }
    }

    // 显示成本对比
    const stats = getUsageStats();
    console.log(`\n总成本: $${stats.totalCost.toFixed(6)}`);
}

// ==================== 运行所有示例 ====================

export async function runAllExamples() {
    console.log('╔════════════════════════════════════════╗');
    console.log('║   AI翻译服务 - 使用示例               ║');
    console.log('╚════════════════════════════════════════╝');

    // 检查环境变量
    const hasAPIKey = process.env.REACT_APP_OPENAI_API_KEY ||
        process.env.REACT_APP_CLAUDE_API_KEY ||
        process.env.REACT_APP_GEMINI_API_KEY;

    if (!hasAPIKey) {
        console.error('\n❌ 错误: 未找到AI API密钥！');
        console.log('\n请在 .env.local 中配置：');
        console.log('  REACT_APP_AI_PROVIDER=openai');
        console.log('  REACT_APP_OPENAI_API_KEY=sk-...');
        console.log('\n或使用其他提供商（claude/gemini）\n');
        return;
    }

    try {
        await example1_basicTranslation();
        await example2_batchTranslation();
        // await example3_streamTranslation(); // 流式翻译（可选）
        // await example4_completeWorkflow();   // 完整工作流（需要数据库）
        // await example5_errorHandling();      // 错误处理测试
        // await example6_compareProviders();   // 提供商对比（需要多个API key）

        console.log('\n✅ 示例运行完成！\n');
    } catch (error) {
        console.error('\n❌ 运行失败:', error);
    }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllExamples();
}
