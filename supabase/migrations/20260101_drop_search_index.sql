-- 彻底清理 search_index 表以释放空间
-- 警告：此操作不可逆，请确保已生成并验证了本地 search_index.json

-- 1. 删除 search_index 表
DROP TABLE IF EXISTS public.search_index CASCADE;

-- 2. 清理 dictionary 表的无用索引（如果还没做）
DROP INDEX IF EXISTS idx_dictionary_word;
DROP INDEX IF EXISTS idx_dictionary_word_pos;

-- 3. 回收空间
-- 注意：VACUUM FULL 需要在非事务块中运行，且会锁定表
VACUUM FULL public.dictionary;

-- 4. 验证空间使用
-- 运行以下查询查看当前大小
/*
SELECT
  schema_name,
  relname,
  pg_size_pretty(table_size) AS size,
  table_size
FROM (
  SELECT
    pg_catalog.pg_namespace.nspname AS schema_name,
    relname,
    pg_relation_size(pg_catalog.pg_class.oid) AS table_size
  FROM pg_catalog.pg_class
  JOIN pg_catalog.pg_namespace ON relnamespace = pg_catalog.pg_namespace.oid
) t
WHERE schema_name = 'public'
ORDER BY table_size DESC;
*/
