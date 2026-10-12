-- F2~F9 데이터 모델: works, revisions, chapters, stars, notifications, reports, work_lineage
-- 핵심 규칙
--   1) revisions는 쌓기만 한다(누구도 고칠 수 없고, 삭제는 service_role/postgres만).
--   2) 갈래는 fork_work() 하나로 한 트랜잭션에 만든다.
--   3) is_canon은 뿌리 원작자만 set_canon()으로 바꾼다.
--   4) 모든 테이블에 RLS를 켜고, 사용자가 쓸 수 있는 컬럼은 grant로 좁힌다.

-- ────────────────────────────────────────────────────────────
-- 공통 헬퍼
-- ────────────────────────────────────────────────────────────

-- 관리 작업용 역할(대시보드·마이그레이션·service role 키, security definer 함수 안).
-- 트리거는 호출한 역할로 돌기 때문에, definer 함수 안에서는 함수 소유자(postgres)로 보인다.
create function public.is_privileged_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select current_user in ('postgres', 'service_role', 'supabase_admin')
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  )
$$;

-- ────────────────────────────────────────────────────────────
-- works: 원작과 갈래
-- ────────────────────────────────────────────────────────────

create table public.works (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id),
  slug text not null unique,
  title text not null,
  summary text,
  -- 장르 칼럼 없음(웹소설 전반)
  license text not null default 'CC-BY-SA-4.0',
  allow_fork boolean not null default true,
  ai_usage text not null default 'none',
  parent_work_id uuid references public.works (id),   -- 원작이면 null
  root_work_id uuid not null references public.works (id), -- 원작이면 자기 자신(트리거가 채운다)
  fork_chapter_position int,                           -- 갈림점(장 번호)
  fork_note text,                                      -- 한 줄 갈래 소개
  is_canon boolean not null default false,
  visibility text not null default 'draft',
  star_count int not null default 0,
  fork_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint works_slug_format
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 80),
  constraint works_title_length
    check (title = btrim(title) and char_length(title) between 1 and 100),
  constraint works_summary_length check (summary is null or char_length(summary) <= 300),
  constraint works_license_values
    check (license in ('CC-BY-SA-4.0', 'CC-BY-NC-SA-4.0', 'ARR')),
  -- '갈래 금지(모든 권리 보유)'는 갈래를 허용할 수 없다
  constraint works_arr_no_fork check (license <> 'ARR' or not allow_fork),
  constraint works_ai_usage_values check (ai_usage in ('none', 'partial', 'mostly')),
  constraint works_visibility_values check (visibility in ('draft', 'public', 'hidden')),
  constraint works_root_self check ((parent_work_id is null) = (root_work_id = id)),
  -- 원작은 갈래 정보를 갖지 않고, 갈래는 갈림점과 한 줄 소개를 반드시 갖는다
  constraint works_fork_shape check (
    (parent_work_id is null
      and fork_chapter_position is null and fork_note is null and not is_canon)
    or
    (parent_work_id is not null
      and fork_chapter_position >= 1
      and fork_note is not null
      and fork_note = btrim(fork_note)
      and char_length(fork_note) between 1 and 100)
  ),
  constraint works_counts_nonneg check (star_count >= 0 and fork_count >= 0)
);

create index works_root_work_id_idx on public.works (root_work_id);
create index works_parent_work_id_idx on public.works (parent_work_id);
create index works_owner_id_idx on public.works (owner_id);
create index works_public_created_idx on public.works (created_at desc) where visibility = 'public';

comment on table public.works is '원작과 갈래. 갈래는 fork_work()로만 만든다.';
comment on column public.works.license is 'CC-BY-SA-4.0 | CC-BY-NC-SA-4.0 | ARR(갈래 금지). 갈래는 부모의 라이선스를 물려받고 바꿀 수 없다.';
comment on column public.works.fork_chapter_position is '갈림점: 원작과 처음 달라진 장 번호.';
comment on column public.works.is_canon is '정사 인정. 뿌리 원작자만 set_canon()으로 바꾼다.';

