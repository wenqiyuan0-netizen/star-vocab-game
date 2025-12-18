-- ============================================
-- Supabase 同步验证脚本
-- 执行方式：在 Supabase Dashboard 的 SQL Editor 中运行
-- ============================================

-- 1. 检查表结构（确认 pos 列存在）
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_words'
ORDER BY ordinal_position;

-- 2. 查看最近创建/更新的词条（包含 pos 字段）
SELECT
  id,
  user_id,
  de,
  cn,
  pos,
  gender,
  state,
  created_at,
  updated_at,
  local_updated_at
FROM public.user_words
ORDER BY created_at DESC
LIMIT 10;

-- 3. 统计每个用户的词条数量
SELECT
  user_id,
  COUNT(*) as word_count,
  COUNT(CASE WHEN pos IS NOT NULL THEN 1 END) as words_with_pos,
  COUNT(CASE WHEN pos = 'noun' THEN 1 END) as nouns,
  COUNT(CASE WHEN pos = 'unknown' THEN 1 END) as unknown_pos
FROM public.user_words
GROUP BY user_id;

-- 4. 检查 pos 字段的分布
SELECT
  pos,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM public.user_words
WHERE pos IS NOT NULL
GROUP BY pos
ORDER BY count DESC;

-- 5. 查看今天新增的词条
SELECT
  id,
  de,
  cn,
  pos,
  gender,
  created_at
FROM public.user_words
WHERE created_at >= CURRENT_DATE
ORDER BY created_at DESC;

-- 6. 检查是否有 pos 为 NULL 的词条（理论上不应该有）
SELECT
  id,
  de,
  cn,
  gender,
  pos,
  created_at
FROM public.user_words
WHERE pos IS NULL
LIMIT 10;

-- 7. 验证唯一约束是否正常工作（检查重复词条）
SELECT
  user_id,
  de_norm,
  COUNT(*) as duplicate_count
FROM public.user_words
GROUP BY user_id, de_norm
HAVING COUNT(*) > 1;

-- 8. 查看最近同步的词条（通过 local_updated_at 判断）
SELECT
  id,
  de,
  cn,
  pos,
  gender,
  local_updated_at,
  updated_at
FROM public.user_words
WHERE local_updated_at > NOW() - INTERVAL '1 hour'
ORDER BY local_updated_at DESC;
