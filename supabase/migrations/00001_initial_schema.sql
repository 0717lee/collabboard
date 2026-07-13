-- CollabBoard 初始数据库 schema
-- 包含 profiles、boards、shared_boards 表及其 RLS 策略
-- 幂等设计：可安全重复执行；同时兼容旧 schema（username→name、data TEXT→JSONB）

-- ============================================================================
-- profiles 表
-- ============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  name text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 兼容旧 schema：username → name
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'username'
  ) then
    alter table public.profiles rename column username to name;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'email'
  ) then
    alter table public.profiles add column email text not null default '';
  end if;
end$$;

-- ============================================================================
-- boards 表
-- ============================================================================
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  name text not null default '未命名白板',
  owner_id uuid not null references auth.users(id) on delete cascade,
  data jsonb,
  public_role text check (public_role in ('editor', 'viewer') or public_role is null),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 兼容旧 schema：data TEXT → JSONB；新增 public_role 字段
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'boards'
    and column_name = 'data' and data_type = 'text'
  ) then
    alter table public.boards alter column data type jsonb using data::jsonb;
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'boards' and column_name = 'public_role'
  ) then
    alter table public.boards add column public_role text check (public_role in ('editor', 'viewer') or public_role is null);
  end if;
end$$;

-- ============================================================================
-- shared_boards 表（房间级共享权限）
-- ============================================================================
create table if not exists public.shared_boards (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique(board_id, user_id)
);

-- ============================================================================
-- GRANT（Data API 访问授权）
-- ============================================================================
grant select on public.profiles to authenticated;
grant insert, update on public.profiles to authenticated;

grant select, insert, delete on public.boards to authenticated;
revoke update on public.boards from authenticated;
grant update (name, data, public_role, updated_at) on public.boards to authenticated;
grant select, insert, update, delete on public.shared_boards to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ============================================================================
-- RLS authorization helpers
-- SECURITY DEFINER helpers return booleans without invoking reciprocal RLS.
-- ============================================================================
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.has_board_share(_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shared_boards
    where board_id = _board_id
      and user_id = (select auth.uid())
  );
$$;

create or replace function private.has_board_editor_share(_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shared_boards
    where board_id = _board_id
      and user_id = (select auth.uid())
      and role = 'editor'
  );
$$;

create or replace function private.is_board_owner(_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.boards
    where id = _board_id
      and owner_id = (select auth.uid())
  );
$$;

revoke all on function private.has_board_share(uuid) from public;
revoke all on function private.has_board_editor_share(uuid) from public;
revoke all on function private.is_board_owner(uuid) from public;
grant execute on function private.has_board_share(uuid) to authenticated;
grant execute on function private.has_board_editor_share(uuid) to authenticated;
grant execute on function private.is_board_owner(uuid) to authenticated;

-- ============================================================================
-- RLS: profiles（用户只能读写自己的 profile）
-- ============================================================================
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================================
-- RLS: boards（owner 全权限；被共享者按 shared_boards.role 读写）
-- ============================================================================
alter table public.boards enable row level security;

-- SELECT：owner 或被共享者可读
drop policy if exists "boards_select_owner" on public.boards;
create policy "boards_select_owner" on public.boards
  for select to authenticated using (auth.uid() = owner_id);

drop policy if exists "boards_select_shared" on public.boards;
create policy "boards_select_shared" on public.boards
  for select to authenticated
  using (private.has_board_share(boards.id));

-- SELECT：链接共享（public_role 已开启时，任何已认证用户可读）
-- 否则公开链接用户无法 fetchBoard 加载初始画布数据
drop policy if exists "boards_select_public" on public.boards;
create policy "boards_select_public" on public.boards
  for select to authenticated using (public_role is not null);

-- INSERT：仅 owner
drop policy if exists "boards_insert_own" on public.boards;
create policy "boards_insert_own" on public.boards
  for insert to authenticated with check (auth.uid() = owner_id);

-- UPDATE：owner 或被共享的 editor
drop policy if exists "boards_update_owner" on public.boards;
create policy "boards_update_owner" on public.boards
  for update to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "boards_update_shared_editor" on public.boards;
create policy "boards_update_shared_editor" on public.boards
  for update to authenticated
  using (private.has_board_editor_share(boards.id))
  with check (private.has_board_editor_share(boards.id));

drop policy if exists boards_update_public_editor on public.boards;
create policy boards_update_public_editor on public.boards
  for update to authenticated
  using (public_role = 'editor')
  with check (public_role = 'editor');

-- DELETE：仅 owner
drop policy if exists "boards_delete_own" on public.boards;
create policy "boards_delete_own" on public.boards
  for delete to authenticated using (auth.uid() = owner_id);

-- ============================================================================
-- RLS: shared_boards（owner 管理共享记录；被共享者可读自己的记录）
-- ============================================================================
alter table public.shared_boards enable row level security;

-- SELECT：board owner 或被共享者
drop policy if exists "shared_boards_select_owner" on public.shared_boards;
create policy "shared_boards_select_owner" on public.shared_boards
  for select to authenticated
  using (private.is_board_owner(shared_boards.board_id));

drop policy if exists "shared_boards_select_shared" on public.shared_boards;
create policy "shared_boards_select_shared" on public.shared_boards
  for select to authenticated using (auth.uid() = user_id);

-- INSERT/UPDATE/DELETE：仅 board owner
drop policy if exists "shared_boards_insert_owner" on public.shared_boards;
create policy "shared_boards_insert_owner" on public.shared_boards
  for insert to authenticated
  with check (private.is_board_owner(shared_boards.board_id));

drop policy if exists "shared_boards_update_owner" on public.shared_boards;
create policy "shared_boards_update_owner" on public.shared_boards
  for update to authenticated
  using (private.is_board_owner(shared_boards.board_id))
  with check (private.is_board_owner(shared_boards.board_id));

drop policy if exists "shared_boards_delete_owner" on public.shared_boards;
create policy "shared_boards_delete_owner" on public.shared_boards
  for delete to authenticated
  using (private.is_board_owner(shared_boards.board_id));

-- ============================================================================
-- Trigger: 自动更新 boards.updated_at
-- ============================================================================
create or replace function private.enforce_board_update_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  _user_id uuid := auth.uid();
begin
  -- Requests without auth.uid() are controlled by their database role.
  if _user_id is null then
    return new;
  end if;

  if new.id is distinct from old.id
    or new.owner_id is distinct from old.owner_id
    or new.created_at is distinct from old.created_at then
    raise insufficient_privilege using message = 'Board identity and ownership fields are immutable';
  end if;

  if new.public_role is distinct from old.public_role
    and old.owner_id is distinct from _user_id then
    raise insufficient_privilege using message = 'Only the board owner may change public_role';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_board_update_permissions() from public;

drop trigger if exists boards_enforce_update_permissions on public.boards;
create trigger boards_enforce_update_permissions
  before update on public.boards
  for each row execute function private.enforce_board_update_permissions();

create or replace function public.handle_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists boards_updated_at on public.boards;
create trigger boards_updated_at
  before update on public.boards
  for each row execute function public.handle_updated_at();

-- ============================================================================
-- Trigger: 注册时自动创建 profile（替代前端手动 insert，避免 RLS 拒绝）
-- security definer 让 trigger 以 postgres 权限执行，绕过 RLS
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
