create or replace function public.search_posts_fts(
  p_query text,
  p_page integer default 1,
  p_page_size integer default 20,
  p_is_admin boolean default false
)
returns table (
  post_id uuid,
  board_slug text,
  board_name text,
  title text,
  excerpt text,
  author_nickname text,
  status text,
  created_at timestamptz,
  rank double precision,
  total_count bigint
)
language sql
stable
set search_path = public
as $$
with normalized as (
  select
    nullif(trim(p_query), '') as query,
    greatest(coalesce(p_page, 1), 1) as page,
    least(greatest(coalesce(p_page_size, 20), 1), 100) as page_size
),
matched as (
  select
    p.id as post_id,
    b.slug as board_slug,
    b.name as board_name,
    p.title,
    p.content,
    pr.nickname as author_nickname,
    p.status,
    p.created_at,
    ts_rank_cd(p.search_tsv, websearch_to_tsquery('simple', n.query)) as rank_raw,
    (1.0 / (1.0 + extract(epoch from (now() - p.created_at)) / 86400.0)) as recency_boost,
    n.query,
    n.page,
    n.page_size
  from normalized n
  join public.posts p on n.query is not null
  join public.boards b on b.id = p.board_id
  left join public.profiles pr on pr.id = p.author_id
  where
    p.search_tsv @@ websearch_to_tsquery('simple', n.query)
    and b.deleted_at is null
    and (
      (p_is_admin = false and b.is_public = true and p.status = 'published' and p.deleted_at is null)
      or
      (p_is_admin = true and p.status in ('published', 'hidden', 'pending', 'deleted'))
    )
),
scored as (
  select
    m.post_id,
    m.board_slug,
    m.board_name,
    m.title,
    ts_headline(
      'simple',
      coalesce(m.content, ''),
      websearch_to_tsquery('simple', m.query),
      'MaxWords=28, MinWords=10, ShortWord=2, MaxFragments=2, FragmentDelimiter=" … "'
    ) as excerpt,
    coalesce(m.author_nickname, 'unknown') as author_nickname,
    m.status,
    m.created_at,
    (m.rank_raw + m.recency_boost * 0.08) as rank,
    m.page,
    m.page_size
  from matched m
),
ranked as (
  select
    s.post_id,
    s.board_slug,
    s.board_name,
    s.title,
    s.excerpt,
    s.author_nickname,
    s.status,
    s.created_at,
    s.rank,
    count(*) over() as total_count,
    s.page,
    s.page_size
  from scored s
)
select
  r.post_id,
  r.board_slug,
  r.board_name,
  r.title,
  r.excerpt,
  r.author_nickname,
  r.status,
  r.created_at,
  r.rank,
  r.total_count
from ranked r
order by r.rank desc, r.created_at desc
limit (select page_size from normalized)
offset ((select page from normalized) - 1) * (select page_size from normalized);
$$;
