# Supabase 同步验证指南

## 🔍 验证方法一览

### 方法 1: Supabase Dashboard（最直观）
### 方法 2: SQL 查询（最详细）
### 方法 3: 前端控制台（实时监控）
### 方法 4: 测试流程（完整验证）

---

## 方法 1: Supabase Dashboard 可视化查看

### 步骤：

1. **登录 Supabase Dashboard**
   - 访问 https://app.supabase.com
   - 选择你的项目

2. **查看 Table Editor**
   - 左侧菜单：Table Editor
   - 选择 `user_words` 表
   - 查看最近的数据

3. **关键检查点**：
   - ✅ `pos` 列是否存在
   - ✅ 新导入的词条是否显示
   - ✅ `pos` 字段是否有值（noun/unknown 等）
   - ✅ `created_at` 和 `updated_at` 时间是否正确

### 截图示例：

```
| id (uuid) | de     | cn   | pos  | gender | created_at          |
|-----------|--------|------|------|--------|---------------------|
| a1b2c3d4  | Apfel  | 苹果 | noun | m      | 2025-12-15 14:30:00 |
| e5f6g7h8  | laufen | 跑   | verb | null   | 2025-12-15 14:31:00 |
```

---

## 方法 2: SQL 查询（推荐）

### 在 Supabase SQL Editor 中执行：

#### 快速验证查询

```sql
-- 查看你的词条（替换 YOUR_USER_ID）
SELECT
  id,
  de,
  cn,
  pos,
  gender,
  created_at
FROM public.user_words
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 10;
```

**如何获取 user_id**：
1. 在前端浏览器控制台执行：
```javascript
// 打开应用，登录后在控制台执行
supabase.auth.getUser().then(({ data }) => console.log(data.user.id))
```
2. 复制显示的 UUID，替换上面查询中的 `YOUR_USER_ID`

#### 完整验证脚本

我已经创建了 `scripts/verify-sync.sql`，包含 8 个验证查询：

1. ✅ 检查表结构
2. ✅ 查看最近词条
3. ✅ 统计词条数量
4. ✅ pos 字段分布
5. ✅ 今天新增的词条
6. ✅ 检查空值
7. ✅ 检查重复
8. ✅ 最近同步记录

**执行方式**：
- 复制 `scripts/verify-sync.sql` 的内容
- 粘贴到 Supabase SQL Editor
- 点击 Run

---

## 方法 3: 前端控制台实时监控

### 打开浏览器开发者工具：

**Chrome/Edge**: `F12` 或 `Ctrl+Shift+I`
**Firefox**: `F12`

### 查看控制台日志：

#### 成功同步的日志示例：

```
🔄 Migrating local storage data...
✅ Migration completed: 5/10 words updated

[Supabase Sync] Syncing word: { de: "Apfel", pos: "noun", ... }
[Supabase Sync] Success: { id: "a1b2c3d4...", de: "Apfel", ... }
```

#### 失败的日志示例：

```
❌ Error syncing word: <error message>
Cloud Sync Error: <detailed error>
```

### 添加调试日志（临时）：

在前端代码中添加更多日志：

```javascript
// src/shared/hooks/useSupabase/useSupabaseData.js
// 在 syncWord 函数中添加：

const syncWord = async (word) => {
  if (!user) return;

  console.log('🔄 [Sync Debug] Starting sync for:', {
    de: word.de,
    pos: word.pos,
    id: word.id
  });

  try {
    const wordWithUpdate = { ...word, localUpdatedAt: Date.now() };
    const dbPayload = appWordToDbWord(wordWithUpdate, user.id);

    console.log('📤 [Sync Debug] Sending payload:', dbPayload);

    const { data, error } = await supabase
      .from('user_words')
      .upsert(dbPayload, { onConflict: 'user_id, de_norm' })
      .select()
      .single();

    if (error) throw error;

    console.log('✅ [Sync Debug] Success! Received:', {
      id: data.id,
      de: data.de,
      pos: data.pos
    });

    // ... rest of the function
  } catch (err) {
    console.error('❌ [Sync Debug] Failed:', err);
    // ...
  }
};
```

---

## 方法 4: 完整测试流程

### 测试场景 1: 导入新词并验证同步

**步骤**：

1. **清空测试数据**（可选）
   ```javascript
   // 浏览器控制台
   localStorage.clear();
   location.reload();
   ```

2. **导入测试词条**
   ```
   在应用中导入：
   der Apfel;苹果
   laufen;跑
   schön;美丽的
   ```

3. **等待同步**（约 2-5 秒）
   - 观察控制台日志
   - 查看是否有错误

4. **验证 Supabase**
   ```sql
   -- 在 SQL Editor 中执行
   SELECT id, de, cn, pos, gender, created_at
   FROM public.user_words
   WHERE user_id = 'YOUR_USER_ID'
   ORDER BY created_at DESC
   LIMIT 5;
   ```

5. **检查结果**：
   - ✅ 应该看到 3 条新记录
   - ✅ `pos` 字段：
     - "Apfel" → pos = "noun", gender = "m"
     - "laufen" → pos = "unknown", gender = null（小写开头）
     - "schön" → pos = "unknown", gender = null