-- 작품을 읽을 수 있는지: 공개, 본인, 관리자.
-- 다른 테이블의 정책에서 works를 다시 거치지 않도록 definer로 둔다.
create function public.can_read_work(p_work_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.works w
    where w.id = p_work_id
      and (w.visibility = 'public'
        or w.owner_id = (select auth.uid())
        or public.is_admin())
  )
$$;

create function public.is_work_owner(p_work_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.works w
    where w.id = p_work_id and w.owner_id = (select auth.uid())
  )
$$;

-- 뿌리·라이선스 채우기, 바꿀 수 없는 컬럼 지키기, 숨김은 관리 역할만
create function public.works_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent public.works;
begin
  if tg_op = 'INSERT' then
    if new.parent_work_id is null then
      new.root_work_id := new.id;
    else
      select * into v_parent from public.works where id = new.parent_work_id;
      new.root_work_id := v_parent.root_work_id;
      new.license := v_parent.license;
    end if;
  else
    if new.owner_id is distinct from old.owner_id
      or new.slug is distinct from old.slug
      or new.parent_work_id is distinct from old.parent_work_id
      or new.root_work_id is distinct from old.root_work_id then
      raise exception '작가, 주소, 계보는 바꿀 수 없습니다.' using errcode = '42501';
    end if;
    if new.parent_work_id is not null and new.license is distinct from old.license then
      raise exception '갈래는 원작의 라이선스를 바꿀 수 없습니다.' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;

  if new.license = 'ARR' then
    new.allow_fork := false;
  end if;

  if public.is_privileged_role() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.visibility = 'hidden' then
      raise exception '숨김 처리는 관리자만 할 수 있습니다.' using errcode = '42501';
    end if;
  elsif new.visibility is distinct from old.visibility
    and 'hidden' in (new.visibility, old.visibility) then
    raise exception '숨김 처리는 관리자만 할 수 있습니다.' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger works_guard
  before insert or update on public.works
  for each row execute function public.works_guard();

-- ────────────────────────────────────────────────────────────
-- revisions: 장의 수정본(쌓기만 한다)
-- ────────────────────────────────────────────────────────────

create table public.revisions (
  id uuid primary key default gen_random_uuid(),
  -- 처음 만든 장. 장을 지워도 그 장을 물려받은 갈래가 수정본을 계속 가리키므로 FK를 걸지 않는다.
  chapter_id uuid not null,
  author_id uuid not null references public.profiles (id),
  title text not null,
  body_md text not null,
  parent_revision_id uuid references public.revisions (id),
  message text,
  created_at timestamptz not null default now(),

  constraint revisions_title_length
    check (title = btrim(title) and char_length(title) between 1 and 100),
  constraint revisions_body_length check (char_length(body_md) <= 100000),
  constraint revisions_message_length check (message is null or char_length(message) <= 100)
);

create index revisions_chapter_id_idx on public.revisions (chapter_id, created_at desc);
create index revisions_author_id_idx on public.revisions (author_id);

comment on table public.revisions is '장의 수정본. 새로 쌓기만 하고 고치거나 지우지 않는다.';

create function public.revisions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    raise exception '수정본은 고칠 수 없습니다. 새 수정본을 쌓아 주세요.' using errcode = '42501';
  end if;
  -- 삭제는 운영(법적 요청 등)에서만 service_role/postgres로 한다
  if not public.is_privileged_role() then
    raise exception '수정본은 지울 수 없습니다.' using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger revisions_immutable
  before update or delete on public.revisions
  for each row execute function public.revisions_immutable();

