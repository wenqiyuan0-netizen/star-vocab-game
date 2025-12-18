/**
 * 变位表组件
 *
 * 显示单词的所有词形变化（动词变位、名词变格、形容词变化等）
 */

import React, { useState, useEffect } from 'react';
import { localLemmatization } from '../utils/localLemmatization';

export function InflectionTable({ word }) {
    const [forms, setForms] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        loadForms();
    }, [word]);

    async function loadForms() {
        if (!word) return;

        setLoading(true);
        setError(null);

        try {
            const formsData = await localLemmatization.getWordForms(word);

            if (!formsData) {
                setError('未找到该词的变位信息');
            } else {
                setForms(formsData);
            }
        } catch (err) {
            setError('加载变位信息失败');
            console.error('[InflectionTable] Error:', err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div className="inflection-table loading">
                <div className="spinner">加载中...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="inflection-table error">
                <p>{error}</p>
            </div>
        );
    }

    if (!forms || !forms.variants || forms.variants.length === 0) {
        return (
            <div className="inflection-table no-data">
                <p>该词没有变位形式</p>
            </div>
        );
    }

    return (
        <div className="inflection-table">
            <div className="inflection-header">
                <h3>变位表</h3>
                <span className="lemma">{forms.lemma}</span>
                <span className="pos">({forms.pos})</span>
            </div>

            <div className="inflection-stats">
                <span>共 {forms.variants.length} 个变位形式</span>
            </div>

            <div className="inflection-variants">
                {renderVariants(forms)}
            </div>
        </div>
    );
}

/**
 * 渲染变位形式列表
 */
function renderVariants(forms) {
    const { variants, forms: detailedForms } = forms;

    // 如果有详细的变位信息（带标签）
    if (detailedForms && detailedForms.length > 0) {
        return renderDetailedForms(detailedForms);
    }

    // 否则只显示简单列表
    return renderSimpleList(variants);
}

/**
 * 渲染详细变位表（带标签）
 */
function renderDetailedForms(forms) {
    // 按标签分组
    const grouped = groupFormsByTags(forms);

    return (
        <div className="detailed-forms">
            {Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="form-category">
                    <h4>{category}</h4>
                    <div className="form-list">
                        {items.map((item, idx) => (
                            <div key={idx} className="form-item">
                                <span className="form-word">{item.form}</span>
                                {item.tags && item.tags.length > 0 && (
                                    <span className="form-tags">
                                        {item.tags.join(', ')}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

/**
 * 渲染简单列表
 */
function renderSimpleList(variants) {
    // 按字母顺序排序
    const sorted = [...variants].sort();

    // 每行显示 5 个
    const columns = 5;
    const rows = [];

    for (let i = 0; i < sorted.length; i += columns) {
        rows.push(sorted.slice(i, i + columns));
    }

    return (
        <div className="simple-list">
            {rows.map((row, idx) => (
                <div key={idx} className="form-row">
                    {row.map((variant, vIdx) => (
                        <span key={vIdx} className="form-item">
                            {variant}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}

/**
 * 按标签分组
 */
function groupFormsByTags(forms) {
    const categories = {
        '现在时': [],
        '过去时': [],
        '完成时': [],
        '命令式': [],
        '虚拟式': [],
        '不定式': [],
        '分词': [],
        '其他': []
    };

    forms.forEach(form => {
        const tags = form.tags || [];
        const tagsStr = tags.join(' ').toLowerCase();

        if (tagsStr.includes('present') || tagsStr.includes('präsens')) {
            categories['现在时'].push(form);
        } else if (tagsStr.includes('past') || tagsStr.includes('prät') || tagsStr.includes('imperfect')) {
            categories['过去时'].push(form);
        } else if (tagsStr.includes('perfect') || tagsStr.includes('partizip')) {
            categories['完成时'].push(form);
        } else if (tagsStr.includes('imperative') || tagsStr.includes('imperativ')) {
            categories['命令式'].push(form);
        } else if (tagsStr.includes('subjunctive') || tagsStr.includes('konjunktiv')) {
            categories['虚拟式'].push(form);
        } else if (tagsStr.includes('infinitive') || tagsStr.includes('infinitiv')) {
            categories['不定式'].push(form);
        } else if (tagsStr.includes('participle') || tagsStr.includes('partizip')) {
            categories['分词'].push(form);
        } else {
            categories['其他'].push(form);
        }
    });

    // 移除空分类
    Object.keys(categories).forEach(key => {
        if (categories[key].length === 0) {
            delete categories[key];
        }
    });

    return categories;
}

/**
 * 紧凑版变位按钮组件
 */
export function InflectionButton({ word, onShow }) {
    const [hasInflections, setHasInflections] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        checkInflections();
    }, [word]);

    async function checkInflections() {
        if (!word) return;

        try {
            const stats = await localLemmatization.getStats(word);
            setHasInflections(stats && stats.variantCount > 0);
        } catch (error) {
            console.error('[InflectionButton] Error:', error);
            setHasInflections(false);
        } finally {
            setLoading(false);
        }
    }

    if (loading || !hasInflections) {
        return null;
    }

    return (
        <button
            className="inflection-button"
            onClick={onShow}
            title="查看所有变位形式"
        >
            📋 变位
        </button>
    );
}

export default InflectionTable;
