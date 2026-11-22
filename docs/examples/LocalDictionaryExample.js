/**
 * 本地词典使用示例
 * 
 * 演示如何在React组件中使用本地词典
 */

import React, { useState, useEffect } from 'react';
import { localDict } from '../utils/localDictionary';

function DictionaryDemo() {
    const [isLoaded, setIsLoaded] = useState(false);
    const [searchWord, setSearchWord] = useState('');
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);

    // 预加载词典
    useEffect(() => {
        localDict.load().then(() => {
            setIsLoaded(true);
        });
    }, []);

    // 查询单词
    const handleSearch = async () => {
        if (!searchWord.trim()) return;

        setLoading(true);
        try {
            const entries = await localDict.lookup(searchWord);
            setResult(entries);
        } catch (error) {
            console.error('查询失败:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="dictionary-demo">
            <h2>本地德语词典</h2>

            {!isLoaded ? (
                <div className="loading">
                    <p>⏳ 正在加载词典...</p>
                </div>
            ) : (
                <div className="search-box">
                    <input
                        type="text"
                        value={searchWord}
                        onChange={(e) => setSearchWord(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="输入德语单词..."
                    />
                    <button onClick={handleSearch} disabled={loading}>
                        {loading ? '查询中...' : '查询'}
                    </button>
                </div>
            )}

            {result && (
                <div className="results">
                    {result.length === 0 ? (
                        <p>未找到 "{searchWord}"</p>
                    ) : (
                        <div>
                            <h3>找到 {result.length} 个结果：</h3>
                            {result.map((entry, idx) => (
                                <div key={idx} className="entry">
                                    <h4>{entry.w} <span className="pos">({entry.p})</span></h4>

                                    {/* 英文释义 */}
                                    <div className="definitions">
                                        <strong>释义：</strong>
                                        <ul>
                                            {entry.e?.map((def, i) => (
                                                <li key={i}>{def}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* 发音 */}
                                    {entry.i && (
                                        <div className="pronunciation">
                                            <strong>发音：</strong> {entry.i}
                                        </div>
                                    )}

                                    {/* 例句 */}
                                    {entry.x && entry.x.length > 0 && (
                                        <div className="examples">
                                            <strong>例句：</strong>
                                            <ul>
                                                {entry.x.map((ex, i) => (
                                                    <li key={i}>{ex}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* 同义词 */}
                                    {entry.s && entry.s.length > 0 && (
                                        <div className="synonyms">
                                            <strong>同义词：</strong> {entry.s.join(', ')}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default DictionaryDemo;

// ========================================
// 高级用法示例
// ========================================

/**
 * 示例1：智能搜索（结合本地词典 + vocab-dict）
 */
export async function smartLookup(word) {
    // 1. 先查已有中文的 vocab-dict
    const vocabEntry = await searchVocabDict(word);
    if (vocabEntry) {
        return {
            source: 'vocab-dict',
            hasChinese: true,
            data: vocabEntry
        };
    }

    // 2. 再查本地词典（英文释义）
    const localEntries = await localDict.lookup(word);
    if (localEntries.length > 0) {
        return {
            source: 'local-dict',
            hasChinese: false,
            data: localEntries,
            needsTranslation: true
        };
    }

    // 3. 未找到
    return null;
}

/**
 * 示例2：自动完成建议
 */
export async function getAutocompleteSuggestions(input, limit = 10) {
    if (input.length < 2) return [];

    const results = await localDict.search(input, limit);
    return results.map(entry => ({
        word: entry.w,
        pos: entry.p,
        preview: entry.e?.[0] // 第一个释义作为预览
    }));
}

/**
 * 示例3：每日单词
 */
export async function getDailyWords(count = 5) {
    const words = await localDict.random(count);

    return words.map(entry => ({
        word: entry.w,
        pos: entry.p,
        definition: entry.e?.[0],
        example: entry.x?.[0],
        pronunciation: entry.i
    }));
}

/**
 * 示例4：词典统计仪表板
 */
export async function getDictionaryStats() {
    const stats = await localDict.stats();

    return {
        ...stats,
        coverage: {
            pronunciation: `${((stats.withPronunciation / stats.totalEntries) * 100).toFixed(1)}%`,
            examples: `${((stats.withExamples / stats.totalEntries) * 100).toFixed(1)}%`,
            synonyms: `${((stats.withSynonyms / stats.totalEntries) * 100).toFixed(1)}%`
        },
        topPos: Object.entries(stats.byPartOfSpeech)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
    };
}

// 辅助函数（需要实现）
async function searchVocabDict(word) {
    // 从 vocab-dict.json 查询
    // 这个您已经有了
    return null;
}