-- ────────────────────────────────────────────────────────────
-- chapters: 작품의 장(본문은 revisions를 가리킨다)
-- ────────────────────────────────────────────────────────────

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.works (id) on delete cascade,
  position int not null,
  head_revision_id uuid not null references public.revisions (id),
  origin_revision_id uuid references public.revisions (id), -- 갈래가 물려받은 원작 수정본
  state text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chapters_position_positive check (position >= 1),
  constraint chapters_state_values check (state in ('inherited', 'modified', 'new')),
  -- 새로 쓴 장만 물려받은 수정본이 없다
  constraint chapters_origin_shape check ((state = 'new') = (origin_revision_id is null)),
  -- 순서 바꾸기를 한 문장으로 할 수 있도록 문장 끝에서 검사한다
  constraint chapters_work_position_key unique (work_id, position) deferrable initially immediate
);

create index chapters_head_revision_id_idx on public.chapters (head_revision_id);
create index chapters_origin_revision_id_idx on public.chapters (origin_revision_id);

comment on table public.chapters is '작품의 장. 제목·본문은 head_revision_id가 가리키는 수정본에 있다.';
comment on column public.chapters.state is 'inherited(원작 그대로) | modified(갈래에서 고침) | new(새로 쓴 장)';

-- head는 이 장에서 만든 수정본이거나 물려받은 원작 수정본이어야 한다
create function public.chapters_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.work_id is distinct from old.work_id
      or new.origin_revision_id is distinct from old.origin_revision_id then
      raise exception '장의 작품과 물려받은 수정본은 바꿀 수 없습니다.' using errcode = '42501';
    end if;
    -- 물려받은 장을 고치면 '고친 장'이 된다 (갈림점 갱신은 4단계)
    if new.head_revision_id is distinct from old.head_revision_id
      and old.state = 'inherited' then
      new.state := 'modified';
    end if;
    new.updated_at := now();
  end if;

  if not (new.head_revision_id is not distinct from new.origin_revision_id
    or exists (
      select 1 from public.revisions r
      where r.id = new.head_revision_id and r.chapter_id = new.id
    )) then
    raise exception '이 장의 수정본이 아닙니다.' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger chapters_guard
  before insert or update on public.chapters
  for each row execute function public.chapters_guard();

-- ────────────────────────────────────────────────────────────
-- stars, notifications, reports
-- ────────────────────────────────────────────────────────────

create table public.stars (
  user_id uuid not null references public.profiles (id) on delete cascade,
  work_id uuid not null references public.works (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, work_id)
);

