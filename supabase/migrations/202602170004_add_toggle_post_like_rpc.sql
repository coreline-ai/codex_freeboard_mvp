create or replace function public.toggle_post_like(
  p_post_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key bigint;
begin
  -- Serialize like toggle per post/user pair to prevent race conditions.
  v_lock_key := hashtextextended(p_post_id::text || ':' || p_user_id::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  if exists (
    select 1
    from public.post_likes pl
    where pl.post_id = p_post_id
      and pl.user_id = p_user_id
  ) then
    delete from public.post_likes
    where post_id = p_post_id
      and user_id = p_user_id;
    return false;
  end if;

  insert into public.post_likes(post_id, user_id)
  values (p_post_id, p_user_id);

  return true;
end;
$$;
