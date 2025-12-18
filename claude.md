# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**Star Vocab Game (星际词汇大作战)** 是一款结合街机射击玩法与间隔重复系统 (SRS) 的德语学习应用。采用 React 19 + Supabase + Electron 技术栈，支持本地离线使用和云端同步。

### 技术栈
- **前端**: React 19, Tailwind CSS, Canvas API
- **后端**: Supabase (PostgreSQL + Auth)
- **桌面**: Electron
- **AI**: Google Gemini API (例句生成)
- **构建**: Create React App

### 核心命令
```bash
# 开发
npm start                    # Web 开发服务器 (http://localhost:3000)
npm run electron:dev         # Electron 开发模式

# 构建
npm run build                # 构建 Web 应用
npm run electron:pack        # 打包 Electron 应用

# 测试
npm test                     # 运行测试
```

---

## 🚨 重要迁移任务：添加词性 (POS) 支持

### 背景与问题

#### 当前架构的局限性
1. **数据模型不完整**：
   - 前端代码在 `WordProcessor.js` 中提取了 `pos` (词性) 字段
   - 但 **没有存储** 到 word 对象中，导致数据丢失
   - 数据库表 `user_words` 也缺少 `pos` 列

2. **ID 生成策略冲突**：
   - ETL 流程使用 `generate_stable_id(word, pos)` 生成 ID
   - 前端使用临时 ID `c_${timestamp}_${random}`
   - 云端使用 UUID (`gen_random_uuid()`)
   - **三者不一致，导致数据同步混乱**

3. **去重逻辑不精确**：
   - 当前使用 `(user_id, de_norm)` 作为唯一键
   - 无法区分同一单词的不同词性（如 "laufen" 作为动词 vs 名词）

#### 目标
实现统一的 ID 生成策略：
- 使用 `generate_stable_id(word, pos)` 在前端和 ETL 中生成一致的整数 ID
- 添加 `pos` 字段到数据模型和数据库
- 保证跨端数据同步的准确性

---

## 📋 完整实施步骤

### Phase 1: 数据库架构升级

#### Step 1.1: 添加 pos 列

创建迁移脚本 `supabase/migrations/add_pos_field.sql`:

```sql
-- ============================================
-- Migration: Add pos field and change ID type
-- Date: 2025-12-15
-- ============================================

-- 1. 添加 pos 列
ALTER TABLE public.user_words
ADD COLUMN IF NOT EXISTS pos text;

-- 2. 为现有数据填充默认值
UPDATE public.user_words
SET pos = CASE
  WHEN gender IN ('m', 'f', 'n') THEN 'noun'
  ELSE 'unknown'
END
WHERE pos IS NULL;

-- 3. 修改 ID 类型为 bigint
-- 注意：此操作需要小心处理外键约束
ALTER TABLE public.user_words
ALTER COLUMN id TYPE bigint USING id::text::bigint;

-- 4. 更新约束（如果需要支持同一单词的多个词性）
-- 选项 A: 保持原有约束 (user_id, de_norm)
--   适用于：用户只需要一个词条，不区分词性
-- 选项 B: 更改为 (user_id, de_norm, pos)
--   适用于：用户需要学习同一单词的多个词性

-- 如果选择选项 B，执行以下语句：
-- ALTER TABLE public.user_words
-- DROP CONSTRAINT IF EXISTS user_words_user_id_de_norm_key;
-- ALTER TABLE public.user_words
-- ADD CONSTRAINT user_words_user_id_de_norm_pos_key
-- UNIQUE (user_id, de_norm, pos);

-- 5. 添加索引优化查询
CREATE INDEX IF NOT EXISTS idx_user_words_pos
ON public.user_words(pos);

-- 6. 注释说明
COMMENT ON COLUMN public.user_words.pos IS 'Part of speech: noun, verb, adj, adv, etc.';
```

#### Step 1.2: 执行迁移

```bash
# 在 Supabase Dashboard 的 SQL Editor 中执行上述脚本
# 或使用 Supabase CLI:
# supabase db push
```

