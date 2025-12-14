/**
 * 词典适配器索引
 * 
 * 提供统一的适配器访问接口
 */

export { WiktionaryAdapter, createCommonAdapter, createCloudAdapter } from './WiktionaryAdapter';
export { GoetheAdapter, createGoetheAdapter } from './GoetheAdapter';

/**
 * 根据来源类型获取适配器
 * @param {string} sourceType - 来源类型
 * @param {Object} options - 配置选项
 * @returns {Object} 适配器实例
 */
export function getAdapter(sourceType, options = {}) {
    switch (sourceType) {
        case 'wiktionary':
        case 'wikt_2500':
            return new (require('./WiktionaryAdapter').WiktionaryAdapter)({
                sourceId: 'wikt_2500',
                hasChineseTranslation: true,
                ...options
            });

        case 'wikt_cloud':
            return new (require('./WiktionaryAdapter').WiktionaryAdapter)({
                sourceId: 'wikt_cloud',
                hasChineseTranslation: false,
                ...options
            });

        case 'goethe':
        case 'goethe_a1':
        case 'goethe_a2':
        case 'goethe_b1':
        case 'goethe_b2':
            const level = sourceType.split('_')[1]?.toUpperCase() || 'A1';
            return new (require('./GoetheAdapter').GoetheAdapter)({
                defaultLevel: level,
                ...options
            });

        default:
            throw new Error(`Unknown source type: ${sourceType}`);
    }
}
