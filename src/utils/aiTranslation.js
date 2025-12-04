/**
 * AI翻译服务 - 统一接口
 * 
 * 支持多个AI提供商：OpenAI、Claude、Gemini
 */

import { getAIConfig, validateConfig } from './aiConfig.js';

/**
 * 主翻译函数 - 自动选择提供商
 * @param {string} prompt - 翻译提示词
 * @param {Object} options - 可选配置
 * @returns {Promise<string>} - AI返回的内容
 */
export async function translateWithAI(prompt, options = {}) {
    const config = {
        ...getAIConfig(),
        ...options
    };

    // 验证配置
    validateConfig(config);

    // 根据提供商选择实现
    switch (config.modelConfig.provider) {
        case 'openai':
            return translateWithOpenAI(prompt, config);

        case 'claude':
            return translateWithClaude(prompt, config);

        case 'gemini':
            return translateWithGemini(prompt, config);

        default:
            throw new Error(`不支持的AI提供商: ${config.provider}`);
    }
}

/**
 * OpenAI翻译实现
 * @param {string} prompt - 提示词
 * @param {Object} config - 配置
 * @returns {Promise<string>} - 翻译结果
 */
async function translateWithOpenAI(prompt, config) {
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const requestBody = {
        model: config.model,
        messages: [
            {
                role: 'system',
                content: '你是一个专业的德语-中文翻译助手。请准确、简洁地翻译德语单词和短语。'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: config.modelConfig.temperature,
        max_tokens: config.modelConfig.maxTokens
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(config.timeout)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`OpenAI API错误: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();

        // 提取结果
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('OpenAI返回内容为空');
        }

        // 记录使用情况
        logUsage('openai', data.usage, config.model);

        return content;
    } catch (error) {
        if (error.name === 'TimeoutError') {
            throw new Error('OpenAI请求超时');
        }
        throw error;
    }
}

/**
 * Claude翻译实现
 * @param {string} prompt - 提示词
 * @param {Object} config - 配置
 * @returns {Promise<string>} - 翻译结果
 */
async function translateWithClaude(prompt, config) {
    const endpoint = 'https://api.anthropic.com/v1/messages';

    const requestBody = {
        model: config.model,
        max_tokens: config.modelConfig.maxTokens,
        temperature: config.modelConfig.temperature,
        messages: [
            {
                role: 'user',
                content: prompt
            }
        ],
        system: '你是一个专业的德语-中文翻译助手。请准确、简洁地翻译德语单词和短语。'
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(config.timeout)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Claude API错误: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();

        // 提取结果
        const content = data.content?.[0]?.text;
        if (!content) {
            throw new Error('Claude返回内容为空');
        }

        // 记录使用情况
        logUsage('claude', data.usage, config.model);

        return content;
    } catch (error) {
        if (error.name === 'TimeoutError') {
            throw new Error('Claude请求超时');
        }
        throw error;
    }
}

/**
 * Gemini翻译实现
 * @param {string} prompt - 提示词
 * @param {Object} config - 配置
 * @returns {Promise<string>} - 翻译结果
 */
async function translateWithGemini(prompt, config) {
    // Gemini使用不同的端点格式
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        text: `你是一个专业的德语-中文翻译助手。请准确、简洁地翻译德语单词和短语。\n\n${prompt}`
                    }
                ]
            }
        ],
        generationConfig: {
            temperature: config.modelConfig.temperature,
            maxOutputTokens: config.modelConfig.maxTokens
        }
    };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(config.timeout)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Gemini API错误: ${error.error?.message || response.statusText}`);
        }

        const data = await response.json();

        // 提取结果
        const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) {
            throw new Error('Gemini返回内容为空');
        }

        // 记录使用情况
        logUsage('gemini', data.usageMetadata, config.model);

        return content;
    } catch (error) {
        if (error.name === 'TimeoutError') {
            throw new Error('Gemini请求超时');
        }
        throw error;
    }
}

/**
 * 带重试的翻译
 * @param {string} prompt - 提示词
 * @param {Object} options - 配置
 * @returns {Promise<string>} - 翻译结果
 */
