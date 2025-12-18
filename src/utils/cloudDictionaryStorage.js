/**
 * 云端词典存储接口 - Supabase实现
 *
 * 提供云端词典的CRUD操作（支持词形还原）
 */

import { createClient } from '@supabase/supabase-js';
import { lemmatizationService } from './lemmatizationService';

// Supabase配置（从环境变量读取）
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// 创建Supabase客户端
const supabase = createClient(supabaseUrl, supabaseKey);

// 表名
const TABLE_NAME = 'cloud_dictionary';

/**
 * 云端词典类
 */
export class CloudDictionary {
    /**
     * 获取单个词条（支持词形还原）
     * @param {string} word - 单词
     * @param {string} [pos] - 词性（可选，用于精确匹配）
     * @param {boolean} [useLemmatization] - 是否使用词形还原（默认 true）
     * @returns {Promise<Array>} - 词条数组（可能包含多个匹配）
     */
    async get(word, pos = null, useLemmatization = true) {
        try {
            const results = [];

            // 1. 尝试直接查询 dictionary 表
            let query = supabase
                .from('dictionary')
                .select('*')
                .ilike('word', word);

            if (pos) {
                query = query.eq('pos', pos);
            }

            const { data: directData, error: directError } = await query;

            if (directError && directError.code !== 'PGRST116') {
                console.error(`直接查询失败 (${word}):`, directError);
            }

            if (directData && directData.length > 0) {
                results.push(...directData);
            }

            // 2. 如果启用词形还原且直接查询无结果，使用词形还原
            if (useLemmatization && results.length === 0) {
                const lemmaResults = await lemmatizationService.findLemma(word);
                if (lemmaResults && lemmaResults.length > 0) {
                    console.log(`[CloudDict] 词形还原: ${word} → 找到 ${lemmaResults.length} 个结果`);
                    results.push(...lemmaResults);
                }
            }

            return results;
        } catch (error) {
            console.error(`查询词条失败 (${word}):`, error);
            return [];
        }
    }

    /**
     * 批量获取词条
     * @param {string[]} words - 单词数组
     * @returns {Promise<Object>} - { word: entry } 字典
     */
    async getBatch(words) {
        try {
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .select('*')
                .in('word', words);

            if (error) throw error;

            // 转换为字典格式
            const result = {};
            (data || []).forEach(row => {
                const entry = this._deserialize(row);
                result[entry.w] = entry;
            });

            return result;
        } catch (error) {
            console.error('批量查询失败:', error);
            throw error;
        }
    }

    /**
     * 保存单个词条
     * @param {CloudDictionaryEntry} entry - 词条
     * @returns {Promise<CloudDictionaryEntry>} - 保存后的词条
     */
    async set(entry) {
        try {
            const row = this._serialize(entry);

            const { data, error } = await supabase
                .from(TABLE_NAME)
                .upsert(row, {
                    onConflict: 'word,pos'
                })
                .select()
                .single();

            if (error) throw error;

            return this._deserialize(data);
        } catch (error) {
            console.error(`保存词条失败 (${entry.w}):`, error);
            throw error;
        }
    }

    /**
     * 批量保存词条
     * @param {CloudDictionaryEntry[]} entries - 词条数组
     * @returns {Promise<CloudDictionaryEntry[]>} - 保存后的词条
     */
    async setBatch(entries) {
        try {
            const rows = entries.map(entry => this._serialize(entry));

            const { data, error } = await supabase
                .from(TABLE_NAME)
                .upsert(rows, {
                    onConflict: 'word,pos'
                })
                .select();

            if (error) throw error;

            return (data || []).map(row => this._deserialize(row));
        } catch (error) {
            console.error('批量保存失败:', error);
            throw error;
        }
    }

    /**
     * 删除词条
     * @param {string} word - 单词
     * @param {string} [pos] - 词性
     * @returns {Promise<void>}
     */
    async delete(word, pos = null) {
        try {
            let query = supabase
                .from(TABLE_NAME)
                .delete()
                .eq('word', word);

            if (pos) {
                query = query.eq('pos', pos);
            }

            const { error } = await query;

            if (error) throw error;
        } catch (error) {
            console.error(`删除词条失败 (${word}):`, error);
            throw error;
        }
    }

    /**
     * 搜索词条（模糊匹配）
     * @param {string} pattern - 搜索模式
     * @param {number} limit - 限制数量
     * @returns {Promise<CloudDictionaryEntry[]>} - 词条数组
     */
    async search(pattern, limit = 50) {
        try {
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .select('*')
                .ilike('word', `%${pattern}%`)
                .limit(limit);

            if (error) throw error;

            return (data || []).map(row => this._deserialize(row));
        } catch (error) {
            console.error('搜索失败:', error);
            throw error;
        }
    }

