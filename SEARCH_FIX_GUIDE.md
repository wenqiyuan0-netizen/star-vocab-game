# 词形还原搜索修复指南

## 问题诊断

### 原始问题
用户搜索 `Auffahrten`（复数）时，无法找到原型 `Auffahrt`（单数）。

### 根本原因分析

1. **数据分布问题**：
   - ✅ **本地** Common 词汇（25,000 词）：`public/dict/common_2500.json` - 包含基础词和中文翻译
   - ✅ **云端** Rare 词汇（324K 词）：Supabase `dictionary` 表 - 仅包含词形变化，无基础词
   - ✅ **云端** 词形索引（1.48M 条）：Supabase `search_index` 表 - 变体 → 原型映射

2. **搜索逻辑缺陷**：
   - ❌ 原有搜索只查本地或云端的**精确匹配**
   - ❌ **没有词形还原**功能
   - ❌ **没有本地→云端回退**机制

3. **数据问题示例**：
   ```
   输入: "Auffahrten"

   本地 common_2500.json:
   ✅ 有 "Auffahrt" (原型，带中文翻译)
   ❌ 没有 "Auffahrten"

   云端 dictionary 表:
   ❌ 没有名词 "Auffahrt" (原型)
   ✅ 有 "Auffahrten" (变体)

   云端 search_index 表:
   ✅ "auffahrten" → lemma_id → "Auffahrten" (错误！指向变体而非原型)
   ```

## 解决方案

### 已实现的功能

#### 1. 词形还原服务 (`lemmatizationService.js`)
```javascript
import { lemmatizationService } from './utils/lemmatizationService';

// 查询单个词
const results = await lemmatizationService.findLemma('Auffahrten');
// 返回: [{ word: 'Auffahrt', pos: 'noun', ... }]
```

**功能**：
- 通过 Supabase `search_index` 表查询变体
- 返回对应的原型词条
- 支持批量查询

#### 2. 统一搜索服务 (`unifiedDictionarySearch.js`)
```javascript
import { unifiedSearch } from './utils/unifiedDictionarySearch';

// 智能搜索（自动尝试所有方法）
const result = await unifiedSearch.search('Auffahrten');
```

**搜索流程**（按优先级）：
1. **本地 Common 词典**（精确匹配）→ 最快，有中文翻译
2. **云端 Dictionary 表**（精确匹配）→ Rare 词汇
3. **云端词形还原**（search_index）→ 找原型

**返回格式**：
```javascript
{
  found: true,
  source: 'cloud_rare_lemma',      // 数据来源
  searchMethod: 'lemmatization',   // 搜索方法
  originalWord: 'Auffahrten',      // 输入词
  lemmas: ['Auffahrt'],            // 找到的原型
  entries: [...]                   // 词条详情
}
```

#### 3. 测试工具
```javascript
// 浏览器控制台
import { testUnifiedSearch, searchWord } from './utils/testUnifiedSearch';

// 全面测试
testUnifiedSearch();

// 搜索单个词
searchWord('Auffahrten');
```

## 使用方法

### 方式 1：在应用中集成

更新你的搜索组件：

```javascript
import { unifiedSearch } from './utils/unifiedDictionarySearch';

async function handleSearch(word) {
  const result = await unifiedSearch.search(word);

  if (result.found) {
    // 显示结果
    console.log(`找到 ${result.entries.length} 个结果`);

    // 如果是词形还原找到的
    if (result.searchMethod === 'lemmatization') {
      console.log(`"${result.originalWord}" 的原型: ${result.lemmas.join(', ')}`);
    }

    // 显示词条
    result.entries.forEach(entry => {
      console.log(`${entry.w} (${entry.p}): ${entry.c?.[0] || entry.e?.[0]}`);
    });
  } else {
    console.log(`未找到 "${word}"`);
    console.log(result.message); // 提示已尝试的方法
  }
}
```

### 方式 2：浏览器控制台测试

1. 启动应用：`npm start`
2. 打开浏览器开发者工具
3. 在控制台输入：
   ```javascript
   // 自动挂载的测试函数
   window.searchWord('Auffahrten')

   // 或运行完整测试
   window.testUnifiedSearch()
   ```

### 方式 3：Node.js 脚本测试

已创建的验证脚本：
```bash
# 检查 Supabase 数据
node scripts/verify-lemmatization.js

# 检查数据结构
node scripts/inspect-data.js

# 查找原型
node scripts/find-lemmas.js
```

## 数据问题修复

### 问题：search_index 指向错误

当前 `search_index` 表的问题：
```sql
-- 当前（错误）
variant: 'auffahrten' → lemma_id: 2097248530 → word: 'Auffahrten' (变体)

-- 应该是（正确）
variant: 'auffahrten' → lemma_id: XXX → word: 'Auffahrt' (原型)
```