create index stars_work_id_idx on public.stars (work_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade, -- 받는 사람
  kind text not null,
  work_id uuid not null references public.works (id) on delete cascade,   -- 새 갈래 / 별 받은 작품 / 정사가 된 갈래
  actor_id uuid references public.profiles (id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_kind_values check (kind in ('fork', 'star', 'canon'))
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  work_id uuid not null references public.works (id) on delete cascade,
  chapter_id uuid references public.chapters (id) on delete set null,
  reason text not null,
  detail text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,

  constraint reports_reason_values
    check (reason in ('plagiarism', 'illegal', 'sexual_violent', 'other')),
  constraint reports_detail_length check (detail is null or char_length(detail) <= 1000),
  constraint reports_status_values check (status in ('open', 'resolved', 'dismissed'))
);

create index reports_status_created_idx on public.reports (status, created_at desc);

-- 별 수 유지와 별 알림
create function public.stars_after_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  if tg_op = 'INSERT' then
    update public.works set star_count = star_count + 1
      where id = new.work_id
      returning owner_id into v_owner;
    -- 별을 눌렀다 뗐다 해도 알림은 한 번만
    if v_owner is not null and v_owner <> new.user_id and not exists (
      select 1 from public.notifications n
      where n.user_id = v_owner and n.kind = 'star'
        and n.work_id = new.work_id and n.actor_id = new.user_id
    ) then
      insert into public.notifications (user_id, kind, work_id, actor_id)
        values (v_owner, 'star', new.work_id, new.user_id);
    end if;
    return new;
  else
    update public.works set star_count = greatest(star_count - 1, 0)
      where id = old.work_id;
    return old;
  end if;
end;
$$;

create trigger stars_after_change
  after insert or delete on public.stars
  for each row execute function public.stars_after_change();

-- ────────────────────────────────────────────────────────────
-- 함수: 갈래 내기, 정사 인정, 장 추가
-- ────────────────────────────────────────────────────────────

-- N장에서 갈라지기: 1~N-1장은 inherited, N장은 원작 본문을 초안으로 담은 modified.
-- N+1장 이후는 가져오지 않는다. 함수 하나가 한 트랜잭션이다.
create function public.fork_work(
  source_work_id uuid,
  at_position int,
  title text,
  note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_src public.works;
  v_new_id uuid := gen_random_uuid();
  v_slug text;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception '필명을 먼저 정해 주세요.' using errcode = '42501';
  end if;

  -- fork_count를 올리므로 원작 줄을 잠근다
  select * into v_src from public.works where id = source_work_id for update;
  if not found or v_src.visibility <> 'public' then
    raise exception '작품을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if not v_src.allow_fork or v_src.license = 'ARR' then
    raise exception '갈래를 허용하지 않는 작품입니다.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.chapters c
    where c.work_id = source_work_id and c.position = at_position
  ) then
    raise exception '%장이 없습니다.', at_position using errcode = 'P0002';
  end if;

  loop
    v_slug := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
    exit when not exists (select 1 from public.works where slug = v_slug);
  end loop;

  -- root_work_id·license는 works_guard가 부모에게서 채운다
  insert into public.works (
    id, owner_id, slug, title, license, allow_fork, ai_usage,
    parent_work_id, fork_chapter_position, fork_note, visibility
  ) values (
    v_new_id, v_uid, v_slug, btrim(fork_work.title), v_src.license, true, v_src.ai_usage,
    source_work_id, at_position, btrim(note), 'draft'
  );

  -- 본문은 복사하지 않고 원작 장이 가리키던 수정본 id만 가져온다
  insert into public.chapters (work_id, position, head_revision_id, origin_revision_id, state)
  select v_new_id, c.position, c.head_revision_id, c.head_revision_id,
         case when c.position < at_position then 'inherited' else 'modified' end
  from public.chapters c
  where c.work_id = source_work_id and c.position <= at_position;

  update public.works set fork_count = fork_count + 1 where id = source_work_id;

  if v_src.owner_id <> v_uid then
    insert into public.notifications (user_id, kind, work_id, actor_id)
      values (v_src.owner_id, 'fork', v_new_id, v_uid);
  end if;

  return v_new_id;
end;
$$;

comment on function public.fork_work is '갈래 만들기. 갈래는 이 함수로만 만든다.';

-- 정사 인정: 뿌리 원작자만 붙이고 뗀다
create function public.set_canon(p_work_id uuid, p_value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_work public.works;
  v_root_owner uuid;
begin
  select * into v_work from public.works where id = p_work_id for update;
  if not found or v_work.parent_work_id is null then
    raise exception '갈래를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  select owner_id into v_root_owner from public.works where id = v_work.root_work_id;
  if v_uid is null or v_root_owner <> v_uid then
    raise exception '뿌리 원작자만 정사를 정할 수 있습니다.' using errcode = '42501';
  end if;
  if p_value and v_work.visibility <> 'public' then
    raise exception '공개된 갈래만 정사로 인정할 수 있습니다.' using errcode = '42501';
  end if;
  if v_work.is_canon = p_value then
    return;
  end if;

  update public.works set is_canon = p_value where id = p_work_id;

  if p_value and v_work.owner_id <> v_uid then
    insert into public.notifications (user_id, kind, work_id, actor_id)
      values (v_work.owner_id, 'canon', p_work_id, v_uid);
  end if;
end;
$$;

-- 새 장과 첫 수정본을 함께 만든다(장과 수정본이 서로를 가리키므로 한 번에 넣는다)
create function public.add_chapter(
  p_work_id uuid,
  p_position int,
  p_title text,
  p_body_md text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_chapter_id uuid := gen_random_uuid();
  v_revision_id uuid;
begin
  if v_uid is null or not exists (
    select 1 from public.works w where w.id = p_work_id and w.owner_id = v_uid
  ) then
    raise exception '내 작품에만 장을 더할 수 있습니다.' using errcode = '42501';
  end if;

  insert into public.revisions (chapter_id, author_id, title, body_md, message)
    values (v_chapter_id, v_uid, btrim(p_title), p_body_md, p_message)
    returning id into v_revision_id;

  insert into public.chapters (id, work_id, position, head_revision_id, state)
    values (v_chapter_id, p_work_id, p_position, v_revision_id, 'new');

  return v_chapter_id;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- work_lineage: 뿌리까지 거슬러 올라가는 계보
-- ────────────────────────────────────────────────────────────

-- 계보는 출처 표시를 대신하므로 지울 수 없다. 조상 작품이 나중에 비공개·숨김이 돼도
-- 제목과 작가는 계보에 남는다. 그래서 소유자 권한으로 돌리고(security_invoker 끔),
-- 대신 내가 읽을 수 있는 작품의 계보만 돌려준다.
create view public.work_lineage
with (security_invoker = false)
as
with recursive lineage as (
  select w.id as work_id, w.id as ancestor_id, 0 as depth
  from public.works w
  union all
  select l.work_id, a.parent_work_id, l.depth + 1
  from lineage l
  join public.works a on a.id = l.ancestor_id
  where a.parent_work_id is not null
)
select
  l.work_id,
  l.depth,                     -- 0: 자기 자신, 1: 부모, … 가장 큰 값이 뿌리 원작
  a.id as ancestor_id,
  a.slug as ancestor_slug,
  a.title as ancestor_title,
  p.handle as ancestor_owner_handle,
  p.display_name as ancestor_owner_display_name,
  a.fork_chapter_position      -- 이 조상이 자기 부모의 몇 장에서 갈라졌는지
from lineage l
join public.works a on a.id = l.ancestor_id
join public.profiles p on p.id = a.owner_id
where public.can_read_work(l.work_id);

comment on view public.work_lineage is '작품별 계보. where work_id = ? order by depth desc 로 뿌리부터 읽는다.';

-- ────────────────────────────────────────────────────────────
-- RLS 정책
-- ────────────────────────────────────────────────────────────

alter table public.works enable row level security;
alter table public.revisions enable row level security;
alter table public.chapters enable row level security;
alter table public.stars enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;

-- works
create policy "works_select_readable"
  on public.works for select
  to anon, authenticated
  using (
    visibility = 'public'
    or owner_id = (select auth.uid())
    or (select public.is_admin())
  );

-- 직접 만들 수 있는 것은 원작뿐(갈래 컬럼은 insert 권한이 없다)
create policy "works_insert_own"
  on public.works for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

create policy "works_update_own"
  on public.works for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
-- 삭제 정책 없음: 원작이 사라지면 갈래와 계보가 깨진다(MVP에서는 비공개로 돌린다)

-- chapters
create policy "chapters_select_readable"
  on public.chapters for select
  to anon, authenticated
  using ((select public.can_read_work(work_id)));

create policy "chapters_update_own"
  on public.chapters for update
  to authenticated
  using ((select public.is_work_owner(work_id)))
  with check ((select public.is_work_owner(work_id)));

create policy "chapters_delete_own"
  on public.chapters for delete
  to authenticated
  using ((select public.is_work_owner(work_id)));
-- insert 정책 없음: 새 장은 add_chapter(), 갈래의 장은 fork_work()로만 만든다

-- revisions: 읽을 수 있는 작품의 장이 가리키거나 그 장에서 만든 수정본, 내가 쓴 수정본
create policy "revisions_select_readable"
  on public.revisions for select
  to anon, authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.chapters c
      where (c.id = revisions.chapter_id
          or c.head_revision_id = revisions.id
          or c.origin_revision_id = revisions.id)
        and public.can_read_work(c.work_id)
    )
  );

-- 내 작품에 이미 있는 장에만 새 수정본을 쌓는다
create policy "revisions_insert_own_chapter"
  on public.revisions for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.chapters c
      where c.id = revisions.chapter_id and public.is_work_owner(c.work_id)
    )
  );
