create or replace function public.toggle_post_like(
  p_post_id uuid,
  p_user_id uuid
)
returns table (
  liked boolean,
  like_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lock_key bigint;
begin
  if p_post_id is null or p_user_id is null then
    raise exception 'post_id and user_id are required';
  end if;

  v_lock_key := hashtextextended(p_post_id::text || ':' || p_user_id::text, 0);
  perform pg_advisory_xact_lock(v_lock_key);

  delete from public.post_likes
  where post_id = p_post_id
    and user_id = p_user_id;

  if found then
    liked := false;
  else
    insert into public.post_likes(post_id, user_id)
    values (p_post_id, p_user_id)
    on conflict (post_id, user_id) do nothing;
    liked := true;
  end if;

  perform public.refresh_post_counters(p_post_id);

  select coalesce(p.like_count, 0)
  into like_count
  from public.posts p
  where p.id = p_post_id;

  return next;
end;
$$;