### 解决方案选项

#### 选项 A：重新生成索引数据（推荐）
需要在 ETL 项目中修复索引生成逻辑，确保：
- `search_index.lemma_id` 指向真正的原型词条
- 原型词条（如 "Auffahrt"）必须存在于 `dictionary` 表中

#### 选项 B：补充基础词到云端
将 Common 词汇（25K）导入到 Supabase `dictionary` 表：
```bash
node scripts/import-common-to-supabase.js
```

**优点**：
- 云端有完整的基础词
- 词形还原可以找到正确的原型

**缺点**：
- 增加云端存储和查询成本
- 本地已有这些数据（重复）

#### 选项 C：混合方案（当前实现）✅
保持现状，使用智能回退：
1. 本地查基础词（快速，有中文）
2. 云端查罕见词和变体
3. 词形还原作为补充

**优点**：
- 不需要重新导入数据
- 充分利用现有资源
- 性能最优

## 验证步骤

### 1. 检查服务状态
```javascript
const status = await unifiedSearch.checkStatus();
console.log(status);
// 应该全部为 true:
// { localCommon: true, cloudDictionary: true, cloudLemmatization: true }
```

### 2. 测试基础词（本地）
```javascript
await searchWord('Haus');    // 应该从本地找到
await searchWord('und');     // 应该从本地找到
```

### 3. 测试词形还原
```javascript
await searchWord('Auffahrten');  // 应该通过词形还原找到 Auffahrt
await searchWord('Häuser');      // 应该找到 Haus
await searchWord('lernten');     // 应该找到 lernen
```

### 4. 测试不存在的词
```javascript
await searchWord('asdfghjkl');   // 应该返回未找到，并提示已尝试的方法
```

## 文件清单

### 核心服务
- `src/utils/lemmatizationService.js` - 词形还原核心服务
- `src/utils/unifiedDictionarySearch.js` - 统一搜索服务（集成所有功能）
- `src/utils/localDictionary.js` - 本地词典查询（已存在）
- `src/utils/cloudDictionaryStorage.js` - 云端词典（已更新）

### 测试工具
- `src/utils/testUnifiedSearch.js` - 浏览器测试工具
- `src/utils/testLemmatization.js` - 词形还原测试
- `scripts/verify-lemmatization.js` - Supabase 数据验证
- `scripts/inspect-data.js` - 数据结构检查
- `scripts/find-lemmas.js` - 查找原型词条

### 文档
- `LEMMATIZATION_GUIDE.md` - 词形还原功能详细文档
- `SEARCH_FIX_GUIDE.md` - 本文件

## 下一步

### 立即可用
1. ✅ 词形还原服务已就绪
2. ✅ 统一搜索服务已创建
3. ✅ 测试工具已准备

### 待集成
1. 在应用的搜索组件中使用 `unifiedSearch.search()`
2. 在用户点击单词时调用词形还原
3. 在搜索结果中显示"原型提示"

### 可选优化
1. 添加搜索结果缓存（减少重复查询）
2. 实现预加载（应用启动时预热索引）
3. 添加搜索历史记录
4. 支持模糊搜索和拼写建议

## 故障排查

### 问题 1：search_index 表不可用
**症状**：`lemmatizationService.isAvailable()` 返回 false

**解决**：
1. 检查 Supabase 连接
2. 确认 `search_index` 表已创建
3. 检查 RLS 策略是否允许读取

### 问题 2：找不到原型
**症状**：`searchWord('Auffahrten')` 返回空结果

**可能原因**：
1. `search_index` 中没有该词的索引
2. 索引指向的 `lemma_id` 不存在
3. 网络问题导致查询失败

**调试**：
```javascript
// 直接测试词形还原服务
const results = await lemmatizationService.findLemma('auffahrten');
console.log(results);

// 检查 search_index 表
// 在 Supabase SQL Editor 执行：
SELECT * FROM public.search_index WHERE variant = 'auffahrten';
```

### 问题 3：本地词典加载失败
**症状**：本地查询总是失败

**解决**：
1. 检查 `public/dict/common_2500.json` 是否存在
2. 检查文件路径配置
3. 查看浏览器控制台错误信息

## 总结

✅ **已解决**：
- 创建了完整的词形还原服务
- 实现了本地→云端→词形还原的智能搜索
- 提供了测试和验证工具

⚠️ **当前限制**：
- `search_index` 数据质量问题（部分索引指向变体而非原型）
- 需要在应用搜索功能中集成 `unifiedSearch`

🎯 **建议**：
- 使用 `unifiedSearch.search()` 替换现有搜索逻辑
- 在 UI 中显示词形还原提示
- 考虑是否需要修复 `search_index` 数据
