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
    nullif(trim(p_query), '') as query_text,
    greatest(coalesce(p_page, 1), 1) as page,
    least(greatest(coalesce(p_page_size, 20), 1), 100) as page_size
),
queries as (
  select
    n.query_text,
    n.page,
    n.page_size,
    case
      when n.query_text is null then null::tsquery
      else websearch_to_tsquery('simple', n.query_text)
    end as query_web,
    (
      select
        case
          when count(*) = 0 then null::tsquery
          else to_tsquery('simple', string_agg(lexeme || ':*', ' & '))
        end
      from unnest(tsvector_to_array(to_tsvector('simple', coalesce(n.query_text, '')))) as lexeme
    ) as query_prefix
  from normalized n
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
    greatest(
      coalesce(ts_rank_cd(p.search_tsv, q.query_web), 0),
      coalesce(ts_rank_cd(p.search_tsv, q.query_prefix), 0) * 0.95
    ) as rank_raw,
    (1.0 / (1.0 + extract(epoch from (now() - p.created_at)) / 86400.0)) as recency_boost,
    coalesce(q.query_web, q.query_prefix) as headline_query,
    q.page,
    q.page_size
  from queries q
  join public.posts p on q.query_text is not null
  join public.boards b on b.id = p.board_id
  left join public.profiles pr on pr.id = p.author_id
  where
    (
      (q.query_web is not null and p.search_tsv @@ q.query_web)
      or
      (q.query_prefix is not null and p.search_tsv @@ q.query_prefix)
    )
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
      m.headline_query,
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