export async function translateWithRetry(prompt, options = {}) {
    const config = {
        ...getAIConfig(),
        ...options
    };

    let lastError;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
        try {
            return await translateWithAI(prompt, config);
        } catch (error) {
            lastError = error;

            console.warn(`翻译失败 (尝试 ${attempt}/${config.maxRetries}):`, error.message);

            if (attempt < config.maxRetries) {
                // 指数退避
                const delay = config.retryDelay * Math.pow(2, attempt - 1);
                console.log(`等待 ${delay}ms 后重试...`);
                await sleep(delay);
            }
        }
    }

    throw new Error(`翻译失败，已重试${config.maxRetries}次: ${lastError.message}`);
}

/**
 * 流式翻译（用于实时显示）
 * @param {string} prompt - 提示词
 * @param {Function} onChunk - 接收到数据块时的回调
 * @param {Object} options - 配置
 * @returns {Promise<string>} - 完整的翻译结果
 */
export async function translateWithStream(prompt, onChunk, options = {}) {
    const config = {
        ...getAIConfig(),
        ...options
    };

    validateConfig(config);

    // 目前只有OpenAI和Claude支持流式
    if (config.modelConfig.provider === 'openai') {
        return streamOpenAI(prompt, onChunk, config);
    } else if (config.modelConfig.provider === 'claude') {
        return streamClaude(prompt, onChunk, config);
    } else {
        // 降级到非流式
        console.warn('当前提供商不支持流式，使用普通模式');
        return translateWithAI(prompt, config);
    }
}

/**
 * OpenAI流式实现
 */
async function streamOpenAI(prompt, onChunk, config) {
    const endpoint = 'https://api.openai.com/v1/chat/completions';

    const requestBody = {
        model: config.model,
        messages: [
            {
                role: 'system',
                content: '你是一个专业的德语-中文翻译助手。请准确、简洁地翻译德语单词和短语。'
            },
            {
                role: 'user',
                content: prompt
            }
        ],
        temperature: config.modelConfig.temperature,
        max_tokens: config.modelConfig.maxTokens,
        stream: true
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Stream请求失败: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content;

                    if (content) {
                        fullContent += content;
                        onChunk(content);
                    }
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }
    }

    return fullContent;
}

/**
 * Claude流式实现
 */
async function streamClaude(prompt, onChunk, config) {
    const endpoint = 'https://api.anthropic.com/v1/messages';

    const requestBody = {
        model: config.model,
        max_tokens: config.modelConfig.maxTokens,
        temperature: config.modelConfig.temperature,
        messages: [{ role: 'user', content: prompt }],
        system: '你是一个专业的德语-中文翻译助手。',
        stream: true
    };

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`Stream请求失败: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                const data = line.slice(6);

                try {
                    const parsed = JSON.parse(data);

                    if (parsed.type === 'content_block_delta') {
                        const content = parsed.delta?.text;
                        if (content) {
                            fullContent += content;
                            onChunk(content);
                        }
                    }
                } catch (e) {
                    // 忽略解析错误
                }
            }
        }
    }

    return fullContent;
}

// 使用统计
const usageStats = {
    totalTokens: 0,
    totalCost: 0,
    requestCount: 0
};

/**
 * 记录使用情况
 */
function logUsage(provider, usage, model) {
    const modelConfig = require('./aiConfig.js').AI_MODELS[model];

    let totalTokens = 0;

    if (provider === 'openai') {
        totalTokens = usage?.total_tokens || 0;
    } else if (provider === 'claude') {
        totalTokens = (usage?.input_tokens || 0) + (usage?.output_tokens || 0);
    } else if (provider === 'gemini') {
        totalTokens = (usage?.promptTokenCount || 0) + (usage?.candidatesTokenCount || 0);
    }

    const cost = (totalTokens / 1000) * modelConfig.costPer1kTokens;

    usageStats.totalTokens += totalTokens;
    usageStats.totalCost += cost;
    usageStats.requestCount += 1;

    console.log(`[AI使用] 模型: ${model}, Tokens: ${totalTokens}, 成本: $${cost.toFixed(6)}`);
}

/**
 * 获取使用统计
 * @returns {Object} - 使用统计
 */
export function getUsageStats() {
    return {
        ...usageStats,
        averageTokensPerRequest: usageStats.requestCount > 0
            ? Math.round(usageStats.totalTokens / usageStats.requestCount)
            : 0
    };
}

/**
 * 重置使用统计
 */
export function resetUsageStats() {
    usageStats.totalTokens = 0;
    usageStats.totalCost = 0;
    usageStats.requestCount = 0;
}

// 工具函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 导出默认翻译函数（带重试）
export default translateWithRetry;
