create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  nickname text unique not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  suspended_until timestamptz,
  suspend_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.profiles
    where id = p_user_id
      and role = 'admin'
      and (suspended_until is null or suspended_until <= now())
  );
$$;

create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  is_public boolean not null default true,
  allow_post boolean not null default true,
  allow_comment boolean not null default true,
  require_post_approval boolean not null default false,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.board_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id),
  author_id uuid not null references public.profiles(id),
  title text not null,
  content text not null,
  status text not null default 'published' check (status in ('published', 'hidden', 'pending', 'deleted')),
  is_notice boolean not null default false,
  is_pinned boolean not null default false,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  search_tsv tsvector,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id),
  author_id uuid not null references public.profiles(id),
  parent_id uuid references public.comments(id),
  content text not null,
  status text not null default 'published' check (status in ('published', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles(id)
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reporter_id uuid not null references public.profiles(id),
  reason text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles(id),
  action_type text not null,
  target_type text not null,
  target_id uuid not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limits (
  id bigserial primary key,
  action text not null,
  actor_key text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  unique(action, actor_key, window_start)
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb
);

create index if not exists idx_posts_board_created_at on public.posts(board_id, created_at desc);
create index if not exists idx_posts_search_tsv on public.posts using gin(search_tsv);
create index if not exists idx_comments_post_created_at on public.comments(post_id, created_at asc);
create index if not exists idx_reports_status_created_at on public.reports(status, created_at desc);
create index if not exists idx_profiles_role_suspended on public.profiles(role, suspended_until);

create or replace function public.update_post_search_tsv()
returns trigger
language plpgsql
as $$
begin
  new.search_tsv := to_tsvector('simple', coalesce(new.title, '') || ' ' || coalesce(new.content, ''));
  return new;
end;
$$;

create trigger trigger_posts_search_tsv
before insert or update of title, content
on public.posts
for each row
execute function public.update_post_search_tsv();

create or replace function public.refresh_post_counters(p_post_id uuid)
returns void
language plpgsql
as $$
begin
  update public.posts
  set
    like_count = (
      select count(*)
      from public.post_likes pl
      where pl.post_id = p_post_id
    ),
    comment_count = (
      select count(*)
      from public.comments c
      where c.post_id = p_post_id
        and c.status = 'published'
        and c.deleted_at is null
    )
  where id = p_post_id;
end;
$$;

create or replace function public.handle_post_likes_counter()
returns trigger
language plpgsql
as $$
declare
  target_post uuid;
begin
  target_post := coalesce(new.post_id, old.post_id);
  perform public.refresh_post_counters(target_post);
  return coalesce(new, old);
end;
$$;

create or replace function public.handle_comments_counter()
returns trigger
language plpgsql
as $$
declare
  target_post uuid;
begin
  target_post := coalesce(new.post_id, old.post_id);
  perform public.refresh_post_counters(target_post);
  return coalesce(new, old);
end;
$$;

create trigger trigger_post_likes_counter
after insert or delete
on public.post_likes
for each row
execute function public.handle_post_likes_counter();

create trigger trigger_comments_counter
after insert or delete or update of status, deleted_at
on public.comments
for each row
execute function public.handle_comments_counter();

create or replace function public.enforce_comment_depth()
returns trigger
language plpgsql
as $$
declare
  parent_record public.comments;
begin
  if new.parent_id is null then
    return new;
  end if;

  select *
  into parent_record
  from public.comments
  where id = new.parent_id;

  if not found then
    raise exception 'Parent comment does not exist';
  end if;

  if parent_record.parent_id is not null then
    raise exception 'Only one level of nested replies is allowed';
  end if;

  if parent_record.post_id <> new.post_id then
    raise exception 'Reply must belong to the same post';
  end if;

  return new;
end;
$$;

create trigger trigger_enforce_comment_depth
before insert or update of parent_id, post_id
on public.comments
for each row
execute function public.enforce_comment_depth();

create or replace function public.consume_rate_limit(
  p_action text,
  p_actor_key text,
  p_window_seconds integer,
  p_max integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into public.rate_limits(action, actor_key, window_start, count)
  values (p_action, p_actor_key, v_window_start, 1)
  on conflict(action, actor_key, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;

  return v_count <= p_max;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_nickname text;
  normalized_nickname text;
  final_nickname text;
begin
  base_nickname := coalesce(new.raw_user_meta_data ->> 'nickname', split_part(new.email, '@', 1), 'user');
  normalized_nickname := regexp_replace(lower(base_nickname), '[^a-z0-9_]+', '_', 'g');

  if normalized_nickname = '' then
    normalized_nickname := 'user';
  end if;

  final_nickname := normalized_nickname;

  while exists(select 1 from public.profiles p where p.nickname = final_nickname) loop
    final_nickname := normalized_nickname || '_' || substr(md5(gen_random_uuid()::text), 1, 6);
  end loop;

  insert into public.profiles(id, email, nickname)
  values (new.id, new.email, final_nickname)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger trigger_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

create trigger trigger_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trigger_boards_updated_at
before update on public.boards
for each row execute function public.set_updated_at();

create trigger trigger_posts_updated_at
before update on public.posts
for each row execute function public.set_updated_at();

create trigger trigger_comments_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.boards enable row level security;
alter table public.board_templates enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.rate_limits enable row level security;
alter table public.app_settings enable row level security;

create policy "profiles_select_self_or_admin"
on public.profiles
for select
using (auth.uid() = id or public.is_admin(auth.uid()));

create policy "profiles_insert_self"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_update_self_or_admin"
on public.profiles
for update
using (auth.uid() = id or public.is_admin(auth.uid()))
with check (auth.uid() = id or public.is_admin(auth.uid()));

create policy "boards_read_public"
on public.boards
for select
using ((deleted_at is null and is_public = true) or public.is_admin(auth.uid()));

create policy "boards_admin_manage"
on public.boards
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "board_templates_admin_manage"
on public.board_templates
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "posts_read_public"
on public.posts
for select
using (
  public.is_admin(auth.uid())
  or (
    deleted_at is null
    and status = 'published'
    and exists (
      select 1
      from public.boards b
      where b.id = board_id
        and b.deleted_at is null
        and b.is_public = true
    )
  )
);

create policy "posts_insert_author"
on public.posts
for insert
with check (auth.uid() = author_id);

create policy "posts_update_author_or_admin"
on public.posts
for update
using (auth.uid() = author_id or public.is_admin(auth.uid()))
with check (auth.uid() = author_id or public.is_admin(auth.uid()));

create policy "comments_read_public"
on public.comments
for select
using (
  public.is_admin(auth.uid())
  or (
    deleted_at is null
    and status = 'published'
    and exists (
      select 1
      from public.posts p
      join public.boards b on b.id = p.board_id
      where p.id = post_id
        and p.status = 'published'
        and p.deleted_at is null
        and b.deleted_at is null
        and b.is_public = true
    )
  )
);

create policy "comments_insert_author"
on public.comments
for insert
with check (auth.uid() = author_id);

create policy "comments_update_author_or_admin"
on public.comments
for update
using (auth.uid() = author_id or public.is_admin(auth.uid()))
with check (auth.uid() = author_id or public.is_admin(auth.uid()));

create policy "post_likes_select_all"
on public.post_likes
for select
using (true);

create policy "post_likes_insert_owner"
on public.post_likes
for insert
with check (auth.uid() = user_id);

create policy "post_likes_delete_owner_or_admin"
on public.post_likes
for delete
using (auth.uid() = user_id or public.is_admin(auth.uid()));

create policy "reports_insert_owner"
on public.reports
for insert
with check (auth.uid() = reporter_id);

create policy "reports_select_owner_or_admin"
on public.reports
for select
using (auth.uid() = reporter_id or public.is_admin(auth.uid()));

create policy "reports_admin_update"
on public.reports
for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "moderation_actions_admin_only"
on public.moderation_actions
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "rate_limits_admin_only"
on public.rate_limits
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "app_settings_admin_only"
on public.app_settings
for all
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

insert into public.boards (slug, name, description, created_by)
select
  'freeboard',
  '자유 게시판',
  '기본 자유 게시판입니다.',
  p.id
from public.profiles p
order by p.created_at asc
limit 1
on conflict (slug) do nothing;
