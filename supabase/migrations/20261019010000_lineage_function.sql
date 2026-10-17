-- 계보 조회 성능: work_lineage 뷰 대신 쓸 work_lineage_of() 함수.
--   뷰는 재귀 쿼리가 모든 작품의 계보를 만든 뒤 work_id로 걸렀다(조건이 재귀 안으로 들어가지 않아 works 전체 스캔).
--   함수는 받은 작품 하나에서 parent_work_id를 따라 뿌리까지만 올라가므로 계보 깊이만큼만 읽는다.
--
-- 계보 표시 규칙은 그대로다(tests/db/lineage.test.ts).
--   - 계보는 출처 표시를 대신하므로 숨기거나 지울 수 없다. 조상이 임시 저장·숨김이 돼도 자리는 남는다.
--     그래서 만든 사람 권한(security definer)으로 돌고, 대신 내가 읽을 수 있는 작품의 계보만 돌려준다.
--   - 숨겨진 조상은 그 작가·관리자가 아니면 제목·주소·작가를 비운다(화면에는 '숨겨진 작품').

create function public.work_lineage_of(p_work_id uuid)
returns table (
  work_id uuid,
  depth int,                          -- 0: 자기 자신, 1: 부모, … 가장 큰 값이 뿌리 원작
  ancestor_id uuid,
  ancestor_slug text,
  ancestor_title text,
  ancestor_owner_handle text,
  ancestor_owner_display_name text,
  fork_chapter_position int,          -- 이 조상이 자기 부모의 몇 장에서 갈라졌는지
  ancestor_hidden boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with recursive up as (
    select w.id, w.parent_work_id, 0 as depth
    from public.works w
    where w.id = p_work_id and public.can_read_work(p_work_id)
    union all
    select a.id, a.parent_work_id, up.depth + 1
    from up
    join public.works a on a.id = up.parent_work_id
    where up.depth < 1000                 -- 계보는 순환할 수 없지만(works_guard) 만일에 대비한다
  )
  select
    p_work_id,
    up.depth,
    a.id,
    case when m.masked then null else a.slug end,
    case when m.masked then null else a.title end,
    case when m.masked then null else p.handle end,
    case when m.masked then null else p.display_name end,
    a.fork_chapter_position,
    a.visibility = 'hidden'
  from up
  join public.works a on a.id = up.id
  join public.profiles p on p.id = a.owner_id
  cross join lateral (
    select a.visibility = 'hidden'
      and a.owner_id is distinct from (select auth.uid())
      and not public.is_admin() as masked
  ) m
  order by up.depth desc
$$;

comment on function public.work_lineage_of is
  '작품 하나의 계보(뿌리부터 depth 내림차순). 읽을 수 없는 작품이면 비어 있다. 숨겨진 조상은 그 작가·관리자가 아니면 제목·주소·작가가 null.';

revoke execute on function public.work_lineage_of(uuid) from public, anon, authenticated;
grant execute on function public.work_lineage_of(uuid) to anon, authenticated;

-- work_lineage 뷰는 배포된 앱이 새 함수로 옮겨 간 뒤 다음 마이그레이션에서 지운다(지금 지우면 운영 화면의 계보가 깨진다).
