-- 6단계: 반응·운영
--   1) fork_count는 '공개된 직접 갈래 수'다. works 트리거가 유지하고,
--      fork_work·delete_work에서 직접 올리고 내리던 코드는 뺀다. 지금 값도 이 기준으로 다시 센다.
--   2) 관리자 숨김·복구: admin_hide_work / admin_restore_work(is_admin() 확인).
--      숨기기 직전 상태를 hidden_from에 적어 두고 복구 때 그 상태로 돌린다.
--      숨기면 그 작품의 열린 신고를 처리됨으로 닫는다. 숨김·복구 때 작가에게 알린다(관리자 이름은 남기지 않는다).
--   3) 계보: 숨겨진 조상은 그 작가·관리자가 아니면 제목·주소·작가 없이 '숨겨진 작품'으로만 보인다.
--      숨겨진 작품의 갈래는 그대로 둔다.
--   4) 신고는 관리자만 읽는다(누가 신고했는지는 관리자만 안다).
--   5) 같은 사람이 같은 작품·장에 열린 신고를 두 번 넣지 못한다.
--   6) trending_originals: 최근 N일에 처음 공개된 갈래 수(갈래의 갈래 포함)를 뿌리 원작별로 센다.

-- ────────────────────────────────────────────────────────────
-- 숨김 상태 기록
-- ────────────────────────────────────────────────────────────

alter table public.works
  add column hidden_from text,
  add column hidden_at timestamptz;

comment on column public.works.hidden_from is '관리자가 숨기기 직전의 공개 상태(draft | public). 복구 때 이 상태로 돌린다.';
comment on column public.works.hidden_at is '관리자가 숨긴 때';

-- 이미 숨겨진 작품은 공개 중에 숨겨진 것으로 본다
update public.works set hidden_from = 'public', hidden_at = coalesce(updated_at, now())
  where visibility = 'hidden';

alter table public.works
  add constraint works_hidden_shape check (
    (visibility = 'hidden') = (hidden_from is not null)
    and (hidden_from is null or hidden_from in ('draft', 'public'))
  );

-- ────────────────────────────────────────────────────────────
-- fork_count: 공개된 직접 갈래 수
-- ────────────────────────────────────────────────────────────
-- 부모 줄을 고치므로 definer로 돈다(fork_count는 사용자에게 열려 있지 않다).
create function public.works_maintain_fork_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.visibility = new.visibility then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') and old.parent_work_id is not null and old.visibility = 'public' then
    update public.works set fork_count = greatest(fork_count - 1, 0) where id = old.parent_work_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.parent_work_id is not null and new.visibility = 'public' then
    update public.works set fork_count = fork_count + 1 where id = new.parent_work_id;
  end if;

  return null;
end;
$$;

create trigger works_maintain_fork_count
  after insert or delete or update of visibility on public.works
  for each row execute function public.works_maintain_fork_count();

update public.works w
  set fork_count = c.n
  from (
    select p.id, (
      select count(*) from public.works f
      where f.parent_work_id = p.id and f.visibility = 'public'
    )::int as n
    from public.works p
  ) c
  where c.id = w.id and w.fork_count <> c.n;

