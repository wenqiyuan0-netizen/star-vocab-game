import { aiService } from '../ai/AIService';
import { localCorpusService } from './LocalCorpusService';
import { unifiedDictService } from '../dictionary/UnifiedDictionaryService'; // 引入新服务

import { sanitizeCn, cleanGermanExample } from '../../../logic/utils';

import { localDictDB } from '../dictionary/LocalDictionaryDB'; // 引入DB

class ExampleService {
  constructor(aiService) {
    this.aiService = aiService;
    this.cache = new Map();
  }

  async getExample(wordDe, wordCn, id) {
    const key = id || wordDe;

    // 1. 查内存缓存
    if (this.cache.has(key)) return this.cache.get(key);

    let example = null;
    const searchWord = wordDe.trim();

    // 2. 本地语料库 (最高优先级)
    try {
      const localEx = await this._fromLocalCorpus(searchWord);
      if (localEx) {
        console.log(`[ExampleService] LocalCorpus HIT for "${searchWord}"`);
        this.cache.set(key, localEx);
        return localEx;
      }
    } catch (e) {
      console.warn('[ExampleService] Local corpus error:', e);
    }

    // 3. 查独立例句库 (IndexedDB 'examples' store)
    try {
      const dbExamples = await localDictDB.getExamples(searchWord);
      if (dbExamples && dbExamples.length > 0) {
        // 随机取一个，或者取第一个
        // 假设结构 { sentence: '...', translation: '...' }
        const ex = dbExamples[0];
        if (ex.sentence) {
          const formatted = { de: ex.sentence, cn: ex.translation || '' };
          this.cache.set(key, formatted);
          return formatted;
        }
      }
    } catch (e) {
      console.warn('[ExampleService] DB examples error:', e);
    }

    // 4. 查统一词典 (新架构: Local DB -> Cloud -> Async Translation)
    try {
      const dictEntry = await unifiedDictService.lookup(searchWord);
      if (dictEntry) {
        // 尝试提取例句 (如果词典里有例句字段)
        // 假设新词典结构可能有 examples 数组，或者是简单的 definition

        // 构造返回格式
        const ex = {
          // 如果词典里有例句数组
          de: dictEntry.examples?.[0]?.de || dictEntry.sentence || '',
          cn: dictEntry.examples?.[0]?.cn || dictEntry.translation || dictEntry.definition_en || ''
        };

        // 如果提取到了有效例句
        if (ex.de) {
          this.cache.set(key, ex);
          return ex;
        }

        // 如果词典里只有释义没有例句，我们可能还是需要 AI 生成例句
        // 但我们可以把词典的释义作为参考返回
      }
    } catch (e) {
      console.error('[ExampleService] Dictionary lookup error:', e);
    }

    // 4. AI 兜底 (如果词典也没找到例句)
    if (!example) {
      example = await this._getAiFallback(wordDe, wordCn);
    }

    // 5. 写入缓存
    if (example && example.de) {
      this.cache.set(key, example);
      return example;
    }

    return null;
  }

  // ---------- Local Corpus Logic ----------
  async _fromLocalCorpus(word) {
    const results = await localCorpusService.findExamples(word);
    if (results && results.length > 0) {
      return results[0];
    }
    return null;
  }

  // (旧的 _ensureDictLoaded 和 _fromLocalDict 已被 unifiedDictService 取代，故删除或保留为空)

  /**
   * 获取词典完整词条 (用于单词卡片详情页)
   * 现在的实现直接代理给 UnifiedDictionaryService
   */
  async getDictEntry(wordDe) {
    return await unifiedDictService.lookup(wordDe);
  }

  // ... (保留辅助函数 _normBase 等，如果需要) ...



  // ---------- 2. AI Fallback ----------
  async _getAiFallback(wordDe, wordCn) {
    if (!this.aiService) return null;
    try {
      const raw = await this.aiService.generateExample(wordDe, wordCn);
      if (!raw || !raw.de) return null;
      let cleanDe = cleanGermanExample(raw.de);

      return { de: cleanDe, cn: raw.cn }; // 不处理繁简，原样返回
    } catch (e) {
      return null;
    }
  }
}
export const exampleService = new ExampleService(aiService);