#### Step 1.3: 验证迁移

```sql
-- 检查表结构
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'user_words';

-- 检查数据
SELECT id, de, pos, gender
FROM public.user_words
LIMIT 10;
```

---

### Phase 2: 前端代码修改

#### Step 2.1: 创建 ID 生成工具函数

创建文件 `src/utils/idUtils.js`:

```javascript
/**
 * ID Generation Utilities
 *
 * 生成基于词条和词性的稳定整数 ID，确保跨端一致性
 */

/**
 * 生成稳定的整数 ID
 *
 * 算法说明：
 * 1. 组合 word 和 pos 生成签名字符串（小写）
 * 2. 使用简单的字符串哈希函数生成 32 位整数
 * 3. 确保 ID 为正整数（取绝对值）
 *
 * @param {string} word - 词条（如 "Haus"）
 * @param {string} pos - 词性（如 "noun"）
 * @returns {number} - 稳定的正整数 ID
 *
 * @example
 * generateStableId("Haus", "noun")  // 总是返回相同的整数
 * generateStableId("haus", "noun")  // 与上面相同（不区分大小写）
 */
export const generateStableId = (word, pos) => {
  // 标准化输入
  const signature = `${word}:${pos}`.toLowerCase();

  // 简单的字符串哈希算法（32位）
  let hash = 0;
  for (let i = 0; i < signature.length; i++) {
    const char = signature.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // 确保为正整数
  return Math.abs(hash);
};

/**
 * 检测是否为临时 ID
 *
 * @param {string|number} id
 * @returns {boolean}
 */
export const isTemporaryId = (id) => {
  return typeof id === 'string' && id.startsWith('c_');
};

/**
 * 检测是否为 UUID
 *
 * @param {string|number} id
 * @returns {boolean}
 */
export const isUuid = (id) => {
  if (typeof id !== 'string') return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(id);
};

/**
 * 检测是否为稳定整数 ID
 *
 * @param {string|number} id
 * @returns {boolean}
 */
export const isStableId = (id) => {
  return typeof id === 'number' && id > 0;
};
```

#### Step 2.2: 修改 WordProcessor.js

文件路径: `src/features/vocabulary/services/WordProcessor.js`

```javascript
// 在文件顶部添加导入
import { generateStableId } from '../../../utils/idUtils';

// 修改 processImportInput 函数中的 newWords.push 部分（约第 60 行）
export const processImportInput = (inputText, currentDb) => {
  // ... 前面的代码保持不变 ...

  lines.forEach(line => {
    // ... 提取逻辑保持不变 ...

    if (deClean && cn) {
      existingFingerprints.add(deClean.toLowerCase());

      // ⚠️ 重要修改：使用新的 ID 生成函数
      const finalPos = pos || 'unknown';

      newWords.push({
        id: generateStableId(deClean, finalPos), // ← 使用新函数
        de: deClean,
        cn,
        gender,
        pos: finalPos, // ← 新增：保存 pos 字段
        state: 'new',
        step: 0,
        interval: 0,
        easeFactor: 2.5,
        dueDate: 0,
        proficiency: 0,          // ← 确保有默认值
        graduated: false,        // ← 确保有默认值
        lastReview: null,        // ← 确保有默认值
        example: null,
      });
    }
  });

  // ... 后面的代码保持不变 ...
};
```

#### Step 2.3: 修改 supabaseUtils.js

文件路径: `src/utils/supabaseUtils.js`

