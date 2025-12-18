# 数据库迁移策略

## 问题说明

原始迁移脚本尝试将 `id` 列从 `uuid` 改为 `bigint`，但遇到权限错误：
```
ERROR: 42501: permission denied: "RI_ConstraintTrigger_c_22569" is a system trigger
```

这是因为：
1. ID 列是主键，有系统级约束触发器
2. Supabase 限制了对系统触发器的直接操作
3. 修改主键类型是一个高风险操作

---

## 推荐方案：混合 ID 策略

### 方案 A：保留 UUID，使用 bigint 作为备用键（推荐）

**优势**：
- 安全，不破坏现有数据
- 向后兼容
- 可以逐步迁移

**实施**：

#### 1. 添加 pos 列（已提供安全脚本）

```sql
-- 执行 20251215_add_pos_field_safe.sql
-- 这只添加 pos 列，不修改 ID
```

#### 2. 添加 stable_id 列作为备用

```sql
-- 新建迁移：添加 stable_id 作为备用 ID
ALTER TABLE public.user_words
ADD COLUMN IF NOT EXISTS stable_id bigint;

-- 为现有数据生成 stable_id（需要前端协助）
-- 可以通过应用层逐步填充
```

#### 3. 前端修改策略

```javascript
// src/utils/supabaseUtils.js
export const appWordToDbWord = (appWord, userId) => {
  const dbWord = {
    // ... 其他字段
    pos: appWord.pos || 'unknown',
  };

  // 同时保存 UUID（如果存在）和 stable_id
  if (isUuid(appWord.id)) {
    dbWord.id = appWord.id;  // 保留 UUID
    // 生成 stable_id 作为备用
    dbWord.stable_id = generateStableId(appWord.de, appWord.pos || 'unknown');
  } else if (isStableId(appWord.id)) {
    // 新词条：使用 stable_id，让数据库生成 UUID
    dbWord.stable_id = appWord.id;
    // id 由数据库自动生成
  }

  return dbWord;
};
```

---

## 方案 B：创建新表，逐步迁移（更安全但更复杂）

### 步骤：

1. **创建新表 `user_words_v2`**：
```sql
CREATE TABLE public.user_words_v2 (
  id bigint primary key,  -- 直接使用 bigint
  user_id uuid references auth.users(id) on delete cascade not null,
  de text not null,
  de_norm text generated always as (lower(de)) stored,
  cn text,
  gender text,
  pos text not null default 'unknown',  -- 设为必填
  state text default 'new',
  step integer default 0,
  interval integer default 0,
  ease_factor double precision default 2.5,
  due_date timestamptz default 'epoch',
  fsrs jsonb,
  proficiency integer default 0,
  graduated boolean default false,
  last_review timestamptz,
  is_deleted boolean default false,
  local_updated_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (user_id, de_norm, pos)  -- 新的唯一约束
);

-- 启用 RLS
ALTER TABLE public.user_words_v2 ENABLE ROW LEVEL SECURITY;

-- 复制 RLS 策略
-- （从 user_words 复制策略定义）
```

2. **数据迁移脚本**（在应用层执行）：
```javascript
// 批量读取旧表数据
// 重新生成 stable_id
// 写入新表
```

3. **应用切换**：
   - 修改前端代码，指向新表
   - 逐步淘汰旧表

**缺点**：复杂度高，需要停机或双写

---

## 方案 C：仅添加 pos，暂时保留 UUID（最简单）

### 当前实施方案（推荐先执行此方案）

**原理**：
- 只添加 `pos` 列，不修改 ID 类型
- 前端使用 UUID 作为主 ID
- ETL 生成的 stable_id 作为参考，用于本地匹配

**实施步骤**：

1. **执行安全迁移脚本**：
```bash
# 在 Supabase Dashboard SQL Editor 中执行
# 文件: 20251215_add_pos_field_safe.sql
```

2. **前端 ID 生成策略调整**：
```javascript
// src/features/vocabulary/services/WordProcessor.js
// 选项 1: 仍然使用 stable_id，依赖 upsert 时匹配内容
newWords.push({
  id: generateStableId(deClean, finalPos), // stable_id
  // ...
});

// 选项 2: 生成 UUID（与数据库一致）
import { generateUuid } from '../../../utils/supabaseUtils';
newWords.push({
  id: generateUuid(), // 使用 UUID
  // ...
});
```

3. **ETL 和前端同步**：
   - ETL 生成的数据使用 `(de, pos)` 作为匹配键
   - 前端 upsert 时使用 `(user_id, de_norm, pos)` 匹配
   - 不依赖 ID 的精确匹配

---

## 🎯 推荐执行顺序

### 立即执行：方案 C（最简单）

1. **执行安全迁移脚本**（现在）
   ```sql
   -- 在 Supabase Dashboard 执行
   -- 文件: 20251215_add_pos_field_safe.sql
   ```

2. **前端保持当前修改不变**
   - `generateStableId` 仍然生成整数 ID
   - 但这个 ID 只用于本地标识，不写入数据库
   - 数据库仍使用 UUID

3. **修改 supabaseUtils.js**，不写入 stable_id：
```javascript
export const appWordToDbWord = (appWord, userId) => {
  const dbWord = {
    user_id: userId,
    de: appWord.de,
    cn: appWord.cn,
    gender: normalizeGender(appWord.gender) || null,
    pos: appWord.pos || 'unknown',
    // ... 其他字段
  };

  // 不写入 ID，让数据库自动生成 UUID
  // 依赖 upsert 的 onConflict: 'user_id, de_norm' 匹配

  return dbWord;
};
```

### 未来（如果需要）：方案 A（添加 stable_id 列）

当数据规模增大，需要跨平台一致性时再考虑。

---

## ✅ 立即行动

1. **执行新的安全脚本**：`20251215_add_pos_field_safe.sql`
2. **验证**：
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'user_words'
  AND column_name = 'pos';
```

3. **测试应用**：
```bash
npm start
# 导入新词，检查是否正常工作
```

---

## 💡 关于 ETL 和 ID 一致性

即使数据库使用 UUID，ETL 和前端仍然可以使用 stable_id 进行本地匹配：

**策略**：
- ETL 生成的 JSON 包含 `stable_id`（整数）和 `de`, `pos`
- 前端导入时使用 `(de, pos)` 匹配，而不是依赖 ID
- 本地 SQLite 可以使用 stable_id 作为主键
- 云端 Supabase 使用 UUID 作为主键

**数据流**：
```
ETL 生成:
{
  "stable_id": 1234567890,
  "de": "Haus",
  "pos": "noun",
  "cn": "房子"
}

前端导入:
1. 检查本地是否存在 (de="Haus", pos="noun")
2. 如果不存在，创建新词条
3. 同步到云端时，让数据库生成 UUID
4. UUID 返回后，更新本地记录
```

这样，stable_id 只在本地使用，云端使用 UUID，两者通过 `(de, pos)` 内容匹配。
