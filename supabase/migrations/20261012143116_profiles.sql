-- F1. 사용자 프로필
-- 프로필 행은 온보딩에서 필명을 정하고 약관에 동의할 때 만든다.
-- 프로필이 없는 로그인 사용자는 읽기만 할 수 있다.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  bio text,
  is_admin boolean not null default false,
  terms_agreed_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint profiles_handle_format check (handle ~ '^[a-z0-9_]{3,20}$'),
  -- src/lib/handle.ts의 RESERVED_HANDLES와 같은 목록 (3자 미만 예약어는 형식 검사에서 이미 막힌다)
  constraint profiles_handle_not_reserved check (handle not in (
    'admin', 'new', 'login', 'onboarding', 'auth', 'api', 'forkfiction', 'w', 'u',
    'logout', 'signup', 'settings', 'edit', 'tree', 'compare', 'about', 'terms',
    'privacy', 'help', 'support', 'official', 'staff', 'moderator', 'system',
    'root', 'me', 'null', 'undefined', 'anonymous', 'ads'
  )),
  constraint profiles_display_name_length
    check (display_name = btrim(display_name) and char_length(display_name) between 1 and 30),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 300)
);

comment on table public.profiles is '사용자 프로필. id는 auth.users.id와 같다.';
comment on column public.profiles.handle is '필명. 영문 소문자·숫자·밑줄 3~20자. 계보와 주소에 쓰이므로 바꿀 수 없다.';

alter table public.profiles enable row level security;

-- 공개 프로필: 누구나 읽는다 (계보에 작가 이름을 보여 줘야 한다)
create policy "profiles_select_all"
  on public.profiles for select
  to anon, authenticated
  using (true);

-- 자기 id로만 만든다
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- 자기 행만 고친다
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- 컬럼 단위 권한: is_admin, handle 등은 사용자가 직접 바꿀 수 없다.
-- (삭제는 auth.users 삭제에 따른 cascade로만 일어난다)
revoke insert, update, delete on public.profiles from anon, authenticated;
grant insert (id, handle, display_name, terms_agreed_at) on public.profiles to authenticated;
grant update (display_name, bio) on public.profiles to authenticated;