```javascript
// 在文件顶部添加导入
import { isStableId } from './idUtils';

// 修改 appWordToDbWord 函数
export const appWordToDbWord = (appWord, userId) => {
  const dbWord = {
    user_id: userId,
    de: appWord.de,
    cn: appWord.cn,
    gender: normalizeGender(appWord.gender) || null,
    pos: appWord.pos || 'unknown', // ← 新增：pos 字段
    state: appWord.state,
    step: appWord.step,
    interval: appWord.interval,
    ease_factor: appWord.easeFactor,
    due_date: appWord.dueDate ? new Date(appWord.dueDate).toISOString() : null,
    proficiency: appWord.proficiency || 0,
    graduated: appWord.graduated || false,
    last_review: appWord.lastReview ? new Date(appWord.lastReview).toISOString() : null,
    fsrs: appWord.fsrs || null,
    is_deleted: appWord.isDeleted || false,
    local_updated_at: appWord.localUpdatedAt ? new Date(appWord.localUpdatedAt).toISOString() : new Date().toISOString()
  };

  // ⚠️ 重要修改：接受稳定 ID，不再过滤
  if (isStableId(appWord.id)) {
    dbWord.id = appWord.id;
  }
  // 不再需要 isValidUuid 检查，因为我们使用整数 ID

  return dbWord;
};

// 修改 dbWordToAppWord 函数
export const dbWordToAppWord = (dbWord) => {
  return {
    id: dbWord.id,
    de: dbWord.de,
    cn: dbWord.cn,
    gender: dbWord.gender,
    pos: dbWord.pos || 'unknown', // ← 新增：pos 字段
    state: dbWord.state,
    step: dbWord.step,
    interval: dbWord.interval,
    easeFactor: dbWord.ease_factor,
    dueDate: dbWord.due_date ? new Date(dbWord.due_date).getTime() : 0,
    proficiency: dbWord.proficiency,
    graduated: dbWord.graduated,
    lastReview: dbWord.last_review ? new Date(dbWord.last_review).getTime() : null,
    fsrs: dbWord.fsrs || null,
    isDeleted: dbWord.is_deleted || false,
    localUpdatedAt: dbWord.local_updated_at ? new Date(dbWord.local_updated_at).getTime() : 0
  };
};

// 移除或更新 isValidUuid 函数
// const isValidUuid = (id) => {
//   const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
//   return regex.test(id);
// };
```

#### Step 2.4: 修改 useSupabaseData.js

文件路径: `src/shared/hooks/useSupabase/useSupabaseData.js`

```javascript
// 在文件顶部添加导入
import { isStableId } from '../../../utils/idUtils';

// 修改 syncWordsBatch 函数中的合并逻辑（约第 100-120 行）
const syncWordsBatch = async (wordsToSync) => {
  if (!user || wordsToSync.length === 0) return;
  try {
    const now = Date.now();
    const payload = wordsToSync.map(w => appWordToDbWord({ ...w, localUpdatedAt: now }, user.id));

    const { data, error } = await supabase
      .from('user_words')
      .upsert(payload, { onConflict: 'user_id, de_norm' })
      .select();

    if (error) throw error;

    const syncedWords = data.map(dbWordToAppWord);
    setWords(prev => {
      const contentMap = new Map();
      const idMap = new Map();

      // ⚠️ 更新 ID 检测逻辑
      // Helper: 检测是否为稳定 ID
      const isValidId = (id) => isStableId(id);

      // 1. Index local words
      prev.forEach(w => {
        if (isValidId(w.id)) {
          idMap.set(w.id, w);
        } else {
          // 临时 ID，使用内容作为 key
          const key = `${(w.de || '').toLowerCase()}:${w.pos || 'unknown'}`;
          contentMap.set(key, w);
        }
      });

      // 2. Merge synced words
      syncedWords.forEach(w => {
        const key = `${(w.de || '').toLowerCase()}:${w.pos || 'unknown'}`;

        if (idMap.has(w.id)) {
          // ID 匹配，直接更新
          idMap.set(w.id, { ...idMap.get(w.id), ...w });
        } else if (contentMap.has(key)) {
          // 内容匹配，更新 ID
          const localWord = contentMap.get(key);
          idMap.set(w.id, { ...localWord, ...w });
          contentMap.delete(key);
        } else {
          // 新词条
          idMap.set(w.id, w);
        }
      });

      // 3. 合并结果
      return [...idMap.values(), ...contentMap.values()];
    });

    return syncedWords;
  } catch (err) {
    console.error('Error syncing words batch:', err);
    setError(err.message);
    return null;
  }
};
```

