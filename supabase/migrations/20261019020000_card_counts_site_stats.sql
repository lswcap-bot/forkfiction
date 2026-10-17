-- 리디자인용 조회 두 가지.
--   1) work_chapter_counts: 목록 카드의 분절 막대와 '7장 물려받음 · 4장 새로 씀' 캡션에 쓸 장 상태별 개수.
--      받은 id만 (work_id, position) 고유 인덱스로 센다. 읽을 수 없는 작품은 빠진다(work_parent_titles와 같은 방식).
--   2) site_stats: 홈 상단 통계. 공개 작품 기준 원작 수, 갈래 수, 최근 7일에 처음 공개된 갈래 수.

create function public.work_chapter_counts(p_work_ids uuid[])
returns table (work_id uuid, inherited int, modified int, new int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.work_id,
    count(*) filter (where c.state = 'inherited')::int,
    count(*) filter (where c.state = 'modified')::int,
    count(*) filter (where c.state = 'new')::int
  from public.chapters c
  where c.work_id = any (p_work_ids[1:100])
    and public.can_read_work(c.work_id)
  group by c.work_id
$$;

comment on function public.work_chapter_counts is
  '작품들의 장 상태별 개수(목록 카드용, 한 번에 100개까지). 읽을 수 없는 작품은 빠진다.';

revoke execute on function public.work_chapter_counts(uuid[]) from public, anon, authenticated;
grant execute on function public.work_chapter_counts(uuid[]) to anon, authenticated;

create function public.site_stats()
returns table (originals int, forks int, new_forks_week int)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.works where visibility = 'public' and parent_work_id is null)::int,
    (select count(*) from public.works where visibility = 'public' and parent_work_id is not null)::int,
    (select count(*) from public.works
      where visibility = 'public' and parent_work_id is not null
        and first_published_at >= now() - interval '7 days')::int
$$;

comment on function public.site_stats is
  '홈 상단 통계: 공개 원작 수, 공개 갈래 수, 최근 7일에 처음 공개된 갈래 수.';

revoke execute on function public.site_stats() from public, anon, authenticated;
grant execute on function public.site_stats() to anon, authenticated;
