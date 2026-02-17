create or replace function public.search_profiles_admin(
  p_page integer default 1,
  p_page_size integer default 20,
  p_role text default null,
  p_query text default null,
  p_suspended_only boolean default false
)
returns table (
  id uuid,
  email text,
  nickname text,
  role text,
  suspended_until timestamptz,
  suspend_reason text,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
with normalized as (
  select
    greatest(coalesce(p_page, 1), 1) as page,
    least(greatest(coalesce(p_page_size, 20), 1), 100) as page_size,
    case
      when p_role in ('user', 'admin') then p_role
      else null
    end as role_filter,
    nullif(trim(p_query), '') as query_text,
    coalesce(p_suspended_only, false) as suspended_only
),
filtered as (
  select
    pr.id,
    pr.email,
    pr.nickname,
    pr.role,
    pr.suspended_until,
    pr.suspend_reason,
    pr.created_at,
    pr.updated_at,
    count(*) over() as total_count
  from public.profiles pr
  cross join normalized n
  where
    (n.role_filter is null or pr.role = n.role_filter)
    and (
      n.query_text is null
      or pr.email ilike '%' || n.query_text || '%'
      or pr.nickname ilike '%' || n.query_text || '%'
    )
    and (
      n.suspended_only = false
      or pr.suspended_until > now()
    )
)
select
  f.id,
  f.email,
  f.nickname,
  f.role,
  f.suspended_until,
  f.suspend_reason,
  f.created_at,
  f.updated_at,
  f.total_count
from filtered f
order by f.created_at desc
limit (select page_size from normalized)
offset ((select page from normalized) - 1) * (select page_size from normalized);
$$;
