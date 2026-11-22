# 词形还原功能使用指南

## 概述

词形还原（Lemmatization）功能允许通过词形变化查询原型词条。例如：
- `Auffahrten`（复数）→ `Auffahrt`（单数原型）
- `Häuser`（复数）→ `Haus`（单数原型）
- `lernten`（过去式）→ `lernen`（动词原形）

## 技术实现

### 数据表结构

**Supabase 表：**

1. **`dictionary` 表** - 存储原型词条（~324K 词条）
   - `id`: 词条 ID
   - `word`: 原型词
   - `pos`: 词性
   - `translation`: 英文翻译
   - `translation_cn`: 中文翻译
   - 等等...

2. **`search_index` 表** - 存储词形变化索引（~500K 索引）
   - `variant`: 词形变化（如 `auffahrten`）
   - `lemma_id`: 指向 `dictionary.id`（原型）

### 服务层

**`lemmatizationService.js`** - 核心词形还原服务：
- `findLemma(variant)` - 查询单个词形
- `findLemmaBatch(variants)` - 批量查询
- `isAvailable()` - 检查服务状态

**`cloudDictionaryStorage.js`** - 云端词典（已集成词形还原）：
- `get(word, pos, useLemmatization)` - 自动词形还原查询

## 使用方法

### 1. 直接使用词形还原服务

```javascript
import { lemmatizationService } from './utils/lemmatizationService';

// 查询单个词
const results = await lemmatizationService.findLemma('Auffahrten');
console.log(results);
// [
//   { id: 123, word: 'Auffahrt', pos: 'noun', translation_cn: '上坡；入口', ... }
// ]

// 批量查询
const batchResults = await lemmatizationService.findLemmaBatch(['Auffahrten', 'Häuser']);
console.log(batchResults);
// {
//   'auffahrten': [{ word: 'Auffahrt', ... }],
//   'häuser': [{ word: 'Haus', ... }]
// }
```

### 2. 通过云端词典查询（推荐）

```javascript
import { cloudDict } from './utils/cloudDictionaryStorage';

// 自动词形还原（默认启用）
const results = await cloudDict.get('Auffahrten');
console.log(results);
// [{ word: 'Auffahrt', pos: 'noun', ... }]

// 禁用词形还原（仅精确匹配）
const exactResults = await cloudDict.get('Auffahrten', null, false);
```

### 3. 在浏览器控制台测试

```javascript
// 方法 1：导入测试文件
import { testLemmatization, testMultipleWords } from './utils/testLemmatization';

// 测试单个词
testLemmatization('Auffahrten');

// 批量测试
testMultipleWords();

// 方法 2：直接使用（开发环境自动挂载）
window.testLemmatization('Auffahrten');
window.testMultipleWords();
```

## 验证数据导入

### 检查 search_index 表是否有数据

在 Supabase SQL Editor 中运行：

```sql
-- 检查索引表记录数
SELECT COUNT(*) FROM public.search_index;

-- 查看示例数据
SELECT * FROM public.search_index LIMIT 10;

-- 测试词形还原
SELECT
    si.variant,
    d.word AS lemma,
    d.pos,
    d.translation_cn
FROM public.search_index si
JOIN public.dictionary d ON si.lemma_id = d.id
WHERE si.variant = 'auffahrten';
```

### 检查 dictionary 表

```sql
-- 检查词典表记录数
SELECT COUNT(*) FROM public.dictionary;

-- 查找特定词条
SELECT * FROM public.dictionary WHERE LOWER(word) = 'auffahrt';
```

## 故障排查

### 问题 1：search_index 表不存在

**症状**：查询时报错 "relation 'search_index' does not exist"

**解决方案**：
1. 在 Supabase Dashboard → SQL Editor 中执行 `goethe-pdf-vocab-extractor/supabase_setup.sql`
2. 确认表创建成功：
   ```sql
   SELECT table_name FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name = 'search_index';
   ```

### 问题 2：search_index 表为空

**症状**：查询返回空结果

**解决方案**：
1. 检查是否已导入数据：
   ```sql
   SELECT COUNT(*) FROM public.search_index;
   ```
2. 如果为 0，需要导入 `supabase_import_index.csv`：
   - 方法 A：使用 Supabase Dashboard 的 Table Editor → Import Data
   - 方法 B：运行 `goethe-pdf-vocab-extractor/import_to_supabase.js`

### 问题 3：权限错误

**症状**：查询时报 "permission denied"

**解决方案**：
检查 RLS 策略：
```sql
-- 查看现有策略
SELECT * FROM pg_policies WHERE tablename = 'search_index';

-- 如果没有读取策略，创建一个
DROP POLICY IF EXISTS "Allow public read access on search_index" ON public.search_index;
CREATE POLICY "Allow public read access on search_index"
ON public.search_index FOR SELECT TO public USING (true);
```

### 问题 4：词形还原无结果但词条存在

**症状**：`Auffahrt` 在 dictionary 表中，但 `Auffahrten` 查不到

**可能原因**：
1. `search_index` 表中没有该词形变化记录
2. 词形大小写不匹配（应该都是小写）

**检查方法**：
```sql
-- 检查索引中是否有该词形
SELECT * FROM public.search_index WHERE variant = 'auffahrten';

-- 检查原型是否存在
SELECT * FROM public.dictionary WHERE LOWER(word) = 'auffahrt';

-- 如果两个都存在，检查关联
SELECT
    si.variant,
    si.lemma_id,
    d.id,
    d.word
FROM public.search_index si
LEFT JOIN public.dictionary d ON si.lemma_id = d.id
WHERE si.variant = 'auffahrten';
```

## 性能优化

### 索引优化

确保以下索引存在（已包含在 `supabase_setup.sql` 中）：

```sql
-- search_index 表索引
CREATE INDEX IF NOT EXISTS idx_search_index_variant
ON public.search_index(variant);

CREATE INDEX IF NOT EXISTS idx_search_index_lemma_id
ON public.search_index(lemma_id);

-- dictionary 表索引
CREATE INDEX IF NOT EXISTS idx_dictionary_word
ON public.dictionary(word);

CREATE INDEX IF NOT EXISTS idx_dictionary_id
ON public.dictionary(id);
```

### 缓存策略

词形还原结果可以缓存到本地：

```javascript
// 实现本地缓存（可选）
const lemmaCache = new Map();

async function cachedFindLemma(variant) {
    if (lemmaCache.has(variant)) {
        return lemmaCache.get(variant);
    }

    const results = await lemmatizationService.findLemma(variant);
    lemmaCache.set(variant, results);
    return results;
}
```

## 下一步

1. **在应用中集成**：
   - 更新搜索组件使用新的 API
   - 在单词卡片中显示词形变化
   - 添加"查看原型"链接

2. **增强功能**：
   - 添加反向查询（原型 → 所有变位）
   - 显示词形变化表
   - 支持模糊搜索

3. **用户体验**：
   - 搜索无结果时自动提示"是否查找原型"
   - 高亮显示匹配的词形变化

## 相关文件

- `src/utils/lemmatizationService.js` - 词形还原服务
- `src/utils/cloudDictionaryStorage.js` - 云端词典（已集成）
- `src/utils/testLemmatization.js` - 测试工具
- `goethe-pdf-vocab-extractor/supabase_setup.sql` - 数据库设置
- `goethe-pdf-vocab-extractor/supabase_import_index.csv` - 索引数据

## 参考资料

- [Supabase 文档](https://supabase.com/docs)
- [PostgreSQL 外键约束](https://www.postgresql.org/docs/current/ddl-constraints.html)
- [德语词形变化规则](https://en.wikipedia.org/wiki/German_declension)