-- update/delete 정책 없음

-- stars: 본인 것만 보고, 남의 공개 작품에만 누른다
create policy "stars_select_own"
  on public.stars for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "stars_insert_own"
  on public.stars for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.works w
      where w.id = stars.work_id
        and w.visibility = 'public'
        and w.owner_id <> (select auth.uid())
    )
  );

create policy "stars_delete_own"
  on public.stars for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- notifications: 받는 사람만 보고 읽음 표시·삭제한다. 쌓는 것은 함수·트리거만.
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "notifications_delete_own"
  on public.notifications for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- reports: 프로필이 있는 사람은 읽을 수 있는 작품을 신고한다. 처리는 관리자만.
create policy "reports_insert_own"
  on public.reports for insert
  to authenticated
  with check (
    reporter_id = (select auth.uid())
    and (select public.can_read_work(work_id))
    and (chapter_id is null or exists (
      select 1 from public.chapters c
      where c.id = reports.chapter_id and c.work_id = reports.work_id
    ))
  );

create policy "reports_select_own_or_admin"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));

create policy "reports_update_admin"
  on public.reports for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- ────────────────────────────────────────────────────────────
-- 테이블·컬럼 권한
-- ────────────────────────────────────────────────────────────
-- Supabase 기본 권한(ALL)을 걷어내고 필요한 것만 다시 준다.
-- truncate는 RLS를 거치지 않으므로 profiles까지 함께 막는다.

