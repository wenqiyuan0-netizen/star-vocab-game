# 词库统一搜索 + Enrichment系统 - 实施计划v2

## 🎯 用户体验设计

### 核心流程

    ```mermaid
graph TD
    A[词库搜索框] --> B{输入类型}
    B -->|德语| C[搜索]
    B -->|中文| C
    C --> D[用户词库结果]
    C --> E[本地词典结果]
    D --> F[✓ 已在词库]
    E --> G[★ 未加入]
    F --> H[点击查看详情]
    G --> I[点击加入词库]
    I --> J[自动enrichment]
    J --> K[成功添加]
```

### 搜索结果展示

    ```
┌─【搜索: lernen】─────────────────┐
│                                  │
│ 📚 已在词库 (1)                   │
│ ✓ lernen | 学习                   │
│   已学习 3 次                      │
│                                  │
│ ⭐ 本地词典 (2)                   │
│ ★ lernen (verb) | [未加入]        │
│   发音: /ˈlɛʁnən/                 │
│   → 点击查看详情/加入               │
│                                  │
│ ★ Lernen (noun) | [未加入]        │
│   学习（名词）                     │
│   → 点击加入                       │
└──────────────────────────────────┘
```

---

## 🏗️ 技术架构

### 1. 统一搜索服务

    < function_calls >
    <invoke name="write_to_file">
        <parameter name="CodeContent">// services/UnifiedSearchService.js

            class UnifiedSearchService {
                constructor(globalWordDb, dictionaryService) {
                this.wordDb = globalWordDb;
            this.dictService = dictionaryService;
  }

  /**
   * 统一搜索：词库 + 词典
   * @param {string} query - 德语或中文
            * @returns {Object} {inLibrary: [], inDictionary: [] }
            */
            async search(query) {
    const results = {
                inLibrary: [],
            inDictionary: [],
            query: query.trim()
    };

            // 1. 搜索用户词库
            results.inLibrary = this.searchLibrary(query);

            // 2. 搜索本地词典（排除已在词库的）
            if (this.isGerman(query)) {
      const dictResults = await this.dictService.lookup(query);
      const libraryIds = new Set(results.inLibrary.map(w => w.de.toLowerCase()));

            results.inDictionary = dictResults
        .filter(entry => !libraryIds.has(entry.w.toLowerCase()))
        .map(entry => ({
                ...entry,
                inLibrary: false,
            canAdd: true
        }));
    } else {
                // 中文搜索：遍历词典（可能慢，需优化）
                results.inDictionary = await this.searchDictionaryByChinese(query);
    }

            return results;
  }

            /**
             * 搜索用户词库
             */
            searchLibrary(query) {
    const lower = query.toLowerCase();
    
    return this.wordDb.filter(word => {
      // 德语匹配
      if (word.de.toLowerCase().includes(lower)) return true;

            // 中文匹配
            if (word.cn.includes(query)) return true;

      // 英文匹配（如果有）
      if (word.english && word.english.some(en => en.toLowerCase().includes(lower))) return true;

            return false;
    }).map(word => ({
                ...word,
                inLibrary: true,
            matchType: word.de.toLowerCase() === lower ? 'exact' : 'partial'
    }));
  }

            /**
             * 判断是否德语
             */
            isGerman(text) {
    // 简单判断：包含德语字符或全是拉丁字母
    return /^[a-zA-ZäöüÄÖÜß\s-]+$/.test(text);
  }

            /**
             * 中文搜索词典（需要词典支持，或缓存）
             */
            async searchDictionaryByChinese(chinese) {
    // 如果词典已有中文索引
    if (this.dictService.hasChineseIndex) {
      return await this.dictService.searchByChinese(chinese);
    }

            // 否则，提示需要先翻译词典
            return [];
  }
}

            export const unifiedSearchService = new UnifiedSearchService();
