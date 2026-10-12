-- 3단계: 작품 올리기
--   1) first_published_at: 처음 공개된 때. 트리거만 채우고, 한 번 채우면 바뀌지 않는다.
--   2) 작품 주소(slug)는 한 번도 공개되지 않은 작품만 바꿀 수 있다.
--   3) resolve_slug(): 겹치면 -2, -3을 붙인 최종 주소를 저장 전에 미리 알려 준다.
--   4) create_work(): 작품·장·수정본을 한 트랜잭션에 만든다.

alter table public.works add column first_published_at timestamptz;

comment on column public.works.first_published_at is
  '처음 공개된 때. 이 값이 있으면 주소를 바꿀 수 없다. 트리거만 채운다.';

-- 지금 공개 중이거나 숨겨진 작품은 이미 공개된 적이 있는 것으로 본다
update public.works set first_published_at = created_at
  where visibility in ('public', 'hidden');

create or replace function public.works_guard()
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
    new.first_published_at := case when new.visibility = 'public' then now() end;
  else
    if new.owner_id is distinct from old.owner_id
      or new.parent_work_id is distinct from old.parent_work_id
      or new.root_work_id is distinct from old.root_work_id then
      raise exception '작가와 계보는 바꿀 수 없습니다.' using errcode = '42501';
    end if;
    if new.slug is distinct from old.slug and old.first_published_at is not null then
      raise exception '공개한 작품의 주소는 바꿀 수 없습니다.' using errcode = '42501';
    end if;
    if new.parent_work_id is not null and new.license is distinct from old.license then
      raise exception '갈래는 원작의 라이선스를 바꿀 수 없습니다.' using errcode = '42501';
    end if;
    new.first_published_at := coalesce(
      old.first_published_at,
      case when new.visibility = 'public' then now() end
    );
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

grant update (slug) on public.works to authenticated;

-- ────────────────────────────────────────────────────────────
-- resolve_slug: 비어 있으면 그대로, 겹치면 -2, -3 …을 붙인 주소
-- ────────────────────────────────────────────────────────────
-- 남의 임시 저장 작품은 RLS로 보이지 않으므로 definer로 모든 주소를 본다.
-- 돌려주는 것은 주소 문자열뿐이다. p_except_work_id는 내 작품 주소를 고칠 때 자기 자신을 뺀다.
create function public.resolve_slug(p_slug text, p_except_work_id uuid default null)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_candidate text := p_slug;
  v_suffix text;
  n int := 1;
begin
  if p_slug is null
    or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(p_slug) not between 3 and 80 then
    raise exception '주소 형식이 맞지 않습니다.' using errcode = '22023';
  end if;

  while exists (
    select 1 from public.works w
    where w.slug = v_candidate
      and w.id is distinct from p_except_work_id
  ) loop
    n := n + 1;
    v_suffix := '-' || n;
    -- 80자를 넘지 않게 앞부분을 자르고, 잘린 끝의 하이픈은 뗀다
    v_candidate := rtrim(left(p_slug, 80 - char_length(v_suffix)), '-') || v_suffix;
  end loop;

  return v_candidate;
end;
$$;

comment on function public.resolve_slug is
  '저장 전에 보여 줄 최종 주소. 겹치면 -2, -3을 붙인다. 실제 저장은 그 주소 그대로 하고, 그 사이 누가 먼저 쓰면 unique 위반이 난다.';

-- ────────────────────────────────────────────────────────────
-- create_work: 작품 하나와 장·첫 수정본들을 한 번에 만든다
-- ────────────────────────────────────────────────────────────
-- p_chapters: [{"title": "...", "body": "..."}, …] 순서대로 1장, 2장 …
-- 주소는 받은 그대로 쓴다(겹치면 works_slug_key unique 위반 23505).
create function public.create_work(
  p_title text,
  p_summary text,
  p_slug text,
  p_license text,
  p_allow_fork boolean,
  p_ai_usage text,
  p_visibility text,
  p_chapters jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_work_id uuid := gen_random_uuid();
  v_chapter jsonb;
  v_chapter_id uuid;
  v_revision_id uuid;
  v_position int := 0;
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid) then
    raise exception '필명을 정하고 약관에 동의해야 작품을 올릴 수 있습니다.' using errcode = '42501';
  end if;
  if p_visibility not in ('draft', 'public') then
    raise exception '임시 저장이나 공개만 고를 수 있습니다.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_chapters) is distinct from 'array'
    or jsonb_array_length(p_chapters) not between 1 and 300 then
    raise exception '장은 1~300개여야 합니다.' using errcode = '22023';
  end if;

  -- 형식·길이·라이선스 검사는 works의 제약과 works_guard가 한다
  insert into public.works (
    id, owner_id, slug, title, summary, license, allow_fork, ai_usage, visibility
  ) values (
    v_work_id, v_uid, p_slug, btrim(p_title), nullif(btrim(p_summary), ''),
    p_license, p_allow_fork, p_ai_usage, p_visibility
  );

  for v_chapter in select value from jsonb_array_elements(p_chapters) loop
    if jsonb_typeof(v_chapter -> 'title') is distinct from 'string'
      or jsonb_typeof(v_chapter -> 'body') is distinct from 'string' then
      raise exception '장마다 제목과 본문이 있어야 합니다.' using errcode = '22023';
    end if;

    v_position := v_position + 1;
    v_chapter_id := gen_random_uuid();

    insert into public.revisions (chapter_id, author_id, title, body_md, message)
      values (v_chapter_id, v_uid, btrim(v_chapter ->> 'title'), v_chapter ->> 'body', '올리기')
      returning id into v_revision_id;

    insert into public.chapters (id, work_id, position, head_revision_id, state)
      values (v_chapter_id, v_work_id, v_position, v_revision_id, 'new');
  end loop;

  return v_work_id;
end;
$$;

comment on function public.create_work is '작품 올리기. 작품·장·첫 수정본을 한 트랜잭션에 만든다.';

revoke execute on function
  public.resolve_slug(text, uuid),
  public.create_work(text, text, text, text, boolean, text, text, jsonb)
  from public, anon, authenticated;

grant execute on function
  public.resolve_slug(text, uuid),
  public.create_work(text, text, text, text, boolean, text, text, jsonb)
  to authenticated;