### 测试场景 2: 跨设备同步

**步骤**：

1. **设备 A**（当前设备）
   - 导入词条
   - 等待同步完成

2. **设备 B**（另一个浏览器/无痕模式）
   - 用同一账号登录
   - 观察是否自动加载词条

3. **验证**：
   - 两个设备的词条列表应该一致
   - 所有字段（包括 pos）应该同步

### 测试场景 3: 修改词条并同步

**步骤**：

1. **修改词条**
   - 在应用中编辑某个词条
   - 保存

2. **检查 Supabase**
   ```sql
   SELECT
     id,
     de,
     pos,
     updated_at,
     local_updated_at
   FROM public.user_words
   WHERE de = '你修改的词条'
   ```

3. **验证**：
   - `updated_at` 应该更新为最新时间
   - `local_updated_at` 也应该更新

---

## 🚨 常见问题排查

### 问题 1: 词条没有同步到云端

**可能原因**：
- 没有登录
- 网络问题
- RLS 权限问题

**检查步骤**：

1. **确认登录状态**
```javascript
// 浏览器控制台
supabase.auth.getSession().then(({ data }) => {
  console.log('Session:', data.session);
  console.log('User:', data.session?.user);
});
```

2. **检查网络请求**
   - 打开浏览器 Network 标签
   - 筛选 `supabase`
   - 查看请求状态（应该是 200 或 201）

3. **检查 RLS 策略**
```sql
-- 查看当前的 RLS 策略
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'user_words';
```

### 问题 2: pos 字段为空

**检查**：
```sql
SELECT COUNT(*) as null_pos_count
FROM public.user_words
WHERE pos IS NULL;
```

**如果有空值**，手动填充：
```sql
UPDATE public.user_words
SET pos = CASE
  WHEN gender IN ('m', 'f', 'n') THEN 'noun'
  ELSE 'unknown'
END
WHERE pos IS NULL;
```

### 问题 3: 重复词条

**检查**：
```sql
SELECT
  user_id,
  de_norm,
  COUNT(*) as count
FROM public.user_words
GROUP BY user_id, de_norm
HAVING COUNT(*) > 1;
```

**如果有重复**，删除旧的：
```sql
-- 保留最新的，删除旧的
DELETE FROM public.user_words a
USING public.user_words b
WHERE a.user_id = b.user_id
  AND a.de_norm = b.de_norm
  AND a.created_at < b.created_at;
```

---

## ✅ 验证清单

完成以下检查，确认同步正常：

### 数据库层面：
- [ ] `pos` 列存在
- [ ] 新词条出现在 `user_words` 表中
- [ ] `pos` 字段有正确的值（noun/verb/unknown 等）
- [ ] `created_at` 时间正确
- [ ] 没有重复词条

### 应用层面：
- [ ] 导入词条后无错误日志
- [ ] 控制台显示同步成功
- [ ] 刷新页面后词条仍然存在
- [ ] 跨设备同步正常

### 数据完整性：
- [ ] 所有字段正确同步（de, cn, pos, gender 等）
- [ ] 学习进度保留（state, step, interval 等）
- [ ] 时间戳正确（created_at, updated_at）

---

## 🎯 快速验证命令（推荐）

**一键验证**（在 Supabase SQL Editor 中执行）：

```sql
-- 替换 YOUR_USER_ID 后执行
DO $$
DECLARE
  v_user_id uuid := 'YOUR_USER_ID'; -- 替换为你的 user_id
  v_word_count integer;
  v_pos_count integer;
  v_recent_count integer;
BEGIN
  -- 统计总词条数
  SELECT COUNT(*) INTO v_word_count
  FROM public.user_words
  WHERE user_id = v_user_id;

  -- 统计有 pos 的词条数
  SELECT COUNT(*) INTO v_pos_count
  FROM public.user_words
  WHERE user_id = v_user_id AND pos IS NOT NULL;

  -- 统计最近 1 小时的词条数
  SELECT COUNT(*) INTO v_recent_count
  FROM public.user_words
  WHERE user_id = v_user_id
    AND created_at > NOW() - INTERVAL '1 hour';

  -- 输出结果
  RAISE NOTICE '===== 同步验证报告 =====';
  RAISE NOTICE '总词条数: %', v_word_count;
  RAISE NOTICE '有 pos 字段的词条: %', v_pos_count;
  RAISE NOTICE '最近 1 小时新增: %', v_recent_count;

  IF v_word_count = 0 THEN
    RAISE NOTICE '⚠️ 警告：没有找到任何词条！';
  ELSIF v_pos_count < v_word_count THEN
    RAISE NOTICE '⚠️ 警告：有 % 个词条缺少 pos 字段', v_word_count - v_pos_count;
  ELSE
    RAISE NOTICE '✅ 验证通过！所有词条都有 pos 字段';
  END IF;
END $$;
```

---

需要我帮你：
1. 生成一个完整的验证报告脚本？
2. 添加更详细的前端调试日志？
3. 还是直接开始 ETL 开发（同步验证成功的话）？
