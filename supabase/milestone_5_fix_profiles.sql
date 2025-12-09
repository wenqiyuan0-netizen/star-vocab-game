-- 1. Create a function to auto-create profile on signup (Trigger)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, email, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

-- 2. Bind the trigger to auth.users table (Executes on INSERT)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Manually fix existing users who missed the trigger
-- This inserts a profile for every user in auth.users that doesn't have one in public.profiles
insert into public.profiles (id, email)
select id, email
from auth.users
where id not in (select id from public.profiles)
on conflict (id) do nothing;
