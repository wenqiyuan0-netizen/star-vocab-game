/**
 * AI翻译配置
 * 
 * 在 .env.local 中配置：
 * REACT_APP_AI_PROVIDER=openai|claude|gemini
 * REACT_APP_OPENAI_API_KEY=sk-...
 * REACT_APP_CLAUDE_API_KEY=sk-ant-...
 * REACT_APP_GEMINI_API_KEY=...
 */

// AI提供商配置
export const AI_PROVIDERS = {
    OPENAI: 'openai',
    CLAUDE: 'claude',
    GEMINI: 'gemini'
};

// 模型配置
export const AI_MODELS = {
    // OpenAI
    'gpt-4o-mini': {
        provider: AI_PROVIDERS.OPENAI,
        maxTokens: 4000,
        temperature: 0.3,
        costPer1kTokens: 0.00015 // USD
    },
    'gpt-4o': {
        provider: AI_PROVIDERS.OPENAI,
        maxTokens: 8000,
        temperature: 0.3,
        costPer1kTokens: 0.0025
    },

    // Claude
    'claude-3-haiku-20240307': {
        provider: AI_PROVIDERS.CLAUDE,
        maxTokens: 4000,
        temperature: 0.3,
        costPer1kTokens: 0.00025
    },
    'claude-3-5-sonnet-20241022': {
        provider: AI_PROVIDERS.CLAUDE,
        maxTokens: 8000,
        temperature: 0.3,
        costPer1kTokens: 0.003
    },

    // Gemini
    'gemini-1.5-flash': {
        provider: AI_PROVIDERS.GEMINI,
        maxTokens: 4000,
        temperature: 0.3,
        costPer1kTokens: 0.000075
    },
    'gemini-1.5-pro': {
        provider: AI_PROVIDERS.GEMINI,
        maxTokens: 8000,
        temperature: 0.3,
        costPer1kTokens: 0.00125
    }
};

// 默认配置
export const DEFAULT_CONFIG = {
    model: 'gpt-4o-mini', // 默认使用最便宜的GPT-4模型
    timeout: 30000,       // 30秒超时
    maxRetries: 3,        // 最多重试3次
    retryDelay: 1000      // 重试延迟1秒
};

/**
 * 获取AI配置
 * @returns {Object} - AI配置
 */
export function getAIConfig() {
    // 从环境变量读取
    const provider = process.env.REACT_APP_AI_PROVIDER || 'openai';
    const model = process.env.REACT_APP_AI_MODEL || DEFAULT_CONFIG.model;

    // API密钥
    const apiKeys = {
        openai: process.env.REACT_APP_OPENAI_API_KEY,
        claude: process.env.REACT_APP_CLAUDE_API_KEY,
        gemini: process.env.REACT_APP_GEMINI_API_KEY
    };

    return {
        provider,
        model,
        apiKey: apiKeys[provider],
        modelConfig: AI_MODELS[model] || AI_MODELS[DEFAULT_CONFIG.model],
        timeout: DEFAULT_CONFIG.timeout,
        maxRetries: DEFAULT_CONFIG.maxRetries,
        retryDelay: DEFAULT_CONFIG.retryDelay
    };
}

/**
 * 验证配置
 * @param {Object} config - AI配置
 * @throws {Error} - 配置无效时抛出错误
 */
export function validateConfig(config) {
    if (!config.apiKey) {
        throw new Error(`缺少 ${config.provider.toUpperCase()} API密钥，请在环境变量中配置`);
    }

    if (!AI_MODELS[config.model]) {
        throw new Error(`不支持的模型: ${config.model}`);
    }
}
