-- 4단계: 갈라지기·고쳐 쓰기
--   1) 장 바꾸기는 함수로만 한다: save_chapter(수정본 쌓기 + head 이동), revert_chapter,
--      add_chapter(끼워 넣기), delete_chapter, move_chapter. 장 번호는 1부터 빈칸 없이 잇는다.
--   2) 갈림점 자동 갱신: 갈래에서 물려받은 장이 고쳐지거나·지워지거나·움직이면
--      fork_chapter_position을 '처음으로 달라진 장'으로 당긴다(트리거라 어느 경로로 바꿔도 돈다).
--   3) 새 갈래 알림을 fork_work에서 빼고, 갈래가 처음 공개될 때 부모 작가에게 한 번 보낸다.
--   4) fork_work가 요청한 주소(로마자 자동 + 수정)를 받는다. 공개 뒤 잠금은 works_guard가 한다.
--   5) delete_work: 한 번도 공개하지 않았고 갈래도 없는 작품은 작가가 지운다.

-- ────────────────────────────────────────────────────────────
-- 직접 쓰기 막기: 장과 수정본은 아래 함수로만 바꾼다
-- ────────────────────────────────────────────────────────────

drop policy "chapters_update_own" on public.chapters;
drop policy "chapters_delete_own" on public.chapters;
drop policy "revisions_insert_own_chapter" on public.revisions;

-- 표 단위 revoke는 컬럼 단위 권한도 함께 거둔다
revoke update, delete on public.chapters from authenticated;
revoke insert on public.revisions from authenticated;

-- 내 작품 줄을 잠그고 돌려준다. 장 구조를 바꾸는 함수가 서로 엇갈리지 않게 작품 단위로 줄을 세운다.
create function public.lock_own_work(p_work_id uuid)
returns public.works
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work public.works;
begin
  select * into v_work from public.works where id = p_work_id for update;
  if not found or v_work.owner_id is distinct from (select auth.uid()) then
    raise exception '내 작품만 고칠 수 있습니다.' using errcode = '42501';
  end if;
  return v_work;
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 장 저장·되돌리기
-- ────────────────────────────────────────────────────────────