    /**
     * 获取需要翻译的词条
     * @param {number} limit - 限制数量
     * @returns {Promise<CloudDictionaryEntry[]>} - 词条数组
     */
    async getUntranslated(limit = 100) {
        try {
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .select('*')
                .eq('has_translation', false)
                .limit(limit);

            if (error) throw error;

            return (data || []).map(row => this._deserialize(row));
        } catch (error) {
            console.error('查询未翻译词条失败:', error);
            throw error;
        }
    }

    /**
     * 获取统计信息
     * @returns {Promise<Object>} - 统计信息
     */
    async getStats() {
        try {
            // 总词条数
            const { count: total, error: error1 } = await supabase
                .from(TABLE_NAME)
                .select('*', { count: 'exact', head: true });

            if (error1) throw error1;

            // 已翻译数
            const { count: translated, error: error2 } = await supabase
                .from(TABLE_NAME)
                .select('*', { count: 'exact', head: true })
                .eq('has_translation', true);

            if (error2) throw error2;

            return {
                total: total || 0,
                translated: translated || 0,
                untranslated: (total || 0) - (translated || 0),
                translationRate: total > 0 ? ((translated / total) * 100).toFixed(2) : 0
            };
        } catch (error) {
            console.error('获取统计信息失败:', error);
            throw error;
        }
    }

    /**
     * 获取最近更新的词条
     * @param {number} limit - 限制数量
     * @returns {Promise<CloudDictionaryEntry[]>} - 词条数组
     */
    async getRecentlyUpdated(limit = 50) {
        try {
            const { data, error } = await supabase
                .from(TABLE_NAME)
                .select('*')
                .order('updated_at', { ascending: false })
                .limit(limit);

            if (error) throw error;

            return (data || []).map(row => this._deserialize(row));
        } catch (error) {
            console.error('查询最近更新失败:', error);
            throw error;
        }
    }

    /**
     * 序列化：CloudDictionaryEntry → 数据库行
     * @param {CloudDictionaryEntry} entry - 词条
     * @returns {Object} - 数据库行
     * @private
     */
    _serialize(entry) {
        return {
            word: entry.w,
            pos: entry.p,
            data: entry, // 存储完整的压缩格式
            has_translation: !!(entry.c && entry.c.length > 0),
            updated_at: new Date().toISOString()
        };
    }

    /**
     * 反序列化：数据库行 → CloudDictionaryEntry
     * @param {Object} row - 数据库行
     * @returns {CloudDictionaryEntry} - 词条
     * @private
     */
    _deserialize(row) {
        return row.data;
    }
}

/**
 * 创建云端词典表（初始化时调用）
 */
export async function createCloudDictionaryTable() {
    // 注意：这个函数需要在Supabase控制台中手动执行SQL
    // 或者使用管理员权限的客户端

    const sql = `
-- 创建云端词典表
CREATE TABLE IF NOT EXISTS cloud_dictionary (
  word TEXT NOT NULL,
  pos TEXT NOT NULL,
  data JSONB NOT NULL,
  has_translation BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (word, pos)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_cloud_dict_translation 
  ON cloud_dictionary(has_translation);

CREATE INDEX IF NOT EXISTS idx_cloud_dict_updated 
  ON cloud_dictionary(updated_at);

CREATE INDEX IF NOT EXISTS idx_cloud_dict_word_gin
  ON cloud_dictionary USING gin(word gin_trgm_ops);

-- 启用全文搜索扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cloud_dictionary_updated_at 
  BEFORE UPDATE ON cloud_dictionary
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
  `;

    console.log('请在Supabase SQL编辑器中执行以下SQL:');
    console.log(sql);

    return sql;
}

// 导出默认实例
export const cloudDict = new CloudDictionary();

// 使用示例
export async function exampleUsage() {
    const dict = new CloudDictionary();

    // 1. 保存词条
    const entry = {
        w: 'lernen',
        p: 'verb',
        e: ['to learn', 'to study'],
        c: ['学习', '学会'],
        x: ['Ich lerne Deutsch.'],
        i: '/ˈlɛʁnən/',
        t: Date.now(),
        v: 1
    };

    await dict.set(entry);
    console.log('保存成功');

    // 2. 获取词条
    const retrieved = await dict.get('lernen');
    console.log('获取词条:', retrieved);

    // 3. 批量查询
    const batch = await dict.getBatch(['lernen', 'Haus', 'Buch']);
    console.log('批量查询:', batch);

    // 4. 获取统计
    const stats = await dict.getStats();
    console.log('统计信息:', stats);

    // 5. 搜索
    const results = await dict.search('lern');
    console.log('搜索结果:', results);
}
