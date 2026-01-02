-- Check if the id column has a default value (gen_random_uuid())
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_words' AND column_name = 'id';