-- fork_work: fork_count를 직접 올리지 않는다(공개될 때 트리거가 센다)
create or replace function public.fork_work(
  source_work_id uuid,
  at_position int,
  title text,
  note text,
  requested_slug text default null
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
  v_slug text := requested_slug;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception '필명을 먼저 정해 주세요.' using errcode = '42501';
  end if;

  -- 갈라지는 동안 원작이 비공개·갈래 금지로 바뀌지 않게 잠근다
  select * into v_src from public.works where id = source_work_id for share;
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

  if v_slug is null then
    loop
      v_slug := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      exit when not exists (select 1 from public.works where slug = v_slug);
    end loop;
  end if;

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

  -- 원작의 fork_count와 원작자 알림은 갈래가 공개될 때 트리거가 처리한다
  return v_new_id;
end;
$$;

-- delete_work: 지우는 작품은 공개된 적이 없으므로 fork_count에 들어 있지 않다
create or replace function public.delete_work(p_work_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work public.works;
begin
  v_work := public.lock_own_work(p_work_id);

  if v_work.first_published_at is not null or v_work.visibility <> 'draft' then
    raise exception '한 번이라도 공개한 작품은 지울 수 없습니다. 임시 저장으로 돌려 주세요.'
      using errcode = '42501';
  end if;
  -- 공개해야 갈라질 수 있으므로 보통은 생기지 않지만, 계보가 끊기지 않게 한 번 더 막는다
  if exists (select 1 from public.works w where w.parent_work_id = p_work_id) then
    raise exception '갈래가 있는 작품은 지울 수 없습니다.' using errcode = '42501';
  end if;

  delete from public.works where id = p_work_id;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 알림 종류: 관리자 숨김·복구
-- ────────────────────────────────────────────────────────────

alter table public.notifications drop constraint notifications_kind_values;
alter table public.notifications add constraint notifications_kind_values
  check (kind in ('fork', 'star', 'canon', 'hidden', 'restored'));

create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;

-- ────────────────────────────────────────────────────────────
-- 관리자 숨김·복구
-- ────────────────────────────────────────────────────────────

create function public.admin_hide_work(p_work_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work public.works;
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있습니다.' using errcode = '42501';
  end if;

  select * into v_work from public.works where id = p_work_id for update;
  if not found then
    raise exception '작품을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  if v_work.visibility <> 'hidden' then
    update public.works
      set visibility = 'hidden', hidden_from = v_work.visibility, hidden_at = now()
      where id = p_work_id;
    -- 누가 숨겼는지는 작가에게 알리지 않는다
    insert into public.notifications (user_id, kind, work_id)
      values (v_work.owner_id, 'hidden', p_work_id);
  end if;

  update public.reports
    set status = 'resolved', resolved_at = now(), resolved_by = (select auth.uid())
    where work_id = p_work_id and status = 'open';
end;
$$;

comment on function public.admin_hide_work is '관리자 숨김. 숨기기 직전 상태를 적어 두고, 열린 신고를 닫고, 작가에게 알린다.';

create function public.admin_restore_work(p_work_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work public.works;
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있습니다.' using errcode = '42501';
  end if;

  select * into v_work from public.works where id = p_work_id for update;
  if not found then
    raise exception '작품을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if v_work.visibility <> 'hidden' then
    raise exception '숨겨진 작품이 아닙니다.' using errcode = '22023';
  end if;

  update public.works
    set visibility = v_work.hidden_from, hidden_from = null, hidden_at = null
    where id = p_work_id;
  insert into public.notifications (user_id, kind, work_id)
    values (v_work.owner_id, 'restored', p_work_id);
end;
$$;

comment on function public.admin_restore_work is '관리자 복구. 숨기기 직전 상태로 돌리고 작가에게 알린다.';

-- ────────────────────────────────────────────────────────────
-- 계보: 숨겨진 조상 가리기
-- ────────────────────────────────────────────────────────────
-- 계보 자리는 지우지 않고(몇 장에서 갈라졌는지는 남긴다) 제목·주소·작가만 비운다.
-- 그 작품의 작가와 관리자는 그대로 본다.
create or replace view public.work_lineage
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
  case when m.masked then null else a.slug end as ancestor_slug,
  case when m.masked then null else a.title end as ancestor_title,
  case when m.masked then null else p.handle end as ancestor_owner_handle,
  case when m.masked then null else p.display_name end as ancestor_owner_display_name,
  a.fork_chapter_position,     -- 이 조상이 자기 부모의 몇 장에서 갈라졌는지
  a.visibility = 'hidden' as ancestor_hidden
from lineage l
join public.works a on a.id = l.ancestor_id
join public.profiles p on p.id = a.owner_id
cross join lateral (
  select a.visibility = 'hidden'
    and a.owner_id is distinct from (select auth.uid())
    and not public.is_admin() as masked
) m
where public.can_read_work(l.work_id);

comment on view public.work_lineage is
  '작품별 계보. where work_id = ? order by depth desc 로 뿌리부터 읽는다. 숨겨진 조상은 제목·주소·작가가 null이다.';

-- ────────────────────────────────────────────────────────────
-- 신고: 관리자만 읽는다, 열린 신고는 한 번만
-- ────────────────────────────────────────────────────────────

drop policy "reports_select_own_or_admin" on public.reports;

create policy "reports_select_admin"
  on public.reports for select
  to authenticated
  using ((select public.is_admin()));

-- 장이 지워지면 chapter_id가 null이 되므로 unique 인덱스 대신 넣을 때만 검사한다
create function public.reports_open_once()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.reports r
    where r.reporter_id = new.reporter_id
      and r.work_id = new.work_id
      and r.chapter_id is not distinct from new.chapter_id
      and r.status = 'open'
  ) then
    raise exception '이미 신고했습니다. 관리자가 확인하고 있습니다.' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger reports_open_once
  before insert on public.reports
  for each row execute function public.reports_open_once();

create index reports_work_id_idx on public.reports (work_id);

-- ────────────────────────────────────────────────────────────
-- 홈: 요즘 갈래가 많이 나는 원작
-- ────────────────────────────────────────────────────────────
-- 호출한 사람 권한으로 돈다(RLS). 공개된 갈래와 공개된 뿌리 원작만 센다.
create function public.trending_originals(p_days int default 14, p_limit int default 12)
returns table (work_id uuid, recent_forks int)
language sql
stable
set search_path = ''
as $$
  select f.root_work_id, count(*)::int
  from public.works f
  join public.works r on r.id = f.root_work_id and r.visibility = 'public'
  where f.parent_work_id is not null
    and f.visibility = 'public'
    and f.first_published_at >= now() - make_interval(days => greatest(p_days, 1))
  group by f.root_work_id
  order by count(*) desc, max(f.first_published_at) desc
  limit least(greatest(p_limit, 1), 50)
$$;

comment on function public.trending_originals is '최근 p_days일에 처음 공개된 갈래 수(갈래의 갈래 포함)가 많은 뿌리 원작.';

create index works_public_forks_published_idx on public.works (first_published_at desc)
  where visibility = 'public' and parent_work_id is not null;
create index works_public_stars_idx on public.works (star_count desc)
  where visibility = 'public';

-- ────────────────────────────────────────────────────────────
-- 함수 실행 권한
-- ────────────────────────────────────────────────────────────

revoke execute on function
  public.works_maintain_fork_count(),
  public.reports_open_once(),
  public.admin_hide_work(uuid),
  public.admin_restore_work(uuid),
  public.trending_originals(int, int)
  from public, anon, authenticated;

grant execute on function
  public.admin_hide_work(uuid),
  public.admin_restore_work(uuid)
  to authenticated;

grant execute on function public.trending_originals(int, int) to anon, authenticated;