#### Step 2.5: 更新 constants.js 中的默认数据

文件路径: `src/logic/constants.js`

```javascript
import { generateStableId } from '../utils/idUtils';

export const DEFAULT_WORDS = [
  {
    id: generateStableId('Apfel', 'noun'),
    de: 'Apfel',
    cn: '苹果',
    pos: 'noun',
    gender: 'm',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    example: null
  },
  {
    id: generateStableId('Morgen', 'noun'),
    de: 'Morgen',
    cn: '早上',
    pos: 'noun',
    gender: 'm',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    example: null
  },
  {
    id: generateStableId('Liebe', 'noun'),
    de: 'Liebe',
    cn: '爱',
    pos: 'noun',
    gender: 'f',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    example: null
  },
  {
    id: generateStableId('Katze', 'noun'),
    de: 'Katze',
    cn: '猫',
    pos: 'noun',
    gender: 'f',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    example: null
  },
  {
    id: generateStableId('Hund', 'noun'),
    de: 'Hund',
    cn: '狗',
    pos: 'noun',
    gender: 'm',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    example: null
  },
  {
    id: generateStableId('Haus', 'noun'),
    de: 'Haus',
    cn: '房子',
    pos: 'noun',
    gender: 'n',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    example: null
  },
  {
    id: generateStableId('Wasser', 'noun'),
    de: 'Wasser',
    cn: '水',
    pos: 'noun',
    gender: 'n',
    state: 'new',
    step: 0,
    interval: 0,
    easeFactor: 2.5,
    dueDate: 0,
    example: null
  },
];
```

---

### Phase 3: ETL 流程调整

#### Step 3.1: 更新 ETL 脚本使用相同的哈希函数

⚠️ **注意**: 原 ETL 项目 (`goethe-pdf-vocab-extractor`) 已废弃。所有词汇数据已导入到 Supabase，ETL 功能已集成到本项目中。

如需参考 ETL 脚本中的哈希函数实现：

```python
def generate_stable_id(word: str, pos: str) -> int:
    """
    生成稳定的整数 ID（与前端 JavaScript 版本保持一致）

    Args:
        word: 词条
        pos: 词性

    Returns:
        正整数 ID
    """
    signature = f"{word}:{pos}".lower()

    # 使用与 JavaScript 相同的哈希算法
    hash_value = 0
    for char in signature:
        hash_value = ((hash_value << 5) - hash_value) + ord(char)
        # 转换为 32 位整数
        hash_value = hash_value & 0xFFFFFFFF

    # 转换为有符号整数
    if hash_value > 0x7FFFFFFF:
        hash_value -= 0x100000000

    return abs(hash_value)
```

#### Step 3.2: 确保 ETL 输出包含 pos 字段

在处理 Common_Vocab_local.json 和 Rare_Vocab_cloud.json 时：

```python
# 读取和处理词典
for entry in common_entries:
    word = entry['word']
    pos = entry.get('pos', 'unknown')  # 确保有 pos 字段

    # 生成 ID
    id_value = generate_stable_id(word, pos)
    entry['id'] = id_value

    # 确保所有必需字段存在
    entry.setdefault('pos', pos)
    entry.setdefault('proficiency', 0)
    entry.setdefault('graduated', False)
```

---

### Phase 4: 本地存储兼容性处理

#### Step 4.1: 创建迁移工具

创建文件 `src/utils/localStorageMigration.js`:

```javascript
import { generateStableId } from './idUtils';

/**
 * 迁移本地存储的旧数据
 * 将临时 ID 或 UUID 转换为稳定 ID
 */
export const migrateLocalStorage = () => {
  const key = 'vocab_game_db';
  const data = localStorage.getItem(key);

  if (!data) return false;

  try {
    const words = JSON.parse(data);
    let migrated = false;

    const updatedWords = words.map(word => {
      // 检查是否需要迁移
      if (typeof word.id === 'string' || !word.pos) {
        migrated = true;
        const pos = word.pos || (word.gender ? 'noun' : 'unknown');
        return {
          ...word,
          id: generateStableId(word.de, pos),
          pos: pos,
        };
      }
      return word;
    });

    if (migrated) {
      localStorage.setItem(key, JSON.stringify(updatedWords));
      console.log('✅ Local storage migrated successfully');
      return true;
    }

    return false;
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return false;
  }
};
```

#### Step 4.2: 在应用启动时执行迁移

在 `src/features/game/SpaceVocabGame.js` 的 useEffect 中：

```javascript
import { migrateLocalStorage } from '../../utils/localStorageMigration';

// 在组件挂载时执行迁移
useEffect(() => {
  // 尝试迁移本地数据
  const migrated = migrateLocalStorage();
  if (migrated) {
    console.log('📦 Old data migrated to new format');
  }

  // ... 其他初始化逻辑 ...
}, []);
```

---

### Phase 5: 测试与验证

#### Step 5.1: 单元测试

创建文件 `src/utils/__tests__/idUtils.test.js`:

```javascript
import { generateStableId, isTemporaryId, isStableId } from '../idUtils';

describe('ID Utils', () => {
  describe('generateStableId', () => {
    it('should generate consistent IDs for same inputs', () => {
      const id1 = generateStableId('Haus', 'noun');
      const id2 = generateStableId('Haus', 'noun');
      expect(id1).toBe(id2);
    });

    it('should be case-insensitive', () => {
      const id1 = generateStableId('Haus', 'noun');
      const id2 = generateStableId('haus', 'NOUN');
      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different POS', () => {
      const id1 = generateStableId('laufen', 'verb');
      const id2 = generateStableId('laufen', 'noun');
      expect(id1).not.toBe(id2);
    });

    it('should always return positive integers', () => {
      const id = generateStableId('Test', 'noun');
      expect(id).toBeGreaterThan(0);
      expect(Number.isInteger(id)).toBe(true);
    });
  });

  describe('isTemporaryId', () => {
    it('should detect temporary IDs', () => {
      expect(isTemporaryId('c_1234567890_abc')).toBe(true);
      expect(isTemporaryId(12345)).toBe(false);
    });
  });

  describe('isStableId', () => {
    it('should detect stable IDs', () => {
      expect(isStableId(12345)).toBe(true);
      expect(isStableId('c_123')).toBe(false);
      expect(isStableId(-123)).toBe(false);
    });
  });
});
```

运行测试：
```bash
npm test -- idUtils.test.js
```

#### Step 5.2: 集成测试清单

**测试场景 1: 新用户创建词条**
1. 清空本地存储和云端数据
2. 导入新词条（如 "Apfel;苹果"）
3. 验证：
   - ✅ 本地生成稳定 ID（整数）
   - ✅ pos 字段正确（noun/unknown）
   - ✅ 同步到云端后 ID 保持不变

**测试场景 2: 老用户数据迁移**
1. 准备带有旧格式 ID 的测试数据
2. 刷新应用
3. 验证：
   - ✅ 自动触发迁移
   - ✅ ID 转换为稳定 ID
   - ✅ 添加 pos 字段

**测试场景 3: 跨端同步**
1. 在设备 A 创建词条
2. 同步到云端
3. 在设备 B 下载
4. 验证：
   - ✅ ID 完全一致
   - ✅ pos 字段同步成功

**测试场景 4: ETL 导入**
1. 运行 ETL 生成 local_dictionary.db
2. 将数据导入应用
3. 验证：
   - ✅ ID 与前端生成的一致
   - ✅ pos 字段匹配

#### Step 5.3: 数据验证脚本

创建文件 `scripts/validate-ids.js`:

