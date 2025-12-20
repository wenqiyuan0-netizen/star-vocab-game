-- Drop and recreate get_new_listening_candidates to support new return type
drop function if exists public.get_new_listening_candidates(integer, text);

create or replace function public.get_new_listening_candidates(
  p_limit integer default 10,
  p_skill text default 'listening'
)
returns table (
  id uuid,
  word text,
  proficiency integer,
  translation text,
  example_de text,
  example_cn text
)
language plpgsql
security invoker
as $$
begin
  return query
  with candidates as (
    select 
      uw.id,
      uw.de,
      uw.proficiency,
      uw.cn
    from 
      public.user_words uw
    where 
      uw.user_id = auth.uid()
      and uw.proficiency > 0 -- Only learned words
      and not exists (
        select 1 
        from public.user_word_skills uws 
        where uws.word_id = uw.id 
        and uws.user_id = auth.uid()
        and uws.skill = p_skill
      )
    order by 
      uw.proficiency desc -- Start with best known words
    limit p_limit
  )
  select 
    c.id,
    c.de as word,
    c.proficiency,
    c.cn as translation,
    -- Fetch example from dictionary (pick any if multiple)
    (select d.example_de from public.dictionary d where lower(d.word) = lower(c.de) and d.example_de is not null limit 1) as example_de,
    (select d.example_cn from public.dictionary d where lower(d.word) = lower(c.de) and d.example_cn is not null limit 1) as example_cn
  from 
    candidates c;
end;
$$;