-- 수정본 하나를 쌓고 head를 옮긴다. 새 head 수정본 id를 돌려준다.
-- p_base_revision_id: 편집을 시작한 head. 그 사이 다른 탭에서 저장했으면 덮어쓰지 않고 거절한다(40001).
-- 제목·본문이 head와 같으면 수정본을 만들지 않고 head를 그대로 돌려준다.
create function public.save_chapter(
  p_chapter_id uuid,
  p_title text,
  p_body_md text,
  p_base_revision_id uuid,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_id uuid;
  v_ch public.chapters;
  v_head public.revisions;
  v_rev_id uuid;
begin
  select work_id into v_work_id from public.chapters where id = p_chapter_id;
  if not found then
    raise exception '장을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  perform public.lock_own_work(v_work_id);

  select * into v_ch from public.chapters where id = p_chapter_id;
  if v_ch.head_revision_id is distinct from p_base_revision_id then
    raise exception '그 사이 이 장이 다른 곳에서 저장되었습니다. 새로 불러온 뒤 다시 저장해 주세요.'
      using errcode = '40001';
  end if;

  select * into v_head from public.revisions where id = v_ch.head_revision_id;
  if v_head.title = btrim(p_title) and v_head.body_md = p_body_md then
    return v_head.id;
  end if;

  -- 제목·본문·메모 길이는 revisions의 제약이 검사한다
  insert into public.revisions (chapter_id, author_id, title, body_md, parent_revision_id, message)
    values (v_ch.id, (select auth.uid()), btrim(p_title), p_body_md, v_ch.head_revision_id,
            nullif(btrim(p_message), ''))
    returning id into v_rev_id;

  -- 물려받은 장이면 chapters_guard가 modified로 바꾸고, 갈림점 트리거가 갈림점을 당긴다
  update public.chapters set head_revision_id = v_rev_id where id = v_ch.id;

  return v_rev_id;
end;
$$;

comment on function public.save_chapter is '장 저장. 수정본 쌓기와 head 이동을 한 트랜잭션에 한다.';

-- 이 장의 이전 수정본(또는 물려받은 원작 수정본)의 제목·본문으로 새 수정본을 쌓는다.
-- 수정본은 지우지 않으므로 되돌리기도 기록에 남는다.
create function public.revert_chapter(
  p_chapter_id uuid,
  p_revision_id uuid,
  p_base_revision_id uuid,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ch public.chapters;
  v_target public.revisions;
begin
  select * into v_ch from public.chapters where id = p_chapter_id;
  if not found then
    raise exception '장을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  perform public.lock_own_work(v_ch.work_id);

  select * into v_target from public.revisions r
  where r.id = p_revision_id
    and (r.chapter_id = v_ch.id or r.id = v_ch.origin_revision_id);
  if not found then
    raise exception '이 장의 수정본이 아닙니다.' using errcode = 'P0002';
  end if;

  return public.save_chapter(
    p_chapter_id, v_target.title, v_target.body_md, p_base_revision_id,
    coalesce(nullif(btrim(p_message), ''), '이전 수정본으로 되돌리기')
  );
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 장 추가·삭제·순서 변경
-- ────────────────────────────────────────────────────────────

-- p_position에 새 장을 넣는다. 그 자리부터 뒤의 장은 한 칸씩 밀린다(1 ~ 장 수+1).
create or replace function public.add_chapter(
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
  v_chapter_id uuid := gen_random_uuid();
  v_revision_id uuid;
  v_count int;
begin
  perform public.lock_own_work(p_work_id);

  select count(*) into v_count from public.chapters where work_id = p_work_id;
  if v_count >= 300 then
    raise exception '장은 300개까지 둘 수 있습니다.' using errcode = '22023';
  end if;
  if p_position is null or p_position not between 1 and v_count + 1 then
    raise exception '장 번호는 1~%이어야 합니다.', v_count + 1 using errcode = '22023';
  end if;

  -- (work_id, position) unique는 문장 끝에서 검사하므로 한 문장으로 민다
  update public.chapters set position = position + 1
    where work_id = p_work_id and position >= p_position;

  insert into public.revisions (chapter_id, author_id, title, body_md, message)
    values (v_chapter_id, (select auth.uid()), btrim(p_title), p_body_md, nullif(btrim(p_message), ''))
    returning id into v_revision_id;

  insert into public.chapters (id, work_id, position, head_revision_id, state)
    values (v_chapter_id, p_work_id, p_position, v_revision_id, 'new');

  return v_chapter_id;
end;
$$;

-- 장을 지우고 뒤의 장을 한 칸씩 당긴다. 마지막 남은 장은 지울 수 없다.
-- 수정본은 지우지 않는다(다른 갈래가 물려받아 가리키고 있을 수 있다).
create function public.delete_chapter(p_chapter_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ch public.chapters;
begin
  select * into v_ch from public.chapters where id = p_chapter_id;
  if not found then
    raise exception '장을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  perform public.lock_own_work(v_ch.work_id);

  if (select count(*) from public.chapters where work_id = v_ch.work_id) <= 1 then
    raise exception '마지막 남은 장은 지울 수 없습니다.' using errcode = '22023';
  end if;

  delete from public.chapters where id = p_chapter_id;
  update public.chapters set position = position - 1
    where work_id = v_ch.work_id and position > v_ch.position;
end;
$$;

-- 장 하나를 p_to_position으로 옮기고, 사이의 장들을 한 칸씩 민다
create function public.move_chapter(p_chapter_id uuid, p_to_position int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ch public.chapters;
  v_count int;
begin
  select * into v_ch from public.chapters where id = p_chapter_id;
  if not found then
    raise exception '장을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  perform public.lock_own_work(v_ch.work_id);

  select count(*) into v_count from public.chapters where work_id = v_ch.work_id;
  if p_to_position is null or p_to_position not between 1 and v_count then
    raise exception '장 번호는 1~%이어야 합니다.', v_count using errcode = '22023';
  end if;
  if p_to_position = v_ch.position then
    return;
  end if;

  update public.chapters
    set position = case
      when id = p_chapter_id then p_to_position
      when p_to_position < v_ch.position then position + 1
      else position - 1
    end
  where work_id = v_ch.work_id
    and position between least(v_ch.position, p_to_position) and greatest(v_ch.position, p_to_position);
end;
$$;

-- ────────────────────────────────────────────────────────────
-- 갈림점 자동 갱신
-- ────────────────────────────────────────────────────────────

create or replace function public.chapters_guard()
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
    -- 물려받은 장을 고치면 '고친 장'이 된다(갈림점은 chapters_track_fork_point가 당긴다)
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

-- 갈림점은 '처음으로 달라진 장'이라 당겨지기만 한다.
--   물려받은 장이 고쳐지거나 움직이면: 원래 자리와 새 자리 중 앞쪽
--   물려받은 장이 지워지면: 그 자리
--   물려받지 않은 장이 생기거나 움직이면: 그 자리(뒤에 이어 쓰는 장은 갈림점 뒤라 그대로다)
-- works.fork_chapter_position은 사용자에게 열려 있지 않으므로 definer로 돈다.
create function public.chapters_track_fork_point()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_work_id uuid;
  v_pos int;
begin
  if tg_op = 'DELETE' then
    v_work_id := old.work_id;
    if old.state = 'inherited' then
      v_pos := old.position;
    end if;
  elsif tg_op = 'INSERT' then
    v_work_id := new.work_id;
    if new.state <> 'inherited' then
      v_pos := new.position;
    end if;
  else
    v_work_id := new.work_id;
    if old.state = 'inherited'
      and (new.state <> 'inherited' or new.position <> old.position) then
      v_pos := least(old.position, new.position);
    elsif new.state <> 'inherited' and new.position <> old.position then
      v_pos := new.position;
    end if;
  end if;

  if v_pos is not null then
    update public.works
      set fork_chapter_position = v_pos
      where id = v_work_id
        and parent_work_id is not null
        and fork_chapter_position > v_pos;
  end if;

  return null;
end;
$$;

create trigger chapters_track_fork_point
  after insert or update or delete on public.chapters
  for each row execute function public.chapters_track_fork_point();

-- ────────────────────────────────────────────────────────────
-- 새 갈래 알림: 처음 공개될 때 부모 작가에게 한 번
-- ────────────────────────────────────────────────────────────
-- first_published_at은 한 번 채워지면 바뀌지 않으므로(works_guard) 비공개 후 재공개해도 다시 오지 않는다.
-- 자기 작품에서 갈라진 갈래는 알리지 않는다.
create function public.works_notify_fork_published()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_parent_owner uuid;
begin
  select owner_id into v_parent_owner from public.works where id = new.parent_work_id;
  if v_parent_owner is not null and v_parent_owner <> new.owner_id then
    insert into public.notifications (user_id, kind, work_id, actor_id)
      values (v_parent_owner, 'fork', new.id, new.owner_id);
  end if;
  return null;
end;
$$;

-- first_published_at은 works_guard(BEFORE)가 채우므로 'update of 컬럼'으로 거르지 않고 when으로 거른다
create trigger works_notify_fork_published
  after update on public.works
  for each row
  when (old.first_published_at is null
    and new.first_published_at is not null
    and new.parent_work_id is not null)
  execute function public.works_notify_fork_published();

-- ────────────────────────────────────────────────────────────
-- fork_work: 알림 빼기, 요청한 주소 받기
-- ────────────────────────────────────────────────────────────

drop function public.fork_work(uuid, int, text, text);

-- N장에서 갈라지기: 1~N-1장은 inherited, N장은 원작 본문을 초안으로 담은 modified.
-- N+1장 이후는 가져오지 않는다. 함수 하나가 한 트랜잭션이다.
-- requested_slug: resolve_slug로 확인해 보여 준 최종 주소. 없으면 8자리 무작위 주소.
-- 겹치면 works_slug_key unique 위반(23505), 형식이 틀리면 works_slug_format 위반(23514).
create function public.fork_work(
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

  update public.works set fork_count = fork_count + 1 where id = source_work_id;

  -- 원작자 알림은 갈래가 처음 공개될 때 works_notify_fork_published가 보낸다
  return v_new_id;
end;
$$;

comment on function public.fork_work is '갈래 만들기. 갈래는 이 함수로만 만든다.';

-- ────────────────────────────────────────────────────────────
-- delete_work: 한 번도 공개하지 않았고 갈래도 없는 작품 지우기
-- ────────────────────────────────────────────────────────────
-- 장·별·알림·신고는 cascade로 함께 지워진다. 수정본은 쌓기만 하는 규칙대로 남긴다
-- (갈래라면 물려받은 원작 수정본을 가리키고 있었을 뿐이므로 원작에는 영향이 없다).
create function public.delete_work(p_work_id uuid)
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

  if v_work.parent_work_id is not null then
    update public.works set fork_count = greatest(fork_count - 1, 0)
      where id = v_work.parent_work_id;
  end if;
end;
$$;

comment on function public.delete_work is '공개한 적 없고 갈래도 없는 내 작품 지우기.';

-- ────────────────────────────────────────────────────────────
-- 함수 실행 권한
-- ────────────────────────────────────────────────────────────

revoke execute on function
  public.lock_own_work(uuid),
  public.save_chapter(uuid, text, text, uuid, text),
  public.revert_chapter(uuid, uuid, uuid, text),
  public.delete_chapter(uuid),
  public.move_chapter(uuid, int),
  public.chapters_track_fork_point(),
  public.works_notify_fork_published(),
  public.fork_work(uuid, int, text, text, text),
  public.delete_work(uuid)
  from public, anon, authenticated;

grant execute on function
  public.save_chapter(uuid, text, text, uuid, text),
  public.revert_chapter(uuid, uuid, uuid, text),
  public.delete_chapter(uuid),
  public.move_chapter(uuid, int),
  public.fork_work(uuid, int, text, text, text),
  public.delete_work(uuid)
  to authenticated;
