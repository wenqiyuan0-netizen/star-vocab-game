-- 1. 仅删除表和索引 (可安全在事务中运行)
DROP TABLE IF EXISTS public.search_index CASCADE;
DROP INDEX IF EXISTS idx_dictionary_word;
DROP INDEX IF EXISTS idx_dictionary_word_pos;

-- 2. 注意：VACUUM FULL 必须单独运行，不能包含在脚本/事务中
-- 请在 SQL Editor 中单独执行: 
-- VACUUM FULL public.dictionary;