```javascript
// 验证数据库中的 ID 一致性
const { generateStableId } = require('../src/utils/idUtils');

async function validateIds() {
  // 连接到 Supabase
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.REACT_APP_SUPABASE_ANON_KEY
  );

  const { data, error } = await supabase
    .from('user_words')
    .select('id, de, pos');

  if (error) {
    console.error('❌ Error fetching data:', error);
    return;
  }

  let inconsistencies = 0;
  data.forEach(word => {
    const expectedId = generateStableId(word.de, word.pos);
    if (word.id !== expectedId) {
      console.log(`❌ Inconsistent ID for ${word.de} (${word.pos})`);
      console.log(`   Expected: ${expectedId}, Got: ${word.id}`);
      inconsistencies++;
    }
  });

  if (inconsistencies === 0) {
    console.log('✅ All IDs are consistent!');
  } else {
    console.log(`❌ Found ${inconsistencies} inconsistencies`);
  }
}

validateIds();
```

运行验证：
```bash
node scripts/validate-ids.js
```

---

## 🔄 回滚计划

如果迁移出现问题，可以执行回滚：

### 数据库回滚

```sql
-- 1. 移除 pos 列
ALTER TABLE public.user_words
DROP COLUMN IF EXISTS pos;

-- 2. 恢复 ID 类型为 UUID
ALTER TABLE public.user_words
ALTER COLUMN id TYPE uuid USING gen_random_uuid();

-- 3. 恢复默认值
ALTER TABLE public.user_words
ALTER COLUMN id SET DEFAULT gen_random_uuid();
```

### 前端回滚

```bash
# 恢复到迁移前的提交
git revert <commit-hash>

# 清理本地存储
localStorage.clear()
```

---

## 📊 迁移检查清单

### 数据库 ✓
- [ ] 添加 pos 列
- [ ] 修改 ID 类型为 bigint
- [ ] 为现有数据填充 pos 默认值
- [ ] 添加索引
- [ ] 验证表结构

### 前端代码 ✓
- [ ] 创建 idUtils.js
- [ ] 修改 WordProcessor.js
- [ ] 修改 supabaseUtils.js
- [ ] 修改 useSupabaseData.js
- [ ] 更新 constants.js
- [ ] 创建 localStorageMigration.js
- [ ] 在应用启动时执行迁移

### ETL 流程 ✓
- [ ] 更新 ID 生成函数
- [ ] 确保输出包含 pos 字段
- [ ] 验证 ID 一致性

### 测试 ✓
- [ ] 编写单元测试
- [ ] 执行集成测试
- [ ] 运行验证脚本
- [ ] 测试跨端同步

### 文档 ✓
- [ ] 更新 README
- [ ] 更新 API 文档
- [ ] 记录迁移日志

---

## 🚀 后续优化建议

1. **批量 ID 重新生成工具**：
   - 为现有用户数据提供一键迁移工具
   - 在用户登录时自动检测并提示迁移

2. **性能优化**：
   - 为 (user_id, de_norm, pos) 创建复合索引
   - 考虑使用 materialized view 加速查询

3. **数据验证**：
   - 添加数据库约束确保 pos 不为 null
   - 添加前端表单验证

4. **监控与日志**：
   - 记录 ID 生成和同步过程
   - 监控迁移成功率

---

## 📚 相关资源

- **Supabase 文档**: https://supabase.com/docs
- **React 测试**: https://testing-library.com/docs/react-testing-library/intro/
- **项目状态**: Star Vocab Game 现已完全独立，所有词汇数据和功能已集成

---

## 🤝 开发规范

### 代码风格
- 使用 ES6+ 语法
- 组件使用函数式 + Hooks
- 遵循 React 最佳实践

### 提交规范
```
feat: 添加新功能
fix: 修复 bug
refactor: 重构代码
docs: 更新文档
test: 添加测试
chore: 构建/工具变更
```

### 分支策略
- `main`: 生产环境
- `develop`: 开发环境
- `feature/*`: 功能分支
- `hotfix/*`: 紧急修复

---

*最后更新：2025-12-15*
