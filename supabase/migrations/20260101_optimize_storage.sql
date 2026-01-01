-- 优化存储空间的 SQL 脚本
-- 请在 Supabase Dashboard 的 SQL Editor 中运行此脚本

-- ==========================================
-- 1. 优化 dictionary 表索引
-- ==========================================

-- 移除冗余索引
-- dictionary 表已有 UNIQUE(word, pos) 约束，它会自动创建一个复合索引 (word, pos)。
-- 这个索引可以支持 WHERE word = '...' 的查询，因此 idx_dictionary_word 是多余的。
DROP INDEX IF EXISTS idx_dictionary_word;

-- idx_dictionary_word_pos 也是多余的，因为它与 UNIQUE 约束的索引完全相同。
DROP INDEX IF EXISTS idx_dictionary_word_pos;

-- 注意：idx_dictionary_pos 被保留，以防有仅按词性查询的需求。
-- 如果你确定不按 pos 单独查询，也可以取消注释下面这行来进一步节省空间：
-- DROP INDEX IF EXISTS idx_dictionary_pos;


-- ==========================================
-- 2. 重建并优化 search_index 表
-- ==========================================

-- 这一步将：
-- 1. 去除重复数据
-- 2. 移除 created_at 列（节省空间）
-- 3. 建立联合主键（替换原来的两个独立索引）

-- 开始事务
BEGIN;

-- 创建临时表，只保留唯一的 variant 和 lemma_id 组合
CREATE TEMP TABLE search_index_temp AS
SELECT DISTINCT variant, lemma_id
FROM public.search_index;

-- 清空原表
TRUNCATE TABLE public.search_index;

-- 移除 created_at 列
ALTER TABLE public.search_index DROP COLUMN IF EXISTS created_at;

-- 移除旧索引
DROP INDEX IF EXISTS idx_search_index_variant;
DROP INDEX IF EXISTS idx_search_index_lemma_id;

-- 将数据插回原表
INSERT INTO public.search_index (variant, lemma_id)
SELECT variant, lemma_id FROM search_index_temp;

-- 添加联合主键
-- 这会自动创建一个 (variant, lemma_id) 的唯一索引
-- 这个索引可以高效支持 WHERE variant = '...' 的查询
ALTER TABLE public.search_index 
ADD CONSTRAINT search_index_pk PRIMARY KEY (variant, lemma_id);

-- 删除临时表
DROP TABLE search_index_temp;

COMMIT;

-- ==========================================
-- 3. 回收空间
-- ==========================================
-- 注意：VACUUM FULL 会重建表文件，释放未使用的磁盘空间。
-- 这可能会锁定表一段时间，请在低峰期执行。
-- 如果脚本超时，请单独运行下面的命令。

VACUUM FULL public.dictionary;
VACUUM FULL public.search_index;
