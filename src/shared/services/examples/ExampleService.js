import { aiService } from '../ai/AIService'; // 引用隔壁的 AI 服务
import { localCorpusService } from './LocalCorpusService';

import { sanitizeCn, cleanGermanExample } from '../../../logic/utils'; 
class ExampleService {
  constructor(aiService) {
    this.aiService = aiService;
    this.cache = new Map();
    this.dictData = null;
    this.dictLoading = false;
  }

  async getExample(wordDe, wordCn, id) {
    const key = id || wordDe;

    // 1. 查缓存
    if (this.cache.has(key)) return this.cache.get(key);

    let example = null;


    // 2. 预处理搜索词
    const searchWord = wordDe.trim();

    // 2.1 优先从本地语料库 (IndexedDB) 检索例句。
    // 如果用户通过上传文章功能建立了本地语料库，这里会首先尝试从中查找匹配的例句。
    // 如果找到，则直接返回本地例句，不再进行后续的网络请求，以实现最快响应。
    try {
      const localEx = await this._fromLocalCorpus(searchWord);
      if (localEx) {
        console.log(`[ExampleService] LocalCorpus HIT for "${searchWord}". Using local example.`);
        this.cache.set(key, localEx);
        return localEx;
      } else {
        console.log(`[ExampleService] LocalCorpus MISS for "${searchWord}". Falling back to network providers.`);
      }
    } catch (e) {
      console.warn('[ExampleService] Local corpus error:', e);
    }

    // 3. 内置词典例句
    try {
      const dictEx = await this._fromLocalDict(searchWord);
      if (dictEx) {
        this.cache.set(key, dictEx);
        return dictEx;
      }
    } catch {}

    // 4. AI 兜底
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
      console.log(`[LocalCorpus] Found ${results.length} examples for ${word}`);
      return results[0]; // Return the first one (already shuffled by service)
    }
    return null;
  }

  async _ensureDictLoaded() {
    if (this.dictData || this.dictLoading) return;
    this.dictLoading = true;
    try {
      let arr = [];
      try {
        const stored = localStorage.getItem('star_vocab_local_dict');
        if (stored) {
          const parsed = JSON.parse(stored);
          arr = Array.isArray(parsed) ? parsed : [parsed];
        }
      } catch {}
      if (!arr || arr.length === 0) {
        try {
          const res = await fetch('/vocab-dict.json');
          if (res && res.ok) {
            const data = await res.json();
            arr = Array.isArray(data) ? data : [data];
          }
        } catch {}
      }
      this.dictData = (arr || []).filter(Boolean);
    } finally {
      this.dictLoading = false;
    }
  }

  _normBase(s) {
    return (s || '').trim().toLowerCase().replace(/^(der|die|das)\s+/, '');
  }

  _articleToGender(a) {
    const x = String(a || '').toLowerCase();
    if (x === 'der') return 'm';
    if (x === 'die') return 'f';
    if (x === 'das') return 'n';
    return '';
  }

  _genderToArticle(g) {
    const x = String(g || '').toLowerCase();
    if (x === 'm') return 'der';
    if (x === 'f') return 'die';
    if (x === 'n') return 'das';
    return '';
  }

  _extractBase(e) {
    const head = e.headword || '';
    const base = e.base || e.word || head.replace(/^(der|die|das)\s+/, '');
    return this._normBase(base);
  }

  _normalizeEntry(e) {
    const base = this._extractBase(e);
    const article = e.article || this._genderToArticle(e.gender) || (e.headword ? (e.headword.match(/^(der|die|das)\s+/)?.[0] || '').trim() : '');
    const gender = e.gender || this._articleToGender(article);
    const pos = e.pos || e.partOfSpeech || e.wordType || '';
    const plural = e.plural || e.pluralForm || null;
    const headword = e.headword || (article ? `${article} ${base}` : base);

    let examples = [];
    if (Array.isArray(e.examples)) {
      examples = e.examples.map(x => {
        if (!x) return null;
        if (typeof x === 'string') return { de: x, cn: '' };
        if (x.de || x.cn) return { de: x.de || '', cn: x.cn || '' };
        if (x.sentence || x.translation) return { de: x.sentence || '', cn: x.translation || '' };
        return null;
      }).filter(Boolean);
    }

    return { id: e.id || base, headword, base, pos, article: article || '', gender: gender || '', plural, examples };
  }

  async getDictEntry(wordDe) {
    await this._ensureDictLoaded();
    if (!this.dictData || this.dictData.length === 0) return null;
    const key = this._normBase(wordDe);
    for (const e of this.dictData) {
      const b = this._extractBase(e);
      if (b && b === key) return this._normalizeEntry(e);
    }
    return null;
  }

  async _fromLocalDict(word) {
    const entry = await this.getDictEntry(word);
    if (!entry) return null;
    const ex = Array.isArray(entry.examples) && entry.examples.length > 0 ? entry.examples[0] : null;
    if (ex && (ex.de || ex.sentence)) {
      const de = ex.de || ex.sentence || '';
      const cn = ex.cn || ex.translation || '';
      return { de, cn };
    }
    return null;
  }


  // ---------- 2. AI Fallback ----------
  async _getAiFallback(wordDe, wordCn) {
    if (!this.aiService || !this.aiService.apiKey) return null;
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