revoke all on public.works, public.revisions, public.chapters,
  public.stars, public.notifications, public.reports
  from anon, authenticated;
revoke truncate, references, trigger on public.profiles from anon, authenticated;

grant select on public.works, public.chapters, public.revisions to anon, authenticated;
grant select on public.work_lineage to anon, authenticated;

grant insert (owner_id, slug, title, summary, license, allow_fork, ai_usage, visibility)
  on public.works to authenticated;
grant update (title, summary, license, allow_fork, ai_usage, visibility, fork_note)
  on public.works to authenticated;

grant update (position, head_revision_id) on public.chapters to authenticated;
grant delete on public.chapters to authenticated;

grant insert (chapter_id, author_id, title, body_md, parent_revision_id, message)
  on public.revisions to authenticated;

grant select, delete on public.stars to authenticated;
grant insert (user_id, work_id) on public.stars to authenticated;

grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

grant select on public.reports to authenticated;
grant insert (reporter_id, work_id, chapter_id, reason, detail) on public.reports to authenticated;
grant update (status, resolved_at, resolved_by) on public.reports to authenticated;

-- 함수 실행 권한: 기본으로 public에 열려 있는 것을 닫고 필요한 곳에만 준다
revoke execute on function
  public.is_privileged_role(), public.is_admin(), public.can_read_work(uuid),
  public.is_work_owner(uuid), public.works_guard(), public.revisions_immutable(),
  public.chapters_guard(), public.stars_after_change(),
  public.fork_work(uuid, int, text, text), public.set_canon(uuid, boolean),
  public.add_chapter(uuid, int, text, text, text)
  from public, anon, authenticated;

-- 정책·트리거 안에서 부르는 헬퍼
grant execute on function
  public.is_privileged_role(), public.is_admin(), public.can_read_work(uuid),
  public.is_work_owner(uuid)
  to anon, authenticated;

grant execute on function
  public.fork_work(uuid, int, text, text), public.set_canon(uuid, boolean),
  public.add_chapter(uuid, int, text, text, text)
  to authenticated;
